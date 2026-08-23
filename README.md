# Plain Text Editor

日本語で小説を書くために開発したObsidianプラグインです。Obsidian上で、Markdownに変換せずプレーンテキストの執筆ができるようになります。

## Features

- Obsidian のファイルエクスプローラーに `.txt` ファイルを表示
- コマンドパレットの「新規ノート（txt）」から `.txt` ファイルを作成
- Markdown の書式や自動インデントを適用せず、プレーンテキストのまま編集・保存
- システムフォントとフォントサイズを設定可能
- 読みやすい行の長さに制限する設定あり
- 文字数をリアルタイムで表示


## Installation

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/plain-text-editor/
```

Then reload Obsidian and enable **Plain Text Editor** under **Settings → Community plugins**.

## Development

This repository currently contains the compiled plugin files and does not require a build step.
