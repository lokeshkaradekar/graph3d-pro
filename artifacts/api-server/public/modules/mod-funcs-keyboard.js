/**
 * Graph3D Pro — mod-funcs-keyboard.js
 * Module 13 — Funcs Panel (categorized math function picker)
 * + Fuzzy search, full keyboard navigation (arrows/enter/escape),
 *   and a usage-frequency-based "Recently used" row
 * + Inline "add slider" quick buttons under each equation
 * ~/graph3d-pro/modules/mod-funcs-keyboard.js
 */

const ModFuncs = (() => {

  let _activeInput = null;
  let _panelEl = null;
  let _searchInput = null;
  let _recentRow = null;
  let _highlightIndex = -1; // index into the currently-visible button list

  // ══════════════════════════════════════════════════════
  // USAGE TRACKING ("Recently used" row)
  // ══════════════════════════════════════════════════════

  const USAGE_KEY = 'g3d_func_usage';
  const RECENT_COUNT = 8;

  function _loadUsage() {
    try {
      return JSON.parse(localStorage.getItem(USAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function _recordUsage(label) {
    try {
      const usage = _loadUsage();
      usage[label] = (usage[label] || 0) + 1;
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch {
      // localStorage unavailable (private browsing etc.) — usage tracking
      // is a nice-to-have, never worth breaking insertion over.
    }
  }

  function _getTopUsed(n) {
    const usage = _loadUsage();
    const byLabel = new Map(_flatItems().map(it => [it.label, it]));
    return Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => byLabel.get(label))
      .filter(Boolean)
      .slice(0, n);
  }

  // ══════════════════════════════════════════════════════
  // SEARCH — small, predictable fuzzy match (substring match first,
  // falls back to subsequence match for typo tolerance)
  // ══════════════════════════════════════════════════════

  let _flatItemsCache = null;
  function _flatItems() {
    if (!_flatItemsCache) {
      _flatItemsCache = CATEGORIES.flatMap(cat => cat.items.map(it => ({ ...it, category: cat.title })));
    }
    return _flatItemsCache;
  }

  function _isSubsequence(needle, haystack) {
    let i = 0;
    for (let j = 0; j < haystack.length && i < needle.length; j++) {
      if (haystack[j] === needle[i]) i++;
    }
    return i === needle.length;
  }

  function _matches(item, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const fields = [item.label, item.insert, item.category, ...(item.aliases || [])]
      .filter(Boolean)
      .map(s => s.toLowerCase());
    return fields.some(f => f.includes(q)) || fields.some(f => _isSubsequence(q, f));
  }

  // ══════════════════════════════════════════════════════
  // FUNCTION CATEGORIES  (mirrors Desmos funcs panel)
  // ══════════════════════════════════════════════════════

  const CATEGORIES = [
    {
      title: 'Trig Functions',
      items: [
        { label: 'sin',  insert: 'sin()' },
        { label: 'cos',  insert: 'cos()' },
        { label: 'tan',  insert: 'tan()' },
        { label: 'csc',  insert: 'csc()' },
        { label: 'sec',  insert: 'sec()' },
        { label: 'cot',  insert: 'cot()' },
      ],
    },
    {
      title: 'Inverse Trig Functions',
      items: [
        { label: 'sin⁻¹', insert: 'asin()', aliases: ['arcsin'] },
        { label: 'cos⁻¹', insert: 'acos()', aliases: ['arccos'] },
        { label: 'tan⁻¹', insert: 'atan()', aliases: ['arctan'] },
        { label: 'csc⁻¹', insert: 'acsc()', aliases: ['arccsc'] },
        { label: 'sec⁻¹', insert: 'asec()', aliases: ['arcsec'] },
        { label: 'cot⁻¹', insert: 'acot()', aliases: ['arccot'] },
      ],
    },
    {
      title: 'Hyperbolic Trig Functions',
      items: [
        { label: 'sinh', insert: 'sinh()' },
        { label: 'cosh', insert: 'cosh()' },
        { label: 'tanh', insert: 'tanh()' },
        { label: 'csch', insert: 'csch()' },
        { label: 'sech', insert: 'sech()' },
        { label: 'coth', insert: 'coth()' },
      ],
    },
    {
      title: 'Calculus',
      items: [
        { label: 'exp',     insert: 'exp()' },
        { label: 'ln',      insert: 'log()' },
        { label: 'log',     insert: 'log10()' },
        { label: 'logₐ',    insert: 'log(,)' },
        { label: 'd/dx',    insert: 'derivative(,x)', aliases: ['derivative', 'diff'] },
        { label: "f'",      insert: "derivative(,x)", aliases: ['derivative', 'diff', 'prime'] },
        { label: '∫',       insert: 'integrate(,x,,)', aliases: ['integral', 'integrate'] },
      ],
    },
    {
      title: 'Number Theory',
      items: [
        { label: 'lcm',   insert: 'lcm(,)' },
        { label: 'gcd',   insert: 'gcd(,)' },
        { label: 'mod',   insert: 'mod(,)' },
        { label: 'ceil',  insert: 'ceil()' },
        { label: 'floor', insert: 'floor()' },
        { label: 'round', insert: 'round()' },
        { label: 'sign',  insert: 'sign()' },
        { label: 'ⁿ√',    insert: 'nthRoot(,)' },
        { label: 'nPr',   insert: 'permutations(,)' },
        { label: 'nCr',   insert: 'combinations(,)' },
      ],
    },
    {
      title: 'Statistics',
      items: [
        { label: 'mean',   insert: 'mean()' },
        { label: 'median', insert: 'median()' },
        { label: 'min',    insert: 'min()' },
        { label: 'max',    insert: 'max()' },
        { label: 'stdev',  insert: 'std()' },
        { label: 'var',    insert: 'variance()' },
        { label: 'mode',   insert: 'mode()' },
      ],
    },
    {
      title: 'Geometry',
      items: [
        { label: 'distance', insert: 'distance(,)' },
        { label: 'midpoint', insert: 'midpoint(,)' },
        { label: 'norm',     insert: 'norm()' },
        { label: 'cross',    insert: 'cross(,)' },
        { label: 'dot',      insert: 'dot(,)' },
      ],
    },
    {
      title: 'Common',
      items: [
        { label: '|a|',  insert: 'abs()' },
        { label: '√',    insert: 'sqrt()' },
        { label: 'π',    insert: 'pi' },
        { label: 'e',    insert: 'e' },
        { label: 'a²',   insert: '^2' },
        { label: 'aᵇ',   insert: '^()' },
        { label: 'a/b',  insert: '/' },
      ],
    },
  ];

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _buildPanel();
    document.addEventListener('pointerdown', e => {
      if (_panelEl && !_panelEl.contains(e.target) && !e.target.closest('.funcs-trigger-btn')) {
        closePanel();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePanel();
    });

    // Watch for new equation cards and inject the funcs/slider buttons
    _observeEquationList();
  }

  // ══════════════════════════════════════════════════════
  // BUILD FLOATING PANEL  (shared, repositioned per trigger)
  // ══════════════════════════════════════════════════════

  function _buildPanel() {
    _panelEl = document.createElement('div');
    _panelEl.id = 'funcs-panel';
    _panelEl.style.cssText = `
      position:fixed;z-index:600;background:var(--s1);
      border:1px solid var(--b2);border-radius:10px;
      width:300px;max-height:420px;overflow-y:auto;
      box-shadow:0 20px 50px rgba(0,0,0,.7);
      display:none;padding:0;
    `;

    // ── Sticky search header ─────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = `
      position:sticky;top:0;background:var(--s1);padding:10px 10px 8px;
      border-bottom:1px solid var(--b2);z-index:1;
    `;
    _searchInput = document.createElement('input');
    _searchInput.type = 'text';
    _searchInput.placeholder = 'Search functions…';
    _searchInput.autocomplete = 'off';
    _searchInput.style.cssText = `
      width:100%;background:var(--s2);border:1px solid var(--b2);
      color:var(--t1);border-radius:6px;padding:6px 8px;
      font-size:12px;font-family:var(--font-ui);box-sizing:border-box;
    `;
    _searchInput.addEventListener('input', () => {
      _filterPanel(_searchInput.value);
    });
    _searchInput.addEventListener('keydown', _handlePanelKeydown);
    header.appendChild(_searchInput);
    _panelEl.appendChild(header);

    // ── Body (recently-used row + categories) ─────────────
    const body = document.createElement('div');
    body.style.cssText = 'padding:10px';
    body.id = 'funcs-panel-body';

    _recentRow = document.createElement('div');
    _recentRow.id = 'funcs-recent-row';
    _recentRow.style.cssText = 'margin-bottom:12px;display:none';
    body.appendChild(_recentRow);

    const emptyState = document.createElement('div');
    emptyState.id = 'funcs-empty-state';
    emptyState.textContent = 'No matching functions';
    emptyState.style.cssText = 'display:none;text-align:center;color:var(--t3);font-size:11.5px;padding:20px 0';
    body.appendChild(emptyState);

    CATEGORIES.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'funcs-category';
      section.style.cssText = 'margin-bottom:12px';

      const heading = document.createElement('div');
      heading.textContent = cat.title;
      heading.style.cssText = `
        font-size:9.5px;font-weight:700;letter-spacing:1px;
        text-transform:uppercase;color:var(--t3);margin-bottom:6px;
      `;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px';

      cat.items.forEach(item => {
        grid.appendChild(_makeFuncButton(item));
      });

      section.appendChild(grid);
      body.appendChild(section);
    });

    _panelEl.appendChild(body);
    document.body.appendChild(_panelEl);
  }

  /**
   * Builds one function button. Shared by the category grids and the
   * "Recently used" row so both stay visually/behaviorally identical.
   */
  function _makeFuncButton(item) {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.className = 'funcs-item-btn';
    btn.dataset.key = item.label;
    btn.title = item.aliases ? item.label + ' (' + item.aliases.join(', ') + ')' : item.label;
    btn.style.cssText = `
      background:var(--s2);border:1px solid var(--b1);
      color:var(--t1);border-radius:6px;padding:7px 4px;
      cursor:pointer;font-size:12px;font-family:var(--font-ui);
      transition:all .12s;text-align:center;
    `;
    btn.addEventListener('mouseenter', () => _setHighlight(_visibleButtons().indexOf(btn)));
    btn.addEventListener('click', () => _chooseItem(item));
    return btn;
  }

  function _chooseItem(item) {
    _insertIntoActiveInput(item.insert);
    _recordUsage(item.label);
    _refreshRecentRow();
    // Stay open (matches prior click behavior) so a few functions can be
    // dropped in one after another; refocus search for the next one.
    if (_searchInput) _searchInput.focus();
  }

  function _refreshRecentRow() {
    if (!_recentRow) return;
    const top = _getTopUsed(RECENT_COUNT);
    _recentRow.innerHTML = '';
    _recentRow.dataset.hasItems = top.length > 0 ? '1' : '0';
    if (top.length === 0) {
      _recentRow.style.display = 'none';
      return;
    }
    const heading = document.createElement('div');
    heading.textContent = 'Recently used';
    heading.style.cssText = `
      font-size:9.5px;font-weight:700;letter-spacing:1px;
      text-transform:uppercase;color:var(--t3);margin-bottom:6px;
    `;
    _recentRow.appendChild(heading);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px';
    top.forEach(item => grid.appendChild(_makeFuncButton(item)));
    _recentRow.appendChild(grid);
    _recentRow.style.display = 'block';
    if (window.lucide) lucide.createIcons({ nodes: [_recentRow] });
  }

  // ══════════════════════════════════════════════════════
  // FILTERING
  // ══════════════════════════════════════════════════════

  const _itemsByLabel = new Map();
  function _itemByLabel(label) {
    if (_itemsByLabel.size === 0) {
      _flatItems().forEach(it => _itemsByLabel.set(it.label, it));
    }
    return _itemsByLabel.get(label);
  }

  function _filterPanel(query) {
    const q = query.trim();
    let anyVisible = false;

    _panelEl.querySelectorAll('.funcs-category').forEach(section => {
      const buttons = section.querySelectorAll('.funcs-item-btn');
      let sectionHasMatch = false;
      buttons.forEach(btn => {
        const item = _itemByLabel(btn.dataset.key);
        const show = item ? _matches(item, q) : true;
        btn.style.display = show ? '' : 'none';
        if (show) sectionHasMatch = true;
      });
      section.style.display = sectionHasMatch ? '' : 'none';
      if (sectionHasMatch) anyVisible = true;
    });

    // The convenience "recently used" row only makes sense with an empty
    // search box — once you're searching, the filtered grid below is the
    // more precise result set.
    if (_recentRow) _recentRow.style.display = q ? 'none' : (_recentRow.dataset.hasItems === '1' ? 'block' : 'none');

    document.getElementById('funcs-empty-state').style.display = anyVisible ? 'none' : 'block';

    _highlightIndex = -1;
    _clearHighlightStyles();
  }

  function _visibleButtons() {
    return Array.from(_panelEl.querySelectorAll('.funcs-item-btn'))
      .filter(btn => btn.offsetParent !== null);
  }

  function _clearHighlightStyles() {
    _panelEl.querySelectorAll('.funcs-item-btn').forEach(btn => {
      btn.style.borderColor = 'var(--b1)';
      btn.style.background = 'var(--s2)';
    });
  }

  function _setHighlight(index) {
    const buttons = _visibleButtons();
    if (buttons.length === 0) return;
    _highlightIndex = Math.max(0, Math.min(index, buttons.length - 1));
    _clearHighlightStyles();
    const btn = buttons[_highlightIndex];
    btn.style.borderColor = 'var(--abrd)';
    btn.style.background = 'var(--s3)';
    btn.scrollIntoView({ block: 'nearest' });
  }

  function _handlePanelKeydown(e) {
    const buttons = _visibleButtons();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (buttons.length) _setHighlight(_highlightIndex < 0 ? 0 : _highlightIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (buttons.length) _setHighlight(_highlightIndex < 0 ? 0 : _highlightIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = _highlightIndex < 0 ? 0 : _highlightIndex;
      const btn = buttons[idx];
      if (btn) {
        const item = _itemByLabel(btn.dataset.key);
        if (item) _chooseItem(item);
      }
    }
    // Escape is handled by the existing document-level listener — it bubbles.
  }

  function openPanel(triggerBtn, inputEl) {
    _activeInput = inputEl;

    const rect = triggerBtn.getBoundingClientRect();
    const panelW = 300;
    let left = rect.right - panelW;
    let top  = rect.bottom + 6;

    if (left < 8) left = 8;
    if (top + 420 > window.innerHeight) {
      top = rect.top - 420 - 6;
      if (top < 8) top = 8;
    }

    _panelEl.style.left = left + 'px';
    _panelEl.style.top  = top + 'px';
    _panelEl.style.display = 'block';

    // Reset to a clean slate every time it opens: no stale search text,
    // fresh recently-used list, nothing left highlighted from last time.
    if (_searchInput) _searchInput.value = '';
    _refreshRecentRow();
    _filterPanel('');
    if (_searchInput) requestAnimationFrame(() => _searchInput.focus());
  }

  function closePanel() {
    if (_panelEl) _panelEl.style.display = 'none';
    _highlightIndex = -1;
    // Keyboard users shouldn't lose their place — send focus back to the
    // equation field they were typing in.
    if (_activeInput && document.contains(_activeInput)) _activeInput.focus();
    _activeInput = null;
  }

  // ══════════════════════════════════════════════════════
  // INSERT TOKEN INTO ACTIVE EQUATION INPUT
  // Places cursor inside first empty () if present
  // ══════════════════════════════════════════════════════

  function _insertIntoActiveInput(token) {
    if (!_activeInput) return;

    const start = _activeInput.selectionStart ?? _activeInput.value.length;
    const end   = _activeInput.selectionEnd   ?? _activeInput.value.length;
    const before = _activeInput.value.slice(0, start);
    const after  = _activeInput.value.slice(end);

    _activeInput.value = before + token + after;

    // Position cursor inside first () if the token has one
    const openParen = token.indexOf('(');
    let cursorPos;
    if (openParen !== -1 && token[openParen + 1] === ')') {
      cursorPos = start + openParen + 1;
    } else {
      cursorPos = start + token.length;
    }

    _activeInput.focus();
    _activeInput.setSelectionRange(cursorPos, cursorPos);

    // Trigger input event so the equation rebuilds
    _activeInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ══════════════════════════════════════════════════════
  // INJECT FUNCS + ADD-SLIDER BUTTONS INTO EACH EQ CARD
  // ══════════════════════════════════════════════════════

  function _injectControlsForCard(card) {
    if (card.querySelector('.eq-funcs-row')) return; // already injected
    const input = card.querySelector('.eq-input');
    if (!input) return;

    const row = document.createElement('div');
    row.className = 'eq-funcs-row';
    row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-top:6px;flex-wrap:wrap';

    // ── Funcs trigger button ─────────────────────────────
    const funcsBtn = document.createElement('button');
    funcsBtn.className = 'funcs-trigger-btn';
    funcsBtn.innerHTML = `<i data-lucide="square-function" width="11" height="11"></i> funcs`;
    funcsBtn.style.cssText = `
      background:var(--s2);border:1px solid var(--b2);
      color:var(--t2);border-radius:5px;padding:3px 8px;
      cursor:pointer;font-size:10.5px;font-family:var(--font-ui);
      display:flex;align-items:center;gap:4px;transition:all .14s;
    `;
    funcsBtn.addEventListener('mouseenter', () => {
      funcsBtn.style.borderColor = 'var(--abrd)';
      funcsBtn.style.color = 'var(--accent)';
    });
    funcsBtn.addEventListener('mouseleave', () => {
      funcsBtn.style.borderColor = 'var(--b2)';
      funcsBtn.style.color = 'var(--t2)';
    });
    funcsBtn.addEventListener('click', e => {
      e.stopPropagation();
      openPanel(funcsBtn, input);
    });
    row.appendChild(funcsBtn);

    // ── Add slider quick buttons (auto from detected vars) ──
    const sliderWrap = document.createElement('span');
    sliderWrap.className = 'eq-slider-suggestions';
    sliderWrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap';
    row.appendChild(sliderWrap);

    const insertAfter = card.querySelector('.eq-bottom') || card.querySelector('.eq-row-2');
    if (insertAfter) {
      insertAfter.parentElement.insertBefore(row, insertAfter.nextSibling);
    } else {
      card.appendChild(row);
    }

    if (window.lucide) lucide.createIcons({ nodes: [row] });

    // Refresh slider suggestions whenever the input changes
    const refresh = () => _refreshSliderSuggestions(card, input, sliderWrap);
    input.addEventListener('input', () => {
      clearTimeout(input._funcsDebounce);
      input._funcsDebounce = setTimeout(refresh, 400);
    });
    refresh();
  }

  // ══════════════════════════════════════════════════════
  // SLIDER SUGGESTIONS  ("add slider: m  c  all")
  // ══════════════════════════════════════════════════════

  function _refreshSliderSuggestions(card, input, wrap) {
    wrap.innerHTML = '';
    const expr = input.value;
    if (!expr.trim()) return;

    const vars = window.MathEngine ? MathEngine.detectSliderVars(expr) : [];
    const missing = vars.filter(v => !(window.ModSliders && ModSliders.has(v)));

    if (missing.length === 0) return;

    const label = document.createElement('span');
    label.textContent = 'add slider:';
    label.style.cssText = 'font-size:10px;color:var(--t3);margin-right:2px';
    wrap.appendChild(label);

    missing.forEach(name => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = `
        background:var(--s2);border:1px solid var(--b2);
        color:var(--accent);border-radius:5px;padding:2px 8px;
        cursor:pointer;font-size:11px;font-family:var(--font-mono);
        font-weight:600;transition:all .14s;
      `;
      btn.addEventListener('mouseenter', () => btn.style.borderColor = 'var(--abrd)');
      btn.addEventListener('mouseleave', () => btn.style.borderColor = 'var(--b2)');
      btn.addEventListener('click', () => {
        if (window.ModSliders) ModSliders.addSlider(name, 1);
        _refreshSliderSuggestions(card, input, wrap);
        if (window.ModToast) ModToast.show('Slider "' + name + '" added', 'success');
      });
      wrap.appendChild(btn);
    });

    if (missing.length > 1) {
      const allBtn = document.createElement('button');
      allBtn.textContent = 'all';
      allBtn.style.cssText = `
        background:var(--accent);border:1px solid var(--accent);
        color:#fff;border-radius:5px;padding:2px 10px;
        cursor:pointer;font-size:11px;font-family:var(--font-ui);
        font-weight:600;transition:all .14s;
      `;
      allBtn.addEventListener('click', () => {
        missing.forEach(name => {
          if (window.ModSliders) ModSliders.addSlider(name, 1);
        });
        _refreshSliderSuggestions(card, input, wrap);
        if (window.ModToast) ModToast.show('All sliders added', 'success');
      });
      wrap.appendChild(allBtn);
    }
  }

  // ══════════════════════════════════════════════════════
  // OBSERVE EQUATION LIST FOR NEW CARDS
  // ══════════════════════════════════════════════════════

  function _observeEquationList() {
    const list = document.getElementById('equation-list');
    if (!list) {
      // Retry shortly if list isn't mounted yet
      setTimeout(_observeEquationList, 200);
      return;
    }

    // Inject into any existing cards
    list.querySelectorAll('.eq-card').forEach(_injectControlsForCard);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('eq-card')) {
            _injectControlsForCard(node);
          } else if (node.querySelector) {
            const card = node.querySelector('.eq-card');
            if (card) _injectControlsForCard(card);
          }
        });
      });
    });

    observer.observe(list, { childList: true, subtree: true });
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    init,
    openPanel,
    closePanel,
  };

})();
