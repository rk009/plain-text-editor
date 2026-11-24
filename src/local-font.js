function cssString(value) {
  return `"${value.replace(/[\\"\n\r\f]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"`;
}

function selectFontFace(fonts, family) {
  const matches = fonts.filter((font) => font.family === family);
  return matches.find((font) => /^(regular|normal|roman|book)$/i.test(font.style))
    || matches.find((font) => !/bold|italic|oblique|black|heavy/i.test(font.style))
    || matches[0];
}

class LocalFontLoader {
  constructor() {
    this.documents = new Map();
    this.fonts = [];
    this.disposed = false;
  }

  load(document, metadata) {
    if (this.disposed) return Promise.reject(new Error("Font loader is disposed"));
    let entries = this.documents.get(document);
    if (!entries) this.documents.set(document, entries = new Map());
    const key = JSON.stringify(metadata);
    if (!entries.has(key)) {
      const entry = {};
      entries.set(key, entry);
      entry.promise = this.loadFace(document, metadata, entry).catch((error) => {
        entries.delete(key);
        throw error;
      });
    }
    return entries.get(key).promise;
  }

  async loadFace(document, metadata, entry) {
    const FontFace = document.defaultView.FontFace;
    const alias = `PlainTextLocal-${metadata.postscriptName || metadata.fullName}`;
    const names = [...new Set([metadata.postscriptName, metadata.fullName].filter(Boolean))];
    let face;
    try {
      face = new FontFace(alias, names.map((name) => `local(${cssString(name)})`).join(", "));
      await face.load();
    } catch (error) {
      // Newly installed fonts may be enumerated before CSS local() can resolve them.
      const font = this.fonts.find((font) => font.postscriptName === metadata.postscriptName
        && font.family === metadata.family);
      if (!font) throw error;
      const data = await (await font.blob()).arrayBuffer();
      face = new FontFace(alias, data);
      await face.load();
    }
    if (this.disposed) throw new Error("Font loader is disposed");
    document.fonts.add(face);
    entry.face = face;
    return cssString(alias);
  }

  dispose() {
    this.disposed = true;
    for (const [document, entries] of this.documents) {
      for (const entry of entries.values()) {
        if (entry.face) document.fonts.delete(entry.face);
      }
    }
    this.documents.clear();
  }
}

module.exports = { cssString, selectFontFace, LocalFontLoader };
