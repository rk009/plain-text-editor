const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cssString, selectFontFace, LocalFontLoader } = require("../src/local-font");

const metadata = {
  family: "Shippori Mincho",
  fullName: "Shippori Mincho Regular",
  postscriptName: "ShipporiMincho-Regular"
};

function makeDocument(rejectLocal = false) {
  const sources = [];
  return {
    sources,
    fonts: new Set(),
    defaultView: {
      FontFace: class {
        constructor(family, source) {
          this.family = family;
          this.source = source;
          sources.push(source);
        }
        async load() {
          if (rejectLocal && typeof this.source === "string") throw new Error("Unavailable local font");
          return this;
        }
      }
    }
  };
}

test("uses the regular face even when bold is enumerated first", () => {
  const fonts = [
    { ...metadata, style: "Bold" },
    { ...metadata, style: "Regular" },
    { family: "Other", style: "Regular" }
  ];
  assert.equal(selectFontFace(fonts, metadata.family), fonts[1]);
  assert.equal(selectFontFace(fonts, "Missing"), undefined);
});

test("loads saved full and PostScript names without enumerating fonts", async () => {
  const loader = new LocalFontLoader();
  const document = makeDocument();
  const [first, second] = await Promise.all([loader.load(document, metadata), loader.load(document, metadata)]);
  assert.equal(first, second);
  assert.match(document.sources[0], /local\("ShipporiMincho-Regular"\)/);
  assert.match(document.sources[0], /local\("Shippori Mincho Regular"\)/);
  assert.equal(document.fonts.size, 1);
  const popout = makeDocument();
  await loader.load(popout, metadata);
  assert.equal(popout.fonts.size, 1);
  loader.dispose();
  assert.equal(document.fonts.size, 0);
  assert.equal(popout.fonts.size, 0);
});

test("loads font bytes when a newly installed font cannot be resolved by local()", async () => {
  const loader = new LocalFontLoader();
  const document = makeDocument(true);
  const data = new Uint8Array([0, 1, 0, 0]).buffer;
  loader.fonts = [{ ...metadata, blob: async () => ({ arrayBuffer: async () => data }) }];
  await loader.load(document, metadata);
  assert.equal(document.sources[1], data);
  assert.equal(document.fonts.size, 1);
});

test("a failed load can be retried after refreshing the font list", async () => {
  const loader = new LocalFontLoader();
  const document = makeDocument(true);
  await assert.rejects(loader.load(document, metadata), /Unavailable/);
  loader.fonts = [{ ...metadata, blob: async () => new Blob(["font"]) }];
  await loader.load(document, metadata);
  assert.equal(document.fonts.size, 1);
});

test("unloading during an asynchronous font load does not register a leaked face", async () => {
  const loader = new LocalFontLoader();
  const document = makeDocument();
  const pending = loader.load(document, metadata);
  loader.dispose();
  await assert.rejects(pending, /disposed/);
  assert.equal(document.fonts.size, 0);
});

test("quotes font names containing CSS punctuation and control characters", () => {
  assert.equal(cssString('A"B\\C\nD'), '"A\\22 B\\5c C\\a D"');
});
