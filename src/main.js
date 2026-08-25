const {
  moment,
  normalizePath,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon,
  TextFileView,
  TFolder
} = require("obsidian");
const { EditorSelection, EditorState, Prec } = require("@codemirror/state");
const { defaultKeymap, history, historyKeymap } = require("@codemirror/commands");
const {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  search,
  searchKeymap,
  selectMatches,
  setSearchQuery
} = require("@codemirror/search");
const {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  WidgetType
} = require("@codemirror/view");

const VIEW_TYPE_PLAIN_TEXT = "plain-text-view";
const DEFAULT_SETTINGS = {
  fontFamily: "",
  fontSize: null,
  readableLineLength: false
};

const TRANSLATIONS = {
  en: {
    fileName: "File name",
    invalidFileName: "This file name cannot be used.",
    renameFailed: "Could not rename the file",
    systemFont: "System font",
    systemFontDesc: "Select from fonts installed on this device.",
    obsidianDefaultFont: "Obsidian default font",
    loadFonts: "Load font list",
    loading: "Loading…",
    fontsUnsupported: "System font access is not supported in this environment.",
    loadFailed: "Could not load fonts",
    customFont: "Specify font directly",
    customFontDesc: "Use this for fonts not shown in the list. Leave blank to use the Obsidian default font.",
    fontSize: "Font size",
    fontSizeDesc: "Select a body text size from 12px to 25px, or use the Obsidian default size.",
    obsidianDefaultSize: "Obsidian default size",
    readableLineLength: "Readable line length",
    readableLineLengthDesc: "Limit the text width to 100px wider than Obsidian's default line width.",
    characters: "characters",
    newTextNote: "New text note",
    untitled: "Untitled",
    createFailed: "Could not create the text file",
    findInText: "Find in text",
    findPlaceholder: "Find",
    findPrevious: "Previous",
    findNext: "Next",
    findAll: "All",
    close: "Close"
  },
  ja: {
    fileName: "ファイル名",
    invalidFileName: "使用できないファイル名です。",
    renameFailed: "ファイル名を変更できませんでした",
    systemFont: "システムフォント",
    systemFontDesc: "端末にインストールされているフォントから選択します。",
    obsidianDefaultFont: "Obsidianの標準フォント",
    loadFonts: "フォント一覧を取得",
    loading: "取得中…",
    fontsUnsupported: "この環境はシステムフォントの取得に対応していません。",
    loadFailed: "取得できませんでした",
    customFont: "フォントを直接指定",
    customFontDesc: "一覧にない場合に使用します。空欄にするとObsidianの標準フォントに戻ります。",
    fontSize: "フォントサイズ",
    fontSizeDesc: "本文の文字サイズを12pxから25pxの範囲で選択します。Obsidianの標準サイズも使用できます。",
    obsidianDefaultSize: "Obsidianの標準サイズ",
    readableLineLength: "読みやすい長さの行に調整",
    readableLineLengthDesc: "Obsidianの標準行幅より100px広い幅に、テキストの表示幅を制限します。",
    characters: "文字",
    newTextNote: "新規ノート（txt）",
    untitled: "無題",
    createFailed: "テキストファイルを作成できませんでした",
    findInText: "テキスト内を検索",
    findPlaceholder: "検索",
    findPrevious: "戻る",
    findNext: "次",
    findAll: "すべて",
    close: "閉じる"
  }
};

function t(key) {
  const language = moment.locale().toLowerCase().startsWith("ja") ? "ja" : "en";
  return TRANSLATIONS[language][key];
}

function insertPlainNewline(view) {
  const changes = view.state.changeByRange((range) => ({
    changes: { from: range.from, to: range.to, insert: "\n" },
    range: EditorSelection.cursor(range.from + 1)
  }));
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input.type" });
  return true;
}

