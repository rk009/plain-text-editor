# Plain Text Editor

An Obsidian plugin for opening and editing `.txt` files directly in a vault without converting them to Markdown.

This plugin was developed specifically for writing novels in Japanese, providing a distraction-free plain-text editing environment inside Obsidian.

日本語で小説を書くために開発した Obsidian プラグインです。Obsidian 上で、Markdown に変換せずプレーンテキストの執筆に集中できる環境を提供します。

## Features

- Displays `.txt` files in Obsidian's file explorer
- Edits and saves plain text without Markdown formatting
- Soft-wrapped lines without inserting line breaks into the file
- Editable inline file title
- Configurable system font and font size
- Optional readable line length
- Live character count
- Automatic Japanese and English UI

## Installation

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/plain-text-editor/
```

Then reload Obsidian and enable **Plain Text Editor** under **Settings → Community plugins**.

## Development

This repository currently contains the compiled plugin files and does not require a build step.
