// ==UserScript==
// @name         YouTube Native Caption Select Search
// @namespace    yt-native-caption-select-search
// @version      1.6
// @description  Select YouTube captions and open the selected text in Google Translate or Google Search without triggering player actions
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = Object.freeze({
    captionSelector: '.ytp-caption-segment, .caption-window, .ytp-caption-window-container',
    viewportMargin: 8,
    toolbarGap: 8,
    previewLength: 30
  });

  const state = {
    selecting: false,
    pointerId: null,
    selectedText: '',
    selectionRect: null,
    preservePaused: false,
    selectionVideo: null,
    pauseGuardAttached: false,
    toolbarVisible: false,
    uiFrame: 0
  };

  function buildTranslateUrl(text) {
    return 'https://translate.google.com/?sl=auto&tl=zh-CN&text='
      + encodeURIComponent(text)
      + '&op=translate';
  }

  function buildSearchUrl(text) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(text);
  }

  function normalizeText(text) {
    return text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncatePreview(text) {
    const characters = Array.from(text);
    return characters.length > CONFIG.previewLength
      ? characters.slice(0, CONFIG.previewLength).join('') + '…'
      : text;
  }

  function nodeToElement(node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node;
    return node.parentElement || null;
  }

  function isCaptionTarget(target) {
    const element = nodeToElement(target);
    return !!element?.closest?.(CONFIG.captionSelector);
  }

  function isSelectionFromCaption(selection) {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false;
    }

    const anchorElement = nodeToElement(selection.anchorNode);
    const focusElement = nodeToElement(selection.focusNode);

    return isCaptionTarget(anchorElement) && isCaptionTarget(focusElement);
  }

  function copyRect(rect) {
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  function getSelectionRect(range) {
    const boundingRect = range.getBoundingClientRect();
    if (boundingRect.width || boundingRect.height) {
      return copyRect(boundingRect);
    }

    const clientRect = Array.from(range.getClientRects()).find(
      rect => rect.width || rect.height
    );
    return clientRect ? copyRect(clientRect) : null;
  }

  function getVideo() {
    return document.querySelector('.html5-main-video') || document.querySelector('video');
  }

  function keepVideoPausedIfNeeded() {
    const video = state.selectionVideo || getVideo();
    if (state.preservePaused && video && !video.paused) {
      video.pause();
    }
  }

  function handleProtectedVideoPlay(event) {
    if (state.preservePaused && event.currentTarget === state.selectionVideo) {
      event.currentTarget.pause();
    }
  }

  function attachPauseGuard() {
    if (!state.preservePaused || !state.selectionVideo) return;
    state.selectionVideo.addEventListener('play', handleProtectedVideoPlay);
    state.pauseGuardAttached = true;
  }

  function detachPauseGuard() {
    if (state.pauseGuardAttached && state.selectionVideo) {
      state.selectionVideo.removeEventListener('play', handleProtectedVideoPlay);
    }
    state.pauseGuardAttached = false;
  }

  const style = document.createElement('style');
  style.textContent = `
    .ytp-caption-segment,
    .caption-window,
    .ytp-caption-window-container {
      user-select: text !important;
      -webkit-user-select: text !important;
      pointer-events: auto !important;
      cursor: text !important;
      -webkit-user-drag: none !important;
    }

    #yt-caption-selection-toolbar {
      position: fixed;
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      gap: 6px;
      box-sizing: border-box;
      max-width: min(360px, calc(100vw - 16px));
      padding: 7px;
      color: #fff;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 7px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      font: 13px/1.3 Arial, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      pointer-events: auto;
    }

    #yt-caption-selection-preview {
      overflow: hidden;
      color: rgba(255, 255, 255, 0.9);
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    #yt-caption-selection-actions {
      display: flex;
      gap: 6px;
    }

    #yt-caption-selection-toolbar button {
      min-width: 58px;
      margin: 0;
      padding: 5px 10px;
      color: #fff;
      background: rgba(255, 255, 255, 0.13);
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 5px;
      font: 13px/1.2 Arial, sans-serif;
      cursor: pointer;
    }

    #yt-caption-selection-toolbar button:hover {
      background: rgba(255, 255, 255, 0.23);
    }

    #yt-caption-selection-toolbar button:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 1px;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  const toolbar = document.createElement('div');
  toolbar.id = 'yt-caption-selection-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', '字幕文本操作');

  const preview = document.createElement('div');
  preview.id = 'yt-caption-selection-preview';

  const actions = document.createElement('div');
  actions.id = 'yt-caption-selection-actions';

  const translateButton = document.createElement('button');
  translateButton.type = 'button';
  translateButton.textContent = '翻译';

  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.textContent = '搜索';

  actions.append(translateButton, searchButton);
  toolbar.append(preview, actions);

  function getToolbarHost() {
    return document.fullscreenElement || document.body || document.documentElement;
  }

  function mountToolbar() {
    const host = getToolbarHost();
    if (host && toolbar.parentNode !== host) {
      host.appendChild(toolbar);
    }
  }

  mountToolbar();

  function resetSelectionSession() {
    if (state.uiFrame) {
      cancelAnimationFrame(state.uiFrame);
      state.uiFrame = 0;
    }

    detachPauseGuard();
    state.selecting = false;
    state.pointerId = null;
    state.selectedText = '';
    state.selectionRect = null;
    state.preservePaused = false;
    state.selectionVideo = null;
    state.toolbarVisible = false;
  }

  function clearBrowserSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function hideToolbar(options = {}) {
    toolbar.style.display = 'none';
    toolbar.style.visibility = 'hidden';
    resetSelectionSession();

    if (options.clearSelection) {
      clearBrowserSelection();
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function positionToolbar() {
    const rect = state.selectionRect;
    if (!rect) return;

    const margin = CONFIG.viewportMargin;
    const gap = CONFIG.toolbarGap;
    const toolbarWidth = toolbar.offsetWidth;
    const toolbarHeight = toolbar.offsetHeight;
    const maxLeft = Math.max(margin, window.innerWidth - margin - toolbarWidth);
    const maxTop = Math.max(margin, window.innerHeight - margin - toolbarHeight);

    const centeredLeft = rect.left + (rect.width - toolbarWidth) / 2;
    const aboveTop = rect.top - gap - toolbarHeight;
    const belowTop = rect.bottom + gap;
    const preferredTop = aboveTop >= margin ? aboveTop : belowTop;

    toolbar.style.left = `${clamp(centeredLeft, margin, maxLeft)}px`;
    toolbar.style.top = `${clamp(preferredTop, margin, maxTop)}px`;
  }

  function scheduleToolbarDisplay() {
    if (state.uiFrame) {
      cancelAnimationFrame(state.uiFrame);
    }

    state.uiFrame = requestAnimationFrame(() => {
      state.uiFrame = 0;
      if (!state.selectedText || !state.selectionRect) return;

      mountToolbar();
      preview.textContent = truncatePreview(state.selectedText);
      preview.title = state.selectedText;
      toolbar.style.visibility = 'hidden';
      toolbar.style.display = 'flex';
      positionToolbar();
      toolbar.style.visibility = 'visible';
      state.toolbarVisible = true;
    });
  }

  function captureCaptionSelection() {
    const selection = window.getSelection();
    if (!isSelectionFromCaption(selection)) {
      state.selectedText = '';
      state.selectionRect = null;
      return false;
    }

    const selectedText = normalizeText(selection.toString());
    const selectionRect = getSelectionRect(selection.getRangeAt(0));
    if (!selectedText || !selectionRect) {
      state.selectedText = '';
      state.selectionRect = null;
      return false;
    }

    state.selectedText = selectedText;
    state.selectionRect = selectionRect;
    return true;
  }

  function startCaptionSelection(event) {
    hideToolbar();

    const video = getVideo();
    state.selecting = true;
    state.pointerId = event.pointerId;
    state.preservePaused = !!video?.paused;
    state.selectionVideo = video;
    attachPauseGuard();
  }

  function blockToolbarEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function openSelectedText(event, urlBuilder) {
    blockToolbarEvent(event);

    const text = state.selectedText;
    if (!text) return;

    window.open(urlBuilder(text), '_blank', 'noopener,noreferrer');
    hideToolbar({ clearSelection: true });
  }

  function handlePointerDown(event) {
    if (toolbar.contains(event.target)) return;

    if (event.button === 0 && isCaptionTarget(event.target)) {
      startCaptionSelection(event);
      event.stopPropagation();
      return;
    }

    if (!isCaptionTarget(event.target)) {
      hideToolbar();
    }
  }

  function handlePointerMove(event) {
    if (
      state.selecting
      && event.pointerId === state.pointerId
      && (event.buttons & 1) === 1
    ) {
      event.stopPropagation();
    }
  }

  function handlePointerUp(event) {
    if (!state.selecting || event.pointerId !== state.pointerId) return;

    // Capture both the text and Range geometry synchronously. YouTube may replace
    // caption nodes immediately after this event, so the Selection itself is not deferred.
    const hasCaptionSelection = captureCaptionSelection();

    state.selecting = false;
    state.pointerId = null;
    keepVideoPausedIfNeeded();
    event.stopPropagation();

    if (hasCaptionSelection) {
      scheduleToolbarDisplay();
      return;
    }

    // Let the following click event finish while this one-operation pause guard
    // is still available, then discard the session if no toolbar was created.
    state.uiFrame = requestAnimationFrame(() => {
      state.uiFrame = 0;
      if (!state.selectedText) {
        hideToolbar();
      }
    });
  }

  function handlePointerCancel(event) {
    if (!state.selecting || event.pointerId !== state.pointerId) return;
    event.stopPropagation();
    hideToolbar();
  }

  function handleCaptionClick(event) {
    if (!isCaptionTarget(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    keepVideoPausedIfNeeded();
  }

  function handleDragStart(event) {
    if (state.selecting || isCaptionTarget(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  toolbar.addEventListener('pointerdown', blockToolbarEvent);
  toolbar.addEventListener('pointerup', blockToolbarEvent);
  toolbar.addEventListener('click', blockToolbarEvent);

  translateButton.addEventListener('click', event => {
    openSelectedText(event, buildTranslateUrl);
  });

  searchButton.addEventListener('click', event => {
    openSelectedText(event, buildSearchUrl);
  });

  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', handlePointerUp, true);
  document.addEventListener('pointercancel', handlePointerCancel, true);
  document.addEventListener('click', handleCaptionClick, true);
  document.addEventListener('dragstart', handleDragStart, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideToolbar({ clearSelection: true });
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const shouldRestoreToolbar = state.toolbarVisible && state.selectedText;
    mountToolbar();

    if (shouldRestoreToolbar) {
      scheduleToolbarDisplay();
    }
  });

  document.addEventListener('scroll', () => {
    hideToolbar();
  }, true);

  window.addEventListener('resize', () => {
    hideToolbar();
  });

  window.addEventListener('blur', () => {
    hideToolbar();
  });

  document.addEventListener('yt-navigate-start', () => {
    hideToolbar({ clearSelection: true });
  });
})();