class CompactSearchPanel {
  constructor(view, close) {
    this.view = view;
    this.close = close;
    this.query = getSearchQuery(view.state);
    this.top = true;
    this.dom = document.createElement("div");
    this.dom.className = "plain-text-editor__search";

    this.controls = document.createElement("div");
    this.controls.className = "plain-text-editor__search-controls";
    this.dom.append(this.controls);

    const inputWrap = document.createElement("div");
    inputWrap.className = "plain-text-editor__search-input-wrap";
    const searchIcon = document.createElement("span");
    searchIcon.className = "plain-text-editor__search-icon";
    setIcon(searchIcon, "search");
    inputWrap.append(searchIcon);

    this.input = document.createElement("input");
    this.input.type = "search";
    this.input.className = "plain-text-editor__search-input";
    this.input.placeholder = t("findPlaceholder");
    this.input.setAttribute("aria-label", t("findPlaceholder"));
    this.input.setAttribute("main-field", "true");
    this.input.value = this.query.search;
    this.input.addEventListener("input", () => this.commit());
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        (event.shiftKey ? findPrevious : findNext)(this.view);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
    inputWrap.append(this.input);
    this.controls.append(inputWrap);

    this.addButton(t("findPrevious"), () => findPrevious(this.view));
    this.addButton(t("findNext"), () => findNext(this.view));
    this.addButton(t("findAll"), () => selectMatches(this.view));
    this.addButton("×", () => this.close(), t("close"), true);
  }

  addButton(label, action, ariaLabel = label, close = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = close
      ? "plain-text-editor__search-button plain-text-editor__search-close"
      : "plain-text-editor__search-button";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", action);
    this.controls.append(button);
  }

  commit() {
    const query = new SearchQuery({ search: this.input.value });
    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
    }
  }

  focus() {
    this.input.select();
  }
}

class RubyWidget extends WidgetType {
  constructor(base, reading) {
    super();
    this.base = base;
    this.reading = reading;
  }

  eq(other) {
    return other.base === this.base && other.reading === this.reading;
  }

  toDOM() {
    const ruby = document.createElement("ruby");
    ruby.className = "plain-text-editor__ruby";
    ruby.append(document.createTextNode(this.base));
    const rt = document.createElement("rt");
    rt.textContent = this.reading;
    ruby.append(rt);
    return ruby;
  }

  ignoreEvent() {
    return false;
  }
}

function buildRubyDecorations(view) {
  const decorations = [];
  const visitedLines = new Set();
  const selections = view.state.selection.ranges;

  for (const visibleRange of view.visibleRanges) {
    let line = view.state.doc.lineAt(visibleRange.from);
    const lastLine = view.state.doc.lineAt(visibleRange.to).number;

    while (line.number <= lastLine) {
      if (!visitedLines.has(line.number)) {
        visitedLines.add(line.number);
        const rubyPattern = /｜([^《\n]+)《([^》\n]+)》/g;
        let match;
        while ((match = rubyPattern.exec(line.text)) !== null) {
          const from = line.from + match.index;
          const to = from + match[0].length;
          const isBeingEdited = selections.some(
            (selection) => selection.from <= to && selection.to >= from
          );
          if (!isBeingEdited) {
            decorations.push(
              Decoration.replace({
                widget: new RubyWidget(match[1], match[2]),
                inclusive: false
              }).range(from, to)
            );
          }
        }
      }

      if (line.number === lastLine) break;
      line = view.state.doc.line(line.number + 1);
    }
  }

  return Decoration.set(decorations, true);
}

const rubyViewPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildRubyDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildRubyDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations }
);

