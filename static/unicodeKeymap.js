/**
 * Remap ASCII letters/digits typed in Rule/Input to Unicode letter-like blocks.
 */
(function (global) {
  const STORAGE_KEY = 'wfo.unicodeKeymap';

  function cp(n) {
    return String.fromCodePoint(n);
  }

  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const az = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const OPTION_PREVIEW = AZ;

  function capsFromRange(base) {
    const capitals = {};
    for (let i = 0; i < 26; i++) {
      capitals[AZ[i]] = base + i;
    }
    return capitals;
  }

  /**
   * One keyboard style only: lowercase block + capitals from the same style.
   * Missing capitals use that style's lowercase glyph (never letterlike or another style).
   */
  function buildStyleMap(lowerBase, capitals, digitEntries) {
    const map = {};
    for (let i = 0; i < 26; i++) {
      map[az[i]] = cp(lowerBase + i);
      const cap = capitals[AZ[i]];
      map[AZ[i]] = cp(cap != null ? cap : lowerBase + i);
    }
    if (digitEntries) {
      for (const [ch, code] of Object.entries(digitEntries)) {
        map[ch] = cp(code);
      }
    }
    return map;
  }

  function uniformStyleMap(base) {
    return buildStyleMap(base, capsFromRange(base), null);
  }

  const MODES = {
    normal: { label: '(None)', map: null },
    fraktur: {
      label: 'Fraktur',
      map: buildStyleMap(0x1d586, capsFromRange(0x1d56c), null),
    },
    handwritten: {
      label: 'Handwritten',
      map: buildStyleMap(0x1d4ea, capsFromRange(0x1d4d0), null),
    },
    squared: {
      label: 'Squared',
      map: uniformStyleMap(0x1f130),
    },
    circled: {
      label: 'Circled',
      map: buildStyleMap(0x24d0, capsFromRange(0x24b6), {
        ...Object.fromEntries([...'123456789'].map((d, i) => [d, 0x2460 + i])),
        0: 0x24ea,
      }),
    },
  };

  let activeMode = 'normal';

  const LEGACY_MODE_IDS = {
    blackCircles: 'normal',
    filledCircles: 'normal',
    filledSquares: 'normal',
    cursive: 'normal',
    doubleStruck: 'normal',
  };

  function getStoredMode() {
    try {
      let v = localStorage.getItem(STORAGE_KEY);
      if (v && LEGACY_MODE_IDS[v]) {
        v = LEGACY_MODE_IDS[v];
      }
      return v && MODES[v] ? v : 'normal';
    } catch {
      return 'normal';
    }
  }

  function setStoredMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function mapChar(ch, mode) {
    if (!mode || mode === 'normal') return ch;
    const def = MODES[mode];
    if (!def || !def.map) return ch;
    return def.map[ch] ?? ch;
  }

  function mapString(str, mode) {
    if (!mode || mode === 'normal') return str;
    let out = '';
    for (const ch of str) {
      out += mapChar(ch, mode);
    }
    return out;
  }

  /** Insert in a way browsers record for undo/redo (unlike assigning .value). */
  function insertAtCursor(textarea, text) {
    textarea.focus();
    const inserted = document.execCommand('insertText', false, text);
    if (inserted) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function hasModifierKeys(e) {
    return e.ctrlKey || e.metaKey || e.altKey;
  }

  function isShortcutKeyEvent(e) {
    if (!hasModifierKeys(e)) return false;
    const k = e.key.toLowerCase();
    return (
      k === 'z' ||
      k === 'y' ||
      k === 'a' ||
      k === 'x' ||
      k === 'c' ||
      k === 'v' ||
      k === 's' ||
      k === 'd' ||
      k === 'f' ||
      k === 'g' ||
      k === 'h'
    );
  }

  function remapInsertData(data) {
    if (!data || activeMode === 'normal') return data;
    let out = '';
    let changed = false;
    for (const ch of data) {
      const mapped = mapChar(ch, activeMode);
      out += mapped;
      if (mapped !== ch) changed = true;
    }
    return changed ? out : data;
  }

  function onBeforeInput(e) {
    if (activeMode === 'normal' || e.isComposing || e.defaultPrevented) return;
    const target = e.target;
    if (!(target instanceof HTMLTextAreaElement)) return;

    const type = e.inputType;
    if (type === 'historyUndo' || type === 'historyRedo' || type === 'deleteByCut') {
      return;
    }
    if (hasModifierKeys(e) || isShortcutKeyEvent(e)) {
      return;
    }

    if (
      (type === 'insertText' || type === 'insertReplacementText') &&
      e.data
    ) {
      const mapped = remapInsertData(e.data);
      if (mapped === e.data) return;
      e.preventDefault();
      insertAtCursor(target, mapped);
      return;
    }

    if (type === 'insertFromPaste' && e.data) {
      const mapped = remapInsertData(e.data);
      if (mapped === e.data) return;
      e.preventDefault();
      insertAtCursor(target, mapped);
    }
  }

  function setMode(mode) {
    activeMode = MODES[mode] ? mode : 'normal';
    setStoredMode(activeMode);
    const select = document.getElementById('editorUnicodeKeymap');
    if (select && select.value !== activeMode) {
      select.value = activeMode;
    }
  }

  function optionPreview(modeId) {
    if (modeId === 'normal') return OPTION_PREVIEW;
    return mapString(OPTION_PREVIEW, modeId);
  }

  function populateSelect(select) {
    select.innerHTML = '';
    const entries = Object.entries(MODES);
    const normal = entries.find(([id]) => id === 'normal');
    const rest = entries
      .filter(([id]) => id !== 'normal')
      .sort((a, b) => a[1].label.localeCompare(b[1].label));
    const sorted = normal ? [normal, ...rest] : rest;
    for (const [id, def] of sorted) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = optionPreview(id);
      opt.title = def.label;
      select.appendChild(opt);
    }
    select.value = activeMode;
  }

  const PATH_DIGIT_BASE = 0x1d7ed;

  const PATH_SYMBOL_GROUPS = [
    {
      label: 'Counts',
      symbols: Array.from({ length: 10 }, (_, i) => ({
        ch: cp(PATH_DIGIT_BASE + i),
        title: `Count ${i}`,
      })),
    },
    {
      label: 'Arrows',
      symbols: [
        { ch: '←', title: 'Left' },
        { ch: '→', title: 'Right' },
        { ch: '↑', title: 'Up' },
        { ch: '↓', title: 'Down' },
      ],
    },
    {
      label: 'Invisible',
      symbols: [
        { ch: '⮜', title: 'Invisible left' },
        { ch: '⮞', title: 'Invisible right' },
        { ch: '⮝', title: 'Invisible up' },
        { ch: '⮟', title: 'Invisible down' },
      ],
    },
    {
      label: 'Layout',
      symbols: [
        { ch: '⎹', title: 'Chain segment' },
        { ch: '◖', title: 'Arc horizontal' },
        { ch: '◗', title: 'Arc vertical' },
        { ch: '⯭', title: 'Snap' },
        { ch: '∗', title: 'Dot' },
        { ch: '⍛', title: 'Minicircle' },
        { ch: '⌇', title: 'Glyph delimiter' },
      ],
    },
  ];

  let lastCodeEditor = null;

  function getInsertTarget(ruleEl, inputEl) {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && active.classList.contains('code-editor')) {
      return active;
    }
    return lastCodeEditor || ruleEl || inputEl;
  }

  function initPathSymbolPalette(ruleEl, inputEl) {
    const container = document.getElementById('editorPathSymbols');
    if (!container) return;

    container.innerHTML = '';
    for (const group of PATH_SYMBOL_GROUPS) {
      const groupEl = document.createElement('div');
      groupEl.className = 'path-symbol-group';

      const label = document.createElement('span');
      label.className = 'path-symbol-group-label';
      label.textContent = group.label;
      groupEl.appendChild(label);

      for (const { ch, title } of group.symbols) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'path-symbol-btn';
        btn.textContent = ch;
        btn.title = title;
        btn.setAttribute('aria-label', `Insert ${title}: ${ch}`);
        btn.addEventListener('click', () => {
          const target = getInsertTarget(ruleEl, inputEl);
          if (target) insertAtCursor(target, ch);
        });
        groupEl.appendChild(btn);
      }

      container.appendChild(groupEl);
    }
  }

  function initUnicodeKeymap() {
    activeMode = getStoredMode();
    const select = document.getElementById('editorUnicodeKeymap');
    const ruleEl = document.getElementById('editorRule');
    const inputEl = document.getElementById('editorInput');
    if (!select || !ruleEl || !inputEl) return;

    populateSelect(select);
    select.addEventListener('change', () => setMode(select.value));

    for (const el of [ruleEl, inputEl]) {
      el.addEventListener('beforeinput', onBeforeInput);
      el.addEventListener('focus', () => {
        lastCodeEditor = el;
      });
    }
    lastCodeEditor = ruleEl;

    initPathSymbolPalette(ruleEl, inputEl);
    setMode(activeMode);
  }

  global.unicodeKeymap = {
    MODES,
    PATH_SYMBOL_GROUPS,
    mapChar,
    mapString,
    insertAtCursor,
    setMode,
    initUnicodeKeymap,
  };
})(typeof window !== 'undefined' ? window : globalThis);
