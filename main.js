const { moment, Notice, Plugin, PluginSettingTab, Setting, TextFileView } = require("obsidian");

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
    fontSizeDesc: "Set the body text size in pixels. Leave blank to use the Obsidian default size.",
    obsidianDefaultSize: "Obsidian default size",
    readableLineLength: "Readable line length",
    readableLineLengthDesc: "Limit the text width to 100px wider than Obsidian's default line width.",
    characters: "characters"
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
    fontSizeDesc: "本文の文字サイズをpx単位で指定します。空欄の場合はObsidianの標準サイズを使用します。",
    obsidianDefaultSize: "Obsidianの標準サイズ",
    readableLineLength: "読みやすい長さの行に調整",
    readableLineLengthDesc: "Obsidianの標準行幅より100px広い幅に、テキストの表示幅を制限します。",
    characters: "文字"
  }
};

function t(key) {
  const language = moment.locale().toLowerCase().startsWith("ja") ? "ja" : "en";
  return TRANSLATIONS[language][key];
}

class PlainTextView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.inlineTitleEl = null;
    this.editor = null;
    this.data = "";
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
    this.contentEl.addClass("plain-text-viewer");

    this.inlineTitleEl = this.contentEl.createEl("input", {
      cls: "plain-text-viewer__title inline-title",
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
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.updateTitle();
        this.inlineTitleEl.blur();
      }
    });

    this.editor = this.contentEl.createEl("textarea", {
      cls: "plain-text-viewer__editor",
      attr: {
        "aria-label": "Plain text editor",
        "autocomplete": "off",
        "autocapitalize": "off",
        "spellcheck": "false",
        "wrap": "soft"
      }
    });
    this.editor.value = this.data;
    this.applySettings();

    this.registerDomEvent(this.editor, "input", () => {
      this.data = this.editor.value;
      this.requestSave();
      this.plugin.scheduleCharacterCount();
    });

    this.plugin.scheduleCharacterCount();
  }

  getViewData() {
    return this.editor ? this.editor.value : this.data;
  }

  setViewData(data, clear) {
    this.data = data;
    this.updateTitle();
    if (this.editor && this.editor.value !== data) {
      this.editor.value = data;
    }
    this.plugin.scheduleCharacterCount();
  }

  clear() {
    this.data = "";
    if (this.editor) {
      this.editor.value = "";
    }
    this.plugin.scheduleCharacterCount();
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    }
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

    const parentPath = file.parent && file.parent.path
      ? `${file.parent.path}/`
      : "";
    const newPath = `${parentPath}${newName}.${file.extension}`;

    try {
      await this.app.fileManager.renameFile(file, newPath);
    } catch (error) {
      new Notice(`${t("renameFailed")}: ${error instanceof Error ? error.message : String(error)}`);
      this.updateTitle(file);
    }
  }

  applySettings() {
    if (!this.editor) return;

    const fontFamily = this.plugin.settings.fontFamily.trim();
    if (fontFamily) {
      this.editor.style.setProperty("--plain-text-font-family", fontFamily);
    } else {
      this.editor.style.removeProperty("--plain-text-font-family");
    }

    const fontSize = Number(this.plugin.settings.fontSize);
    if (Number.isFinite(fontSize) && fontSize >= 8 && fontSize <= 72) {
      this.editor.style.setProperty("--plain-text-font-size", `${fontSize}px`);
    } else {
      this.editor.style.removeProperty("--plain-text-font-size");
    }

    this.contentEl.toggleClass(
      "plain-text-viewer--readable-line-width",
      this.plugin.settings.readableLineLength
    );
  }
}

class PlainTextViewerSettingTab extends PluginSettingTab {
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
        if (current && !this.systemFonts.includes(current)) {
          dropdown.addOption(current, current);
        }
        for (const family of this.systemFonts) {
          dropdown.addOption(family, family);
        }

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
          this.systemFonts = [...new Set(
            fonts.map((font) => font.family).filter(Boolean)
          )].sort((a, b) => a.localeCompare(b, "ja"));
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
      .addText((text) => {
        text
          .setPlaceholder(t("obsidianDefaultSize"))
          .setValue(this.plugin.settings.fontSize == null ? "" : String(this.plugin.settings.fontSize))
          .onChange(async (value) => {
            const trimmed = value.trim();
            const parsed = Number(trimmed);
            this.plugin.settings.fontSize = trimmed !== "" && Number.isFinite(parsed)
              ? parsed
              : null;
            await this.plugin.saveSettings();
            this.plugin.applySettings();
          });
        text.inputEl.type = "number";
        text.inputEl.min = "8";
        text.inputEl.max = "72";
        text.inputEl.step = "1";
      });

    new Setting(containerEl)
      .setName(t("readableLineLength"))
      .setDesc(t("readableLineLengthDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.readableLineLength)
          .onChange(async (value) => {
            this.plugin.settings.readableLineLength = value;
            await this.plugin.saveSettings();
            this.plugin.applySettings();
          })
      );
  }
}

module.exports = class PlainTextViewerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.characterCountFrame = null;
    this.characterCountEl = this.addStatusBarItem();
    this.characterCountEl.addClass("plain-text-viewer__character-count");
    this.characterCountEl.hide();

    this.registerView(
      VIEW_TYPE_PLAIN_TEXT,
      (leaf) => new PlainTextView(leaf, this)
    );
    this.registerExtensions(["txt"], VIEW_TYPE_PLAIN_TEXT);
    this.addSettingTab(new PlainTextViewerSettingTab(this.app, this));
    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAIN_TEXT)) {
          if (leaf.view instanceof PlainTextView && leaf.view.file === file) {
            leaf.view.updateTitle(file);
          }
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateCharacterCount())
    );
    this.app.workspace.onLayoutReady(() => this.updateCharacterCount());
    this.register(() => {
      if (this.characterCountFrame !== null) {
        cancelAnimationFrame(this.characterCountFrame);
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  applySettings() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAIN_TEXT)) {
      if (leaf.view instanceof PlainTextView) {
        leaf.view.applySettings();
      }
    }
  }

  updateCharacterCount() {
    if (!this.characterCountEl) return;

    const view = this.app.workspace.activeLeaf?.view;
    if (!(view instanceof PlainTextView)) {
      this.characterCountEl.hide();
      document.body.removeClass("plain-text-viewer-is-active");
      return;
    }

    const text = view.getViewData();
    const characterCount = this.countCharacters(text);
    this.characterCountEl.setText(`${characterCount} ${t("characters")}`);
    this.characterCountEl.show();
    document.body.addClass("plain-text-viewer-is-active");
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
    document.body.removeClass("plain-text-viewer-is-active");
  }
};