class PlainTextView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.inlineTitleEl = null;
    this.editorHostEl = null;
    this.editor = null;
    this.searchPanel = null;
    this.data = "";
    this.applyingExternalData = false;
  }

  getViewType() {
    return VIEW_TYPE_PLAIN_TEXT;
  }

  getDisplayText() {
    return this.file ? this.file.basename : "Plain text";
  }

  getIcon() {
    return "file-text";
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("plain-text-editor");

    this.inlineTitleEl = this.contentEl.createEl("input", {
      cls: "plain-text-editor__title inline-title",
      attr: {
        type: "text",
        "aria-label": t("fileName"),
        spellcheck: "false"
      }
    });
    this.updateTitle();

    this.registerDomEvent(this.inlineTitleEl, "change", () => {
      void this.renameFromTitle();
    });
    this.registerDomEvent(this.inlineTitleEl, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.inlineTitleEl.blur();
        this.focusEditorStart();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.updateTitle();
        this.inlineTitleEl.blur();
      }
    });

    this.editorHostEl = this.contentEl.createDiv({ cls: "plain-text-editor__editor" });
    this.editor = new EditorView({
      parent: this.editorHostEl,
      state: EditorState.create({
        doc: this.data,
        extensions: [
          history(),
          EditorView.lineWrapping,
          search({
            createPanel: () => {
              const dom = document.createElement("div");
              dom.hidden = true;
              return { dom };
            }
          }),
          rubyViewPlugin,
          Prec.highest(keymap.of([{ key: "Enter", run: insertPlainNewline }])),
          keymap.of([
            ...searchKeymap.filter((binding) => binding.key !== "Mod-f"),
            ...defaultKeymap,
            ...historyKeymap
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || this.applyingExternalData) return;
            this.data = update.state.doc.toString();
            this.requestSave();
            this.plugin.scheduleCharacterCount();
          })
        ]
      })
    });
    this.searchPanel = new CompactSearchPanel(this.editor, () => this.closeSearch());
    this.searchPanel.dom.hidden = true;
    this.contentEl.insertBefore(this.searchPanel.dom, this.inlineTitleEl);
    const captureFindShortcut = (event) => {
      if (
        this.editor?.hasFocus &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.openSearch();
      }
    };
    window.addEventListener("keydown", captureFindShortcut, true);
    this.register(() => window.removeEventListener("keydown", captureFindShortcut, true));
    this.applySettings();
    this.register(() => {
      this.editor?.destroy();
      this.editor = null;
    });
    this.plugin.scheduleCharacterCount();
  }

  getViewData() {
    return this.editor ? this.editor.state.doc.toString() : this.data;
  }

  setViewData(data) {
    this.data = data;
    this.updateTitle();
    if (this.editor && this.editor.state.doc.toString() !== data) {
      this.applyingExternalData = true;
      try {
        this.editor.dispatch({
          changes: { from: 0, to: this.editor.state.doc.length, insert: data }
        });
      } finally {
        this.applyingExternalData = false;
      }
    }
    this.plugin.scheduleCharacterCount();
  }

  clear() {
    this.setViewData("");
  }

  focus() {
    this.editor?.focus();
  }

  focusEditorStart() {
    if (!this.editor) return;
    this.editor.dispatch({
      selection: EditorSelection.cursor(0),
      scrollIntoView: true
    });
    this.editor.focus();
  }

  openSearch() {
    if (!this.searchPanel || !this.editor) return;
    openSearchPanel(this.editor);
    this.searchPanel.dom.hidden = false;
    this.searchPanel.focus();
  }

  closeSearch() {
    if (!this.searchPanel) return;
    this.searchPanel.dom.hidden = true;
    if (this.editor) closeSearchPanel(this.editor);
    this.editor?.focus();
  }

  updateTitle(file = this.file) {
    if (this.inlineTitleEl) {
      this.inlineTitleEl.value = file ? file.basename : "Plain text";
    }
  }

  async renameFromTitle() {
    const file = this.file;
    if (!file || !this.inlineTitleEl) return;

    const newName = this.inlineTitleEl.value.trim();
    if (!newName || /[<>:"/\\|?*]/.test(newName)) {
      new Notice(t("invalidFileName"));
      this.updateTitle(file);
      return;
    }
    if (newName === file.basename) return;

    const parentPath = file.parent && file.parent.path ? `${file.parent.path}/` : "";
    const newPath = `${parentPath}${newName}.${file.extension}`;

    try {
      await this.app.fileManager.renameFile(file, newPath);
    } catch (error) {
      new Notice(`${t("renameFailed")}: ${error instanceof Error ? error.message : String(error)}`);
      this.updateTitle(file);
    }
  }

  applySettings() {
    if (!this.editorHostEl) return;

    const fontFamily = this.plugin.settings.fontFamily.trim();
    if (fontFamily) {
      this.editorHostEl.style.setProperty("--plain-text-font-family", fontFamily);
    } else {
      this.editorHostEl.style.removeProperty("--plain-text-font-family");
    }

    const fontSize = Number(this.plugin.settings.fontSize);
    if (Number.isFinite(fontSize) && fontSize >= 12 && fontSize <= 25) {
      this.editorHostEl.style.setProperty("--plain-text-font-size", `${fontSize}px`);
    } else {
      this.editorHostEl.style.removeProperty("--plain-text-font-size");
    }

    this.contentEl.toggleClass(
      "plain-text-editor--readable-line-width",
      this.plugin.settings.readableLineLength
    );
  }
}

class PlainTextEditorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.systemFonts = [];
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    const fontSetting = new Setting(containerEl)
      .setName(t("systemFont"))
      .setDesc(t("systemFontDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("", t("obsidianDefaultFont"));
        const current = this.plugin.settings.fontFamily;
        if (current && !this.systemFonts.includes(current)) dropdown.addOption(current, current);
        for (const family of this.systemFonts) dropdown.addOption(family, family);
        dropdown.setValue(current).onChange(async (value) => {
          this.plugin.settings.fontFamily = value;
          await this.plugin.saveSettings();
          this.plugin.applySettings();
        });
      });

    fontSetting.addButton((button) =>
      button.setButtonText(t("loadFonts")).onClick(async () => {
        button.setDisabled(true);
        button.setButtonText(t("loading"));
        try {
          if (typeof globalThis.queryLocalFonts !== "function") {
            throw new Error(t("fontsUnsupported"));
          }
          const fonts = await globalThis.queryLocalFonts();
          this.systemFonts = [...new Set(fonts.map((font) => font.family).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "ja"));
          this.display();
        } catch (error) {
          button.setDisabled(false);
          button.setButtonText(t("loadFonts"));
          fontSetting.setDesc(
            `${t("loadFailed")}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );

    new Setting(containerEl)
      .setName(t("customFont"))
      .setDesc(t("customFontDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("obsidianDefaultFont"))
          .setValue(this.plugin.settings.fontFamily)
          .onChange(async (value) => {
            this.plugin.settings.fontFamily = value;
            await this.plugin.saveSettings();
            this.plugin.applySettings();
          })
      );

    new Setting(containerEl)
      .setName(t("fontSize"))
      .setDesc(t("fontSizeDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("", t("obsidianDefaultSize"));
        for (let size = 12; size <= 25; size += 1) {
          dropdown.addOption(String(size), `${size}px`);
        }
        const currentSize = Number(this.plugin.settings.fontSize);
        const currentValue = Number.isFinite(currentSize) && currentSize >= 12 && currentSize <= 25
          ? String(currentSize)
          : "";
        dropdown.setValue(currentValue).onChange(async (value) => {
          this.plugin.settings.fontSize = value === "" ? null : Number(value);
          await this.plugin.saveSettings();
          this.plugin.applySettings();
        });
      });

    new Setting(containerEl)
      .setName(t("readableLineLength"))
      .setDesc(t("readableLineLengthDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.readableLineLength).onChange(async (value) => {
          this.plugin.settings.readableLineLength = value;
          await this.plugin.saveSettings();
          this.plugin.applySettings();
        })
      );
  }
}

module.exports = class PlainTextEditorPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.characterCountFrame = null;
    this.characterCountEl = this.addStatusBarItem();
    this.characterCountEl.addClass("plain-text-editor__character-count");
    this.characterCountEl.hide();

    this.registerView(VIEW_TYPE_PLAIN_TEXT, (leaf) => new PlainTextView(leaf, this));
    this.registerExtensions(["txt"], VIEW_TYPE_PLAIN_TEXT);
    this.addSettingTab(new PlainTextEditorSettingTab(this.app, this));
    this.addCommand({
      id: "new-text-note",
      name: t("newTextNote"),
      callback: () => void this.createTextFile(this.getSelectedNavigatorFolder())
    });
    this.addCommand({
      id: "find-in-text",
      name: t("findInText"),
      checkCallback: (checking) => {
        const view = this.app.workspace.activeLeaf?.view;
        if (!(view instanceof PlainTextView) || !view.editor) return false;
        if (!checking) view.openSearch();
        return true;
      }
    });
    this.registerEvent(this.app.vault.on("rename", (file) => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAIN_TEXT)) {
        if (leaf.view instanceof PlainTextView && leaf.view.file === file) {
          leaf.view.updateTitle(file);
        }
      }
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateCharacterCount()));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      menu.addItem((item) =>
        item.setTitle(t("newTextNote")).setIcon("file-plus-2")
          .onClick(() => void this.createTextFile(file))
      );
    }));
    this.app.workspace.onLayoutReady(() => this.updateCharacterCount());
    this.register(() => {
      if (this.characterCountFrame !== null) cancelAnimationFrame(this.characterCountFrame);
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getSelectedNavigatorFolder() {
    const navigator = this.app.plugins?.plugins?.["notebook-navigator"]?.api;
    const navItem = navigator?.selection?.getNavItem?.();
    return navItem?.type === "folder" ? navItem.folder : this.app.vault.getRoot();
  }

  applySettings() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAIN_TEXT)) {
      if (leaf.view instanceof PlainTextView) leaf.view.applySettings();
    }
  }

  async createTextFile(contextFile) {
    const folder = contextFile instanceof TFolder ? contextFile : contextFile?.parent;
    const folderPath = folder?.path ? `${folder.path}/` : "";
    const baseName = t("untitled");
    let sequence = 0;
    let path;
    do {
      const suffix = sequence === 0 ? "" : ` ${sequence}`;
      path = normalizePath(`${folderPath}${baseName}${suffix}.txt`);
      sequence += 1;
    } while (this.app.vault.getAbstractFileByPath(path));

    try {
      const file = await this.app.vault.create(path, "");
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      if (leaf.view instanceof PlainTextView && leaf.view.inlineTitleEl) {
        leaf.view.inlineTitleEl.focus();
        leaf.view.inlineTitleEl.select();
      }
    } catch (error) {
      new Notice(`${t("createFailed")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  updateCharacterCount() {
    if (!this.characterCountEl) return;
    const view = this.app.workspace.activeLeaf?.view;
    if (!(view instanceof PlainTextView)) {
      this.characterCountEl.hide();
      document.body.removeClass("plain-text-editor-is-active");
      return;
    }
    const count = this.countCharacters(view.getViewData());
    this.characterCountEl.setText(`${count} ${t("characters")}`);
    this.characterCountEl.show();
    document.body.addClass("plain-text-editor-is-active");
  }

  scheduleCharacterCount() {
    if (this.characterCountFrame !== null) return;
    this.characterCountFrame = requestAnimationFrame(() => {
      this.characterCountFrame = null;
      this.updateCharacterCount();
    });
  }

  countCharacters(text) {
    const withoutLineBreaks = text.replace(/\r\n|\r|\n/g, "");
    if (typeof Intl.Segmenter === "function") {
      let count = 0;
      const segments = new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(withoutLineBreaks);
      for (const _segment of segments) count += 1;
      return count;
    }
    return Array.from(withoutLineBreaks).length;
  }

  onunload() {
    document.body.removeClass("plain-text-editor-is-active");
  }
};
