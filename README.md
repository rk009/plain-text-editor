# Plain Text Editor

日本語で小説を書くために開発したObsidianプラグインです。Obsidian上で、Markdownに変換せずプレーンテキストの執筆ができるようになります。

## Features

- Obsidian のファイルエクスプローラーに `.txt` ファイルを表示
- コマンドパレットの「新規ノート（txt）」から `.txt` ファイルを作成
- Markdown の書式や自動インデントを適用せず、プレーンテキストのまま編集・保存
- システムフォントとフォントサイズを設定可能
- 読みやすい行の長さに制限する設定あり
- 文字数をリアルタイムで表示

- `Ctrl+F` / `Cmd+F` によるテキスト検索
- `｜漢字《かんじ》` 形式のルビ表示

## Installation

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/plain-text-editor/
```

Then reload Obsidian and enable **Plain Text Editor** under **Settings → Community plugins**.

## Development

Install dependencies and build the bundled `main.js` with:

```text
npm install
npm run build
```

The editable source is in `src/main.js`. CodeMirror 6 is bundled into the generated `main.js`.
