module.exports = function withNavigatorCounts(BasePlugin) {
  return class extends BasePlugin {
    async onload() {
      await super.onload();

      let stopped = false;
      let running = false;
      const cache = new Map();
      const documents = new Map();
      const selector = ".nn-file[data-path]";
      const attribute = "data-pte-count";

      const attachStyle = (doc) => {
        if (documents.has(doc)) return;
        const style = doc.createElement("style");
        style.textContent = `
          .nn-file-name[${attribute}] {
            position: relative;
            padding-inline-end: 11ch;
            box-sizing: border-box;
          }
          .nn-file-name[${attribute}]::after {
            content: attr(${attribute});
            position: absolute;
            inset-inline-end: 0;
            top: 0;
            color: var(--text-muted);
            font-size: var(--font-ui-smaller);
            font-weight: normal;
            white-space: nowrap;
            pointer-events: none;
          }
        `;
        doc.head.appendChild(style);
        documents.set(doc, style);
      };

      const refresh = async () => {
        if (stopped || running) return;
        running = true;
        try {
          const activeDocuments = new Set();
          this.app.workspace.iterateAllLeaves((leaf) => {
            const doc = leaf.view.containerEl?.ownerDocument;
            if (doc) activeDocuments.add(doc);
          });

          for (const [doc, style] of documents) {
            if (activeDocuments.has(doc)) continue;
            style.remove();
            doc.querySelectorAll(`[${attribute}]`).forEach(
              (el) => el.removeAttribute(attribute)
            );
            documents.delete(doc);
          }

          const openViews = new Map();
          for (const leaf of this.app.workspace.getLeavesOfType(
            "plain-text-view"
          )) {
            const view = leaf.view;
            if (view.file && typeof view.getViewData === "function") {
              openViews.set(view.file.path, view);
            }
          }
          const activeView = this.app.workspace.activeLeaf?.view;
          if (
            activeView?.getViewType() === "plain-text-view" &&
            activeView.file
          ) {
            openViews.set(activeView.file.path, activeView);
          }

          for (const doc of activeDocuments) {
            const rows = doc.querySelectorAll(selector);
            if (rows.length) attachStyle(doc);

            for (const row of rows) {
              if (stopped) return;
              const name = row.querySelector(".nn-file-name");
              if (!name) continue;
              const path = row.getAttribute("data-path");
              const file = this.app.vault.getFileByPath(path);
              if (!file || file.extension.toLowerCase() !== "txt") {
                name.removeAttribute(attribute);
                continue;
              }
              if (!row.getClientRects().length) continue;

              try {
                const view = openViews.get(path);
                const text = view ? view.getViewData() : null;
                const stamp = `${file.stat.mtime}:${file.stat.size}`;
                let entry = cache.get(path);
                if (
                  !entry ||
                  entry.stamp !== stamp ||
                  entry.text !== text
                ) {
                  const content = text === null
                    ? await this.app.vault.read(file)
                    : text;
                  if (stopped) return;
                  if (
                    file.path !== path ||
                    `${file.stat.mtime}:${file.stat.size}` !== stamp
                  ) continue;
                  entry = {
                    stamp,
                    text,
                    count: this.countCharacters(content)
                  };
                  cache.delete(path);
                  cache.set(path, entry);
                  if (cache.size > 256) {
                    cache.delete(cache.keys().next().value);
                  }
                }

                if (
                  row.isConnected &&
                  row.getAttribute("data-path") === path &&
                  row.querySelector(".nn-file-name") === name
                ) {
                  const label =
                    `${entry.count.toLocaleString("ja-JP")}\u6587\u5b57`;
                  if (name.getAttribute(attribute) !== label) {
                    name.setAttribute(attribute, label);
                  }
                }
              } catch {
                if (row.getAttribute("data-path") === path) {
                  name.removeAttribute(attribute);
                }
                cache.delete(path);
              }
            }
          }
        } finally {
          running = false;
        }
      };

      const schedule = () => {
        void refresh().catch((error) => {
          console.error("Plain Text Editor: count refresh failed", error);
        });
      };
      this.registerInterval(window.setInterval(schedule, 500));
      this.app.workspace.onLayoutReady(schedule);
      this.register(() => {
        stopped = true;
        for (const [doc, style] of documents) {
          style.remove();
          doc.querySelectorAll(`[${attribute}]`).forEach(
            (el) => el.removeAttribute(attribute)
          );
        }
        documents.clear();
        cache.clear();
      });
    }
  };
};
