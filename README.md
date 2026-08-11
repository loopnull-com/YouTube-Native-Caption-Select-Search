# YouTube Native Caption Select Search

A lightweight Tampermonkey userscript that makes YouTube's native captions selectable and provides quick **Google Translate** and **Google Search** actions for selected subtitle text.

一个轻量级 YouTube 字幕增强脚本：允许直接划选 YouTube 原生字幕，并快速进行 **Google 翻译**或 **Google 搜索**。

## Features

* Select text directly from YouTube native captions
* Translate selected captions to Simplified Chinese
* Search selected text with Google
* Automatically detect the source language when translating
* Prevent subtitle selection from triggering YouTube player actions
* Preserve the paused state when selecting captions from a paused video
* Prevent native drag-and-drop behavior while selecting subtitle text
* Floating selection toolbar with viewport boundary handling
* YouTube fullscreen support
* YouTube SPA navigation support
* No external libraries
* No API keys
* No backend service required

## 功能

* 直接鼠标划选 YouTube 原生字幕
* 将选中的字幕翻译为简体中文
* 使用 Google 搜索选中的文本
* 翻译时自动识别字幕源语言
* 防止划选字幕时误触发播放器播放 / 暂停等操作
* 视频原本暂停时，划选字幕不会导致视频意外恢复播放
* 阻止字幕划词进入浏览器 Drag & Drop 拖拽状态
* 浮动操作栏自动限制在浏览器可视区域内
* 支持 YouTube 浏览器全屏模式
* 兼容 YouTube SPA 页面切换
* 无第三方依赖
* 无需 API Key
* 无需后端服务器

## Usage

1. Install a userscript manager such as Tampermonkey.
2. Create a new userscript.
3. Paste the script code and save it.
4. Open a YouTube video with captions enabled.
5. Drag your mouse across a subtitle to select text.
6. A floating toolbar will appear.

Available actions:

### Translate / 翻译

Opens Google Translate with:

* Source language: Auto Detect
* Target language: Simplified Chinese

The selected subtitle text is passed directly to Google Translate.

### Search / 搜索

Searches the selected original text directly with Google Search.

This is useful for:

* Technical terms
* Proper nouns
* Abbreviations
* Concepts that need more context than a direct translation

## Translation Mechanism

The script does not use unofficial translation APIs or scrape Google Translate.

Instead, it constructs a normal Google Translate URL:

```text
https://translate.google.com/?sl=auto&tl=zh-CN&text=...&op=translate
```

Parameters:

* `sl=auto` — automatically detect the source language
* `tl=zh-CN` — translate to Simplified Chinese
* `text` — selected subtitle text
* `op=translate` — open translation mode

The subtitle text is encoded with `encodeURIComponent()` before being inserted into the URL.

This keeps the script:

* simple
* stable
* API-key free
* backend free

## How It Works

YouTube captions are normally interactive parts of the player rather than ordinary selectable page text.

The script modifies the relevant caption elements with CSS so that native browser text selection is enabled:

```css
user-select: text !important;
-webkit-user-select: text !important;
pointer-events: auto !important;
cursor: text !important;
-webkit-user-drag: none !important;
```

It then intercepts relevant player events during subtitle selection.

The script uses **Pointer Events** rather than maintaining duplicate mouse and pointer event systems.

Main events include:

```text
pointerdown
pointermove
pointerup
pointercancel
click
dragstart
```

During subtitle selection, propagation to the YouTube player is selectively blocked while preserving the browser's normal text-selection behavior.

## Pause Protection

A common problem with selectable YouTube captions is that releasing the mouse can also be interpreted as a player click.

If the video was already paused before subtitle selection, YouTube may attempt to resume playback.

This script records the video's state when a caption-selection session begins and temporarily protects that paused state.

The protection only belongs to the current selection session and is removed when the session ends, preventing an old selection from interfering with later intentional playback.

## Selection Handling

The selected text and its screen position are captured immediately on `pointerup`.

The script does not intentionally delay reading `window.getSelection()` because YouTube captions are dynamic DOM elements and can be replaced during playback.

Text normalization only:

* replaces line breaks with spaces
* collapses repeated whitespace
* trims surrounding whitespace

Normal punctuation is preserved.

For example:

```text
Wait, what?
```

remains:

```text
Wait, what?
```

instead of having its punctuation removed before translation.

## Floating Toolbar

After a valid subtitle selection, a small floating toolbar is displayed near the selected text.

The toolbar:

* prefers appearing above the selection
* moves below it if there is insufficient space
* remains inside the visible browser viewport
* prevents its own clicks from propagating to the YouTube player

The selected text is also shown as a shortened preview.

## Fullscreen Support

YouTube fullscreen mode changes which DOM element is displayed in the browser's fullscreen layer.

The script listens for:

```text
fullscreenchange
```

and dynamically mounts the toolbar under:

```text
document.fullscreenElement
```

when necessary.

After leaving fullscreen mode, the toolbar can return to the normal document tree.

## YouTube SPA Support

YouTube uses Single Page Application navigation.

The script mainly relies on document-level event delegation, so it does not need to continuously scan the YouTube DOM with a `MutationObserver`.

It also clears stale selection state when YouTube navigation begins.

## Supported Caption Elements

The script currently recognizes these YouTube caption selectors:

```text
.ytp-caption-segment
.caption-window
.ytp-caption-window-container
```

Selections outside the caption area do not trigger the toolbar.

## Requirements

* Google Chrome, Microsoft Edge, or another modern Chromium-based browser
* Tampermonkey or a compatible userscript manager
* JavaScript / Pointer Events support
* YouTube captions enabled

## Privacy

The script itself:

* does not collect user data
* does not store subtitle history
* does not use analytics
* does not send data to a custom server
* does not contain API keys

Selected text is only sent to Google when you explicitly choose **Translate** or **Search**, by opening the corresponding Google page.

## Current Scope

Version 1.6 intentionally focuses on reliable subtitle selection and lightweight text actions.

It does **not** currently include:

* vocabulary history
* word collections
* AI translation
* automatic subtitle translation
* custom translation APIs
* local databases
* cloud synchronization
* settings panel

## Version

### v1.6

* Replaced search-based “Chinese meaning” lookup with Google Translate
* Added separate Translate and Search actions
* Unified interaction handling around Pointer Events
* Improved subtitle selection state management
* Improved paused-video protection
* Capture Selection immediately on `pointerup`
* Preserve subtitle punctuation
* Added viewport-aware toolbar positioning
* Added YouTube fullscreen support
* Added SPA navigation state cleanup

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

You are free to use, modify, and redistribute this software under the terms of the GPL-3.0. If you distribute a modified version, the corresponding source code must also be made available under the same GPL-3.0 license.

See the [`LICENSE`](LICENSE) file for the full license text.

## Author

loopnull
