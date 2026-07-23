/**
 * Graph3D Pro — mod-equations.js
 * Module 05 — Equation List UI, Real-time Parsing,
 * Syntax Highlighting, Auto-complete, Bracket Matching,
 * Expression Formatting, Equation History, Favorites,
 * Search, Copy/Paste, Undo/Redo History, Color Picker, Context Menu
 * ~/graph3d-pro/modules/mod-equations.js
 */

const ModEquations = (() => {

  // ── Core state ─────────────────────────────────────────
  let _equations      = [];
  let _idCounter      = 0;
  let _debounceTimers = {};

  // Undo / Redo stacks
  const _undoStack = [];
  const _redoStack = [];
  const MAX_HISTORY = 50;

  // Color picker state
  let _pickerTarget = null;
  let _pickerDot    = null;

  // Context menu state
  let _ctxTarget = null;

  // Multi-select state
  let _selectedIds   = new Set();
  let _lastSelectedId = null; // shift-click anchor

  // Groups/folders state
  let _groups        = []; // { id, name, collapsed }
  let _groupIdCounter = 0;

  // Color-picker apply targets — always an array (length 1 for single-select)
  let _pickerReturnFocusEl = null;

  // ── New feature state ──────────────────────────────────
  let _acTarget = null;  // input with active autocomplete
  let _acIndex  = -1;    // selected AC suggestion index

  // Session history of successfully-parsed expressions
  const _eqHistory     = [];
  const MAX_EQ_HISTORY = 30;

  // localStorage key for favorites
  const FAVORITES_KEY = 'graph3d_eq_favorites';

  // ── Palettes & hints ───────────────────────────────────
  const PALETTE = [
    '#3b82f6','#10b981','#f59e0b','#f43f5e',
    '#8b5cf6','#06b6d4','#f97316','#ec4899',
    '#a3e635','#ffffff','#94a3b8','#1d4ed8',
  ];

  // Human-readable names for accessible labels — falls back to the hex
  // string itself for any color outside this palette (e.g. custom/AI colors).
  const COLOR_NAMES = {
    '#3b82f6': 'Blue',       '#10b981': 'Green',
    '#f59e0b': 'Amber',      '#f43f5e': 'Rose',
    '#8b5cf6': 'Purple',     '#06b6d4': 'Cyan',
    '#f97316': 'Orange',     '#ec4899': 'Pink',
    '#a3e635': 'Lime',       '#ffffff': 'White',
    '#94a3b8': 'Slate',      '#1d4ed8': 'Dark blue',
  };

  function _colorName(hex) {
    if (!hex) return 'none';
    return COLOR_NAMES[hex.toLowerCase()] || hex;
  }

  function _updateColorDotLabel(dot, hex) {
    if (!dot) return;
    dot.setAttribute('aria-label', `Color: ${_colorName(hex)}, click to change`);
  }

  const TYPE_HINTS = {
    explicit:    'e.g.  sin(x) * cos(y)',
    parametric:  'x(u,v),  y(u,v),  z(u,v)',
    implicit:    'f(x,y,z) = 0  e.g.  x²+y²+z²-4',
    curve:       'x(t),  y(t),  z(t)',
    polarCurve:  'r = f(theta)  e.g.  1 + cos(theta)   (supports θ too)',
    polar:       'z = f(r, theta)',
    cylindrical: 'z = f(r, theta)  or  r,theta,z',
    spherical:   'r = f(theta, phi)',
    vector:      'Fx(x,y,z),  Fy,  Fz',
    points:      'z = f(x, y)  — renders as dots',
    '2d-line':   'y = mx + c   or   x = k',
  };

  // ── Autocomplete dictionary ────────────────────────────
  const AC_DICT = [
    { label: 'sin(',     type: 'fn',    doc: 'Sine'               },
    { label: 'cos(',     type: 'fn',    doc: 'Cosine'             },
    { label: 'tan(',     type: 'fn',    doc: 'Tangent'            },
    { label: 'asin(',    type: 'fn',    doc: 'Arcsine'            },
    { label: 'acos(',    type: 'fn',    doc: 'Arccosine'          },
    { label: 'atan(',    type: 'fn',    doc: 'Arctangent'         },
    { label: 'atan2(',   type: 'fn',    doc: 'atan2(y, x)'        },
    { label: 'sinh(',    type: 'fn',    doc: 'Hyperbolic sine'    },
    { label: 'cosh(',    type: 'fn',    doc: 'Hyperbolic cosine'  },
    { label: 'tanh(',    type: 'fn',    doc: 'Hyperbolic tangent' },
    { label: 'sqrt(',    type: 'fn',    doc: 'Square root'        },
    { label: 'cbrt(',    type: 'fn',    doc: 'Cube root'          },
    { label: 'pow(',     type: 'fn',    doc: 'pow(base, exp)'     },
    { label: 'exp(',     type: 'fn',    doc: 'e raised to x'      },
    { label: 'log(',     type: 'fn',    doc: 'Natural logarithm'  },
    { label: 'log2(',    type: 'fn',    doc: 'Log base 2'         },
    { label: 'log10(',   type: 'fn',    doc: 'Log base 10'        },
    { label: 'abs(',     type: 'fn',    doc: 'Absolute value'     },
    { label: 'floor(',   type: 'fn',    doc: 'Round down'         },
    { label: 'ceil(',    type: 'fn',    doc: 'Round up'           },
    { label: 'round(',   type: 'fn',    doc: 'Round to nearest'   },
    { label: 'sign(',    type: 'fn',    doc: 'Sign: −1, 0, or 1' },
    { label: 'min(',     type: 'fn',    doc: 'Minimum of args'    },
    { label: 'max(',     type: 'fn',    doc: 'Maximum of args'    },
    { label: 'mod(',     type: 'fn',    doc: 'mod(a, b)'          },
    { label: 'fract(',   type: 'fn',    doc: 'Fractional part'    },
    { label: 'clamp(',   type: 'fn',    doc: 'clamp(x, lo, hi)'  },
    { label: 'dot(',     type: 'fn',    doc: 'Dot product'        },
    { label: 'cross(',   type: 'fn',    doc: 'Cross product'      },
    { label: 'norm(',    type: 'fn',    doc: 'Normalise vector'   },
    { label: 'length(',  type: 'fn',    doc: 'Vector length'      },
    { label: 'PI',       type: 'const', doc: 'π ≈ 3.14159'        },
    { label: 'E',        type: 'const', doc: 'e ≈ 2.71828'        },
    { label: 'Infinity', type: 'const', doc: 'Positive infinity'  },
  ];

  // ── Friendly error translations ────────────────────────
  const FRIENDLY_ERRORS = [
    { test: /unexpected token/i,            msg: 'Unexpected character — check for typos or misplaced symbols.' },
    { test: /undefined variable/i,          msg: 'Unknown variable. Did you mean x, y, z, t, u, or v?'        },
    { test: /division by zero/i,            msg: 'Division by zero — the denominator reaches 0.'               },
    { test: /unexpected end/i,              msg: 'Incomplete expression — something is missing at the end.'    },
    { test: /missing \)/i,                  msg: 'Missing closing parenthesis ).'                               },
    { test: /missing \(/i,                  msg: 'Missing opening parenthesis (.'                               },
    { test: /unmatched/i,                   msg: 'Unmatched bracket — check your parentheses.'                  },
    { test: /unknown function/i,            msg: 'Unknown function — try sin, cos, sqrt, log, etc.'            },
    { test: /too (many|few) arguments/i,    msg: 'Wrong number of arguments for this function.'                },
    { test: /cannot (read|parse)/i,         msg: 'Cannot parse — check for missing operators like * or ^.'     },
    { test: /not a function/i,              msg: 'Not a function. Did you forget parentheses?'                 },
    { test: /is not defined/i,              msg: 'Undefined name — check spelling or add a slider.'            },
    { test: /invalid number/i,              msg: 'Invalid number literal.'                                      },
    { test: /expected.*operator/i,          msg: 'Expected an operator (+, -, *, /) here.'                     },
    { test: /no visible points/i,           msg: 'No visible points for this line — check your coefficients or slider values.' },
    { test: /invalid left.hand side/i,      msg: 'Equations with "=" need everything on one side — try rewriting as f(x,y,z) = 0 form, or contact support if you typed a normal equation.' },
  ];

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _injectStyles();
    _initLiveRegion();
    _initColorPicker();
    _initContextMenu();
    _initAddButton();
    _initKeyboardShortcuts();
    _initSearch();
    _initHistoryPanel();
    _initFavoritesPanel();
    _initBulkActionBar();

    const list = document.getElementById('equation-list');
    if (list) list.setAttribute('role', 'list');
  }

  // ══════════════════════════════════════════════════════
  // LIVE REGION  — screen-reader announcements
  //
  // Sighted users get feedback from the card's red border, a moving
  // list, or a highlighted swatch. Screen-reader users get nothing
  // from any of that unless we say it out loud here.
  // ══════════════════════════════════════════════════════

  function _initLiveRegion() {
    if (document.getElementById('eq-live-region')) return;
    const region = document.createElement('div');
    region.id = 'eq-live-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }

  /**
   * Announce a message to screen readers. Clears first so that two
   * identical consecutive messages (e.g. "Error resolved" twice) are
   * both actually announced, not silently deduped by the AT.
   */
  function _announce(message) {
    const region = document.getElementById('eq-live-region');
    if (!region) return;
    region.textContent = '';
    // A microtask isn't enough for some screen readers to notice the
    // clear-then-set; a short timeout is the reliable, well-known fix.
    setTimeout(() => { region.textContent = message; }, 40);
  }

  // ══════════════════════════════════════════════════════
  // INJECT STYLES
  // ══════════════════════════════════════════════════════

  function _injectStyles() {
    if (document.getElementById('mod-eq-styles')) return;
    const s = document.createElement('style');
    s.id = 'mod-eq-styles';
    s.textContent = `
      /* ── Editor wrap ───────────────────────────────────── */
      .eq-editor-wrap {
        position: relative; flex: 1; min-width: 0; overflow: hidden;
      }
      .eq-input {
        position: relative; z-index: 1;
        background: transparent !important;
        width: 100%; box-sizing: border-box;
      }

      /* ── Syntax-highlight layer ────────────────────────── */
      .eq-highlight-layer {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        z-index: 0; overflow: hidden; white-space: pre;
        pointer-events: none; color: transparent; box-sizing: border-box;
      }
      .eq-hl-fn     { color: #93c5fd; }   /* blue   — functions  */
      .eq-hl-const  { color: #fcd34d; }   /* amber  — constants  */
      .eq-hl-num    { color: #86efac; }   /* green  — numbers    */
      .eq-hl-op     { color: #c084fc; }   /* purple — operators  */
      .eq-hl-var    { color: #e2e8f0; }   /* white  — variables  */
      .eq-hl-paren  { color: #94a3b8; }   /* muted  — brackets   */
      .eq-hl-match  { color: #fbbf24; background: rgba(251,191,36,.18); border-radius: 2px; }
      .eq-hl-err    { color: #fca5a5; text-decoration: underline wavy #ef4444; }
      .eq-hl-ws, .eq-hl-space { color: transparent; }

      /* ── Autocomplete dropdown ─────────────────────────── */
      .eq-autocomplete {
        display: none; position: absolute; top: calc(100% + 3px); left: 0;
        min-width: 220px; max-width: 310px; max-height: 186px; overflow-y: auto;
        background: #1e293b; border: 1px solid #334155; border-radius: 6px;
        box-shadow: 0 8px 28px rgba(0,0,0,.55); z-index: 999;
      }
      .eq-autocomplete.open { display: block; }
      .eq-ac-item {
        display: flex; align-items: center; gap: 8px;
        padding: 5px 10px; cursor: pointer; font-size: 12px;
        transition: background .1s;
      }
      .eq-ac-item:hover, .eq-ac-item.active { background: #334155; }
      .eq-ac-label { font-family: 'Space Mono', monospace; color: #93c5fd; flex: 1; }
      .eq-ac-item[data-type="const"] .eq-ac-label { color: #fcd34d; }
      .eq-ac-doc { color: #64748b; font-size: 11px; flex-shrink: 0; }

      /* ── Search bar ────────────────────────────────────── */
      .eq-search-wrap {
        display: flex; align-items: center; gap: 4px;
        padding: 5px 8px; border-bottom: 1px solid #1e293b;
      }
      .eq-search-input {
        flex: 1; background: #0f172a; border: 1px solid #334155;
        border-radius: 5px; color: #e2e8f0; font-size: 12px;
        padding: 4px 8px; outline: none; transition: border-color .15s;
      }
      .eq-search-input:focus { border-color: #3b82f6; }
      .eq-search-count { color: #475569; font-size: 11px; white-space: nowrap; flex-shrink: 0; }
      .eq-search-clear {
        background: none; border: none; color: #475569;
        cursor: pointer; font-size: 13px; padding: 0 3px; display: none;
      }
      .eq-search-clear.vis { display: block; }
      .eq-card.hidden-by-search { display: none; }

      /* ── Panels (History / Favorites) ──────────────────── */
      .eq-panel {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 340px; max-height: 480px; background: #0f172a;
        border: 1px solid #1e293b; border-radius: 12px;
        box-shadow: 0 24px 48px rgba(0,0,0,.65);
        z-index: 1000; display: none; flex-direction: column; overflow: hidden;
      }
      .eq-panel.open { display: flex; }
      .eq-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; border-bottom: 1px solid #1e293b;
        font-size: 13px; font-weight: 600; color: #e2e8f0; flex-shrink: 0;
      }
      .eq-panel-header-actions { display: flex; align-items: center; gap: 6px; }
      .eq-panel-close, .eq-panel-clear {
        background: none; border: none; cursor: pointer;
        padding: 3px 6px; border-radius: 4px; font-size: 12px;
        transition: color .15s;
      }
      .eq-panel-close { color: #64748b; }
      .eq-panel-close:hover { color: #e2e8f0; }
      .eq-panel-clear { color: #64748b; }
      .eq-panel-clear:hover { color: #f87171; }
      .eq-panel-search-wrap {
        padding: 8px 12px; border-bottom: 1px solid #1e293b; flex-shrink: 0;
      }
      .eq-panel-search-input {
        width: 100%; background: #1e293b; border: 1px solid #334155;
        border-radius: 5px; color: #e2e8f0; font-size: 12px;
        padding: 5px 8px; outline: none; box-sizing: border-box;
        transition: border-color .15s;
      }
      .eq-panel-search-input:focus { border-color: #3b82f6; }
      .eq-panel-body { overflow-y: auto; flex: 1; padding: 6px; }
      .eq-panel-item {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 10px; border-radius: 6px; cursor: pointer;
        transition: background .1s; font-size: 12px;
      }
      .eq-panel-item:hover { background: #1e293b; }
      .eq-panel-expr {
        font-family: 'Space Mono', monospace; color: #93c5fd; flex: 1;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .eq-panel-meta { color: #475569; font-size: 10px; flex-shrink: 0; }
      .eq-panel-empty {
        text-align: center; color: #475569;
        padding: 32px 16px; font-size: 13px; line-height: 1.6;
      }
      .eq-panel-item-del {
        background: none; border: none; color: #475569; cursor: pointer;
        padding: 1px 4px; border-radius: 3px; font-size: 13px;
        opacity: 0; transition: opacity .1s, color .1s; flex-shrink: 0;
      }
      .eq-panel-item:hover .eq-panel-item-del { opacity: 1; }
      .eq-panel-item-del:hover { color: #f87171; }

      /* ── Favorite (star) button ────────────────────────── */
      .eq-fav-btn.starred i,
      .eq-fav-btn.starred svg { color: #fbbf24 !important; fill: #fbbf24 !important; }

      /* ── Extend-to-3D row (2D Line equations) ──────────── */
      .eq-extend3d-row { padding: 2px 0 4px 34px; }
      .eq-extend3d-label {
        display: inline-flex; align-items: center; gap: 6px;
        color: #94a3b8; font-size: 11px; cursor: pointer; user-select: none;
        transition: color .12s;
      }
      .eq-extend3d-label:hover { color: #e2e8f0; }
      .eq-extend3d-label input[type="checkbox"] { accent-color: #3b82f6; cursor: pointer; }

      /* ── Screen-reader-only live region ────────────────── */
      .sr-only {
        position: absolute; width: 1px; height: 1px;
        padding: 0; margin: -1px; overflow: hidden;
        clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
      }

      /* ── Multi-select ───────────────────────────────────── */
      .eq-card.selected {
        outline: 2px solid #3b82f6;
        outline-offset: -1px;
        background: rgba(59, 130, 246, 0.08);
      }

      /* ── Bulk action bar ────────────────────────────────── */
      .eq-bulk-bar {
        display: none; align-items: center; gap: 8px; flex-wrap: wrap;
        padding: 8px; background: #1e293b; border-bottom: 1px solid #334155;
      }
      .eq-bulk-bar.open { display: flex; }
      .eq-bulk-count { color: #e2e8f0; font-size: 12px; font-weight: 600; margin-right: 4px; }
      .eq-bulk-btn {
        background: #334155; border: none; color: #e2e8f0; border-radius: 6px;
        padding: 5px 11px; font-size: 12px; cursor: pointer; transition: background .12s;
      }
      .eq-bulk-btn:hover { background: #475569; }
      .eq-bulk-btn.danger { background: #7f1d1d; color: #fecaca; }
      .eq-bulk-btn.danger:hover { background: #991b1b; }
      .eq-bulk-clear {
        margin-left: auto; background: none; border: none; color: #64748b;
        cursor: pointer; font-size: 12px; padding: 5px 8px;
      }
      .eq-bulk-clear:hover { color: #e2e8f0; }

      /* ── Color picker — keyboard focus ─────────────────── */
      .color-swatch:focus, .color-swatch:focus-visible {
        outline: 2px solid #e2e8f0; outline-offset: 2px;
      }
      .color-swatch[aria-selected="true"] {
        box-shadow: 0 0 0 2px #0f172a, 0 0 0 4px #3b82f6;
      }

      /* ── Group headers ──────────────────────────────────── */
      .eq-group-header {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 10px; margin-top: 4px;
        background: #1a2436; border-radius: 6px; cursor: pointer;
        user-select: none;
      }
      .eq-group-header:hover { background: #202c42; }
      .eq-group-chevron {
        transition: transform .15s; color: #94a3b8; flex-shrink: 0;
        display: inline-flex;
      }
      .eq-group-header.collapsed .eq-group-chevron { transform: rotate(-90deg); }
      .eq-group-name {
        color: #e2e8f0; font-size: 12px; font-weight: 600; flex: 1;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .eq-group-count { color: #64748b; font-size: 11px; flex-shrink: 0; }
      .eq-group-delete {
        background: none; border: none; color: #475569; cursor: pointer;
        padding: 2px 5px; border-radius: 4px; font-size: 12px; flex-shrink: 0;
      }
      .eq-group-delete:hover { color: #f87171; }
      .eq-card.grouped { margin-left: 14px; }

      /* ── Mobile ───────────────────────────────────────────
         Two real bugs, not just polish: (1) .eq-panel is a fixed
         340px-wide centered modal — on a 320-375px-wide phone that
         overflows the viewport edges. (2) .eq-panel-item-del only
         reveals on :hover, which never fires on touch, so the delete
         button is permanently invisible (and effectively unusable)
         on any touch device. */
      @media (max-width: 640px) {
        .eq-panel { width: calc(100vw - 32px); max-height: 75vh; }
      }
      @media (hover: none) and (pointer: coarse) {
        .eq-panel-item-del { opacity: 1; }
      }
    `;
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════
  // ADD EQUATION
  // ══════════════════════════════════════════════════════

  function addEquation(opts = {}) {
    const id = 'eq-' + (++_idCounter);
    const eq = {
      id,
      expr:    opts.expr || opts.expression || '',
      type:    opts.type    || 'explicit',
      color:   opts.color   || Engine.nextColor(),
      visible: opts.visible !== false,
      locked:  opts.locked  || false,
      label:   opts.label   || '',
      uMin: opts.uMin ?? 0,
      uMax: opts.uMax ?? (Math.PI * 2),
      vMin: opts.vMin ?? 0,
      vMax: opts.vMax ?? Math.PI,
      tMin: opts.tMin ?? (-Math.PI * 3),
      tMax: opts.tMax ?? (Math.PI * 3),
      extendTo3D: opts.extendTo3D || false,
      groupId: opts.groupId ?? null,
    };

    _promoteTypeIfLinear(eq); // e.g. loading a saved/history/AI-generated "y = 2x + 5"
    _promoteTypeIfImplicit(eq); // e.g. loading "sin(x)+cos(y)+sin(z) = 0"

    _equations.push(eq);
    _pushHistory('add', { eq: { ...eq } });

    const card = _buildCard(eq);
    document.getElementById('equation-list').appendChild(card);

    if (window.lucide) lucide.createIcons({ nodes: [card] });

    if (eq.expr) {
      _scheduleRebuild(eq, card, 80);
      if (eq.type !== '2d-line') _checkAutoSliders(eq); // 2D lines auto-slider inside _rebuildEquation
    } else {
      card.querySelector('.eq-input')?.focus();
    }

    _syncCount();
    _updateSearchVisibility();
    _repositionGroupHeaders();
    _announce('Equation added');
    return eq;
  }

  // ══════════════════════════════════════════════════════
  // BUILD CARD DOM
  // ══════════════════════════════════════════════════════

  function _buildCard(eq) {
    const tpl  = document.getElementById('eq-card-template');
    const frag = tpl ? tpl.content.cloneNode(true) : _buildCardFallback(eq);

    const card = frag.nodeType === 11
      ? frag.querySelector('.eq-card')
      : frag;

    card.dataset.id = eq.id;
    card.id = eq.id;
    card.setAttribute('role', 'listitem');
    if (eq.locked) card.classList.add('locked');

    // Color dot
    const dot = card.querySelector('.eq-color-dot');
    if (dot) {
      dot.style.background = eq.color;
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      _updateColorDotLabel(dot, eq.color);
      dot.addEventListener('click', e => {
        e.stopPropagation();
        _openColorPicker([eq], dot);
      });
      dot.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          _openColorPicker([eq], dot);
        }
      });
    }

    // ── Core editor elements ──
    const input = card.querySelector('.eq-input');
    const hlDiv = card.querySelector('.eq-highlight-layer');
    const acDiv = card.querySelector('.eq-autocomplete');

    if (!input) return card;

    input.value       = eq.expr;
    input.placeholder = TYPE_HINTS[eq.type] || TYPE_HINTS.explicit;
    if (eq.locked) input.readOnly = true;

    // Wire the error text to the input for screen readers — a field-level
    // description is announced automatically when focus lands on the input,
    // independent of the live-region announcement fired at the moment the
    // error first appears.
    const errElForAria = card.querySelector('.eq-error-text');
    if (errElForAria) {
      errElForAria.id = errElForAria.id || (eq.id + '-error');
      input.setAttribute('aria-describedby', errElForAria.id);
    }
    input.setAttribute('aria-invalid', 'false');

    // Sync highlight-layer font metrics once in DOM
    if (hlDiv) requestAnimationFrame(() => _syncHLStyle(input, hlDiv));

    // Track previous expression for undo/redo
    let _prevExpr = eq.expr;

    input.addEventListener('focus', () => {
      _prevExpr = eq.expr;
    });

    input.addEventListener('blur', () => {
      if (acDiv) _hideAutocomplete(acDiv);
      if (eq.expr !== _prevExpr) {
        _pushHistory('edit', { id: eq.id, prevExpr: _prevExpr, nextExpr: eq.expr });
        _prevExpr = eq.expr;
      }
      _autoColorInput(input, !card.classList.contains('has-error'));
    });

    // Main input — real-time parsing, highlighting, autocomplete
    input.addEventListener('input', () => {
      eq.expr = input.value;

      // Detect "y = mx + c" / "x = k" style input and switch to the 2D Line type
      if (_promoteTypeIfLinear(eq)) {
        _syncTypeUI(eq, card);
        if (window.ModToast) ModToast.show('Detected a 2D line — switched to 2D Line type', 'info');
      }

      // Detect "z = <expr with z>" / "f(x,y) = <expr with z>" / "<expr> = <expr>"
      // and switch to Implicit. Keep the reason — it's what lets the AI give an
      // equation-specific explanation instead of a generic one, once the user
      // actually pauses typing (see the debounced block below).
      const implicitReason = _promoteTypeIfImplicit(eq);
      if (implicitReason) {
        _syncTypeUI(eq, card);
        if (window.ModToast) ModToast.show('Detected an implicit equation — switched to Implicit type', 'info');
        _announce('Detected an implicit equation — switched to Implicit type');
      }

      _autoColorInput(input, false);
      if (hlDiv) requestAnimationFrame(() => _refreshHL(input, hlDiv));
      if (acDiv) _showAutocomplete(input, acDiv);

      clearTimeout(_debounceTimers[eq.id]);
      _debounceTimers[eq.id] = setTimeout(() => {
        const buildErr = _rebuildEquation(eq, card);
        if (eq.type !== '2d-line') _checkAutoSliders(eq); // 2D lines auto-slider inside _rebuildEquation

        // Proactive, equation-specific AI explanation (PART 3.6 item 3) —
        // only once the user has paused typing AND the equation actually
        // built without error, so we're not interrupting active typing or
        // explaining a promotion for an equation that still has a typo.
        if (implicitReason && !buildErr && window.ModAI && typeof ModAI.explainAutoPromotion === 'function') {
          ModAI.explainAutoPromotion(eq, implicitReason);
        }
      }, 360);
    });

    // Scroll sync between input and highlight layer
    if (hlDiv) {
      input.addEventListener('scroll', () => { hlDiv.scrollLeft = input.scrollLeft; });
    }

    // Keyboard handling
    input.addEventListener('keydown', e => {
      // ── Autocomplete navigation ──
      if (acDiv?.classList.contains('open')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); _navigateAC(acDiv,  1); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); _navigateAC(acDiv, -1); return; }
        if (e.key === 'Tab' || (e.key === 'Enter' && acDiv.querySelector('.eq-ac-item.active'))) {
          e.preventDefault();
          _acceptAC(input, acDiv);
          return;
        }
        if (e.key === 'Escape') { _hideAutocomplete(acDiv); return; }
      }

      // ── Format: Ctrl/Cmd + Shift + F ──
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        _applyFormat(eq, card, input, hlDiv);
        return;
      }

      // ── Immediate rebuild on Enter ──
      if (e.key === 'Enter' && !acDiv?.classList.contains('open')) {
        clearTimeout(_debounceTimers[eq.id]);
        _rebuildEquation(eq, card);
      }

      if (e.key === 'Escape') input.blur();

      // Keep Ctrl+Z/Y scoped to the input (not global undo)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
        e.stopPropagation();
      }
    });

    // Bracket match highlight on cursor movement
    if (hlDiv) {
      ['click', 'keyup'].forEach(ev => {
        input.addEventListener(ev, () => _refreshHL(input, hlDiv));
      });
    }

    // Type selector
    const sel = card.querySelector('.eq-type-select');
    if (sel) {
      _ensureTypeOption(sel, '2d-line', '2D Line');
      sel.value = eq.type;
      sel.addEventListener('change', () => {
        eq.type = sel.value;
        input.placeholder = TYPE_HINTS[eq.type] || TYPE_HINTS.explicit;
        _toggleExtend3DVisibility(card, eq.type === '2d-line');
        _rebuildEquation(eq, card);
      });
    }

    // ── Extend-to-3D checkbox (2D Line equations only) ──
    const extendRow = _ensureExtend3DRow(card);
    const extendChk = extendRow.querySelector('.eq-extend3d-checkbox');
    if (extendChk) {
      extendChk.checked = !!eq.extendTo3D;
      extendChk.addEventListener('change', () => {
        eq.extendTo3D = extendChk.checked;
        _rebuildEquation(eq, card);
      });
    }
    _syncTypeUI(eq, card);

    // Visibility toggle
    const visChk = card.querySelector('.eq-visible-checkbox');
    if (visChk) {
      visChk.checked = eq.visible;
      visChk.addEventListener('change', () => {
        eq.visible = visChk.checked;
        card.style.opacity = eq.visible ? '1' : '0.45';
        _rebuildEquation(eq, card);
      });
    }

    // More options button
    const moreBtn = card.querySelector('.eq-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', e => {
        e.stopPropagation();
        _openContextMenu(eq, e);
      });
    }

    // Delete button
    const delBtn = card.querySelector('.eq-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => _deleteEquation(eq.id));
    }

    // ── Favorite button ──
    const favBtn = card.querySelector('.eq-fav-btn');
    if (favBtn) {
      _updateFavBtn(favBtn, eq.expr, eq.type);
      favBtn.addEventListener('click', () => {
        const starred = toggleFavorite(eq.expr, eq.type);
        _updateFavBtn(favBtn, eq.expr, eq.type);
        if (window.ModToast) ModToast.show(starred ? 'Added to favorites' : 'Removed from favorites', 'info');
      });
    }

    // ── Format button ──
    const fmtBtn = card.querySelector('.eq-fmt-btn');
    if (fmtBtn) {
      fmtBtn.addEventListener('click', () => _applyFormat(eq, card, input, hlDiv));
    }

    // Right-click context menu
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      _openContextMenu(eq, e);
    });

    // Multi-select: ctrl/cmd-click toggles, shift-click selects a range.
    // Bails out immediately if the click landed on an actual control —
    // editing, buttons, checkboxes, the select, etc. all work exactly
    // as before, untouched.
    card.addEventListener('click', e => {
      if (e.target.closest('.eq-input, button, select, input, a, .eq-color-dot')) return;
      if (e.ctrlKey || e.metaKey) {
        _toggleSelect(eq.id);
        e.preventDefault();
      } else if (e.shiftKey && _lastSelectedId) {
        _selectRange(_lastSelectedId, eq.id);
        e.preventDefault();
      } else if (_selectedIds.size > 0) {
        // Plain click while a selection is active clears it — standard
        // "click empty space to deselect" behavior.
        _clearSelection();
      }
    });

    // Drag-to-reorder
    card.draggable = true;
    card.addEventListener('dragstart', e => _onDragStart(e, eq.id));
    card.addEventListener('dragover',  e => _onDragOver(e));
    card.addEventListener('drop',      e => _onDrop(e, eq.id));

    return card;
  }

  // Fallback card builder when no <template> is in DOM
  function _buildCardFallback(eq) {
    const card = document.createElement('div');
    card.className = 'eq-card';
    card.innerHTML = `
      <div class="eq-row-1">
        <div class="eq-color-dot"></div>
        <div class="eq-editor-wrap">
          <div class="eq-highlight-layer" aria-hidden="true"></div>
          <input class="eq-input" type="text" spellcheck="false"
                 autocomplete="off" autocorrect="off" autocapitalize="off"/>
          <div class="eq-autocomplete" role="listbox" aria-label="Suggestions"></div>
        </div>
        <div style="display:flex;gap:2px;flex-shrink:0;align-items:center">
          <button class="eq-icon-btn eq-fav-btn" title="Add to favorites">
            <i data-lucide="star" width="11" height="11"></i>
          </button>
          <button class="eq-icon-btn eq-fmt-btn" title="Format expression  (Ctrl+Shift+F)">
            <i data-lucide="wand-2" width="11" height="11"></i>
          </button>
          <button class="eq-icon-btn eq-more-btn" title="More options">
            <i data-lucide="more-horizontal" width="11" height="11"></i>
          </button>
          <button class="eq-icon-btn delete eq-delete-btn" title="Delete equation">
            <i data-lucide="x" width="11" height="11"></i>
          </button>
        </div>
      </div>
      <div class="eq-extend3d-row" style="display:none;">
        <label class="eq-extend3d-label">
          <input class="eq-extend3d-checkbox" type="checkbox"/>
          <span>Extend to 3D</span>
        </label>
      </div>
      <div class="eq-row-2">
        <select class="eq-type-select" aria-label="Equation type">
          <option value="explicit">z = f(x,y)</option>
          <option value="2d-line">2D Line</option>
          <option value="parametric">Parametric</option>
          <option value="implicit">Implicit</option>
          <option value="curve">Space Curve</option>
          <option value="polarCurve">Polar Curve (2D)</option>
          <option value="polar">Polar</option>
          <option value="cylindrical">Cylindrical</option>
          <option value="spherical">Spherical</option>
          <option value="vector">Vector Field</option>
          <option value="points">Point Cloud</option>
        </select>
        <label class="eq-visible-label">
          <input class="eq-visible-checkbox" type="checkbox" checked/>
          <span>Visible</span>
        </label>
      </div>
      <div class="eq-error-text"></div>
    `;
    return card;
  }

  // ══════════════════════════════════════════════════════
  // 2D LINEAR EQUATIONS  — y = mx + c,  x = k
  //
  // These are handled as a distinct user-facing type ('2d-line')
  // but are translated into the EXISTING 'curve' (flat, z=0) or
  // 'implicit' (extended vertical plane) types before being handed
  // to GraphBuilder — so graph generation and rendering logic are
  // never touched, and the equation always has visible points.
  // ══════════════════════════════════════════════════════

  const LINEAR_RESERVED_VARS = new Set(['x', 'y', 'z', 't', 'u', 'v', 'pi', 'e']);

  /** Parse "y = mx + c" / "y = 2x + 5" / "x = 4" / "x = -2" etc. Returns null if not a line. */
  function _parseLinearEquation(rawExpr) {
    if (!rawExpr) return null;
    const s = rawExpr.replace(/\s+/g, '');
    if (!s) return null;

    // Vertical line:  x = k
    const vMatch = s.match(/^x=([+-]?(?:\d+\.?\d*|[a-zA-Z]\w*))$/i);
    if (vMatch) {
      const kExpr = vMatch[1];
      const vars = [_identifyLinearVar(kExpr)].filter(Boolean);
      return { kind: 'vertical', kExpr, vars };
    }

    // Slope-intercept line:  y = mx + c  /  y = -mx + c  /  y = 0.5x - 3  /  y = x
    const sMatch = s.match(/^y=([+-]?(?:\d+\.?\d*|[a-zA-Z]\w*)?\*?x)([+-](?:\d+\.?\d*|[a-zA-Z]\w*))?$/i);
    if (sMatch) {
      const slopeExpr     = _extractSlopeTerm(sMatch[1]);
      const interceptExpr = _extractInterceptTerm(sMatch[2]);
      const vars = [_identifyLinearVar(slopeExpr), _identifyLinearVar(interceptExpr)].filter(Boolean);
      return { kind: 'slope', slopeExpr, interceptExpr, vars };
    }

    return null;
  }

  /** "mx" / "-mx" / "2x" / "-x" / "0.5x" / "2*x" → coefficient expression string, e.g. "m", "-m", "2", "-1", "0.5" */
  function _extractSlopeTerm(g1) {
    let s = g1;
    let sign = '';
    if (s[0] === '+' || s[0] === '-') { sign = s[0]; s = s.slice(1); }
    s = s.replace(/\*?x$/i, '');
    if (s === '') s = '1'; // bare "x" or "-x" implies a coefficient of magnitude 1
    return sign === '-' ? ('-' + s) : s;
  }

  /** "+c" / "-3" / "+5" / undefined → intercept expression string, e.g. "c", "-3", "5", "0" */
  function _extractInterceptTerm(g2) {
    if (!g2) return '0';
    const sign = g2[0];
    const val  = g2.slice(1);
    return sign === '-' ? ('-' + val) : val;
  }

  /** Returns the bare variable name if termExpr is a slider-style identifier (e.g. "m", "-c"), else null. */
  function _identifyLinearVar(termExpr) {
    if (!termExpr) return null;
    const s = termExpr.startsWith('-') ? termExpr.slice(1) : termExpr;
    if (!/^[a-zA-Z]\w*$/.test(s)) return null; // pure number, not an identifier
    const lower = s.toLowerCase();
    if (LINEAR_RESERVED_VARS.has(lower)) return null;
    if (_HL_FUNCTIONS.has(s) || _HL_FUNCTIONS.has(lower)) return null; // e.g. don't slider-ify "sin"
    return s;
  }

  /** Auto-create a slider (default value 1) for any detected variable that doesn't exist yet. */
  function _autoCreateSlidersForVars(vars) {
    if (!ModSliders || !vars || !vars.length) return;
    vars.forEach(name => {
      if (!ModSliders.has(name)) {
        ModSliders.addSlider(name, 1);
        if (window.ModToast) ModToast.show('Auto-created slider: ' + name, 'info');
      }
    });
  }

  /**
   * Translate a parsed line into an EXISTING equation type GraphBuilder already
   * knows how to render:
   *   - flat (extendTo3D=false): a 'curve' lying in the z=0 plane
   *   - extended (extendTo3D=true): an 'implicit' vertical plane through all z
   */
  function _translateLinearForBuild(parsed, extendTo3D) {
    if (parsed.kind === 'vertical') {
      return extendTo3D
        ? { type: 'implicit', expr: `x-(${parsed.kExpr})` }
        : { type: 'curve',    expr: `${parsed.kExpr}, t, 0` };
    }
    return extendTo3D
      ? { type: 'implicit', expr: `y-(${parsed.slopeExpr})*x-(${parsed.interceptExpr})` }
      : { type: 'curve',    expr: `t, (${parsed.slopeExpr})*t+(${parsed.interceptExpr}), 0` };
  }

  /**
   * If eq is still on the default 'explicit' type and its expression looks like
   * a 2D line, promote it to the '2d-line' type. Pure data mutation — no DOM
   * access — so it's safe to call before a card even exists (e.g. in addEquation).
   * Returns true if a promotion happened.
   */
  function _promoteTypeIfLinear(eq) {
    if (!eq || eq.type !== 'explicit') return false;
    if (!eq.expr || !eq.expr.trim()) return false;
    const parsed = _parseLinearEquation(eq.expr);
    if (!parsed) return false;
    eq.type = '2d-line';
    eq.tMin = -20;
    eq.tMax = 20;
    return true;
  }

  /** Make sure a <select> has the "2D Line" option, regardless of where the card markup came from. */
  function _ensureTypeOption(select, value, label) {
    if (!select) return;
    if (select.querySelector(`option[value="${value}"]`)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  /** Make sure the card has an "Extend to 3D" row directly under the equation input. */
  function _ensureExtend3DRow(card) {
    let row = card.querySelector('.eq-extend3d-row');
    if (row) return row;

    row = document.createElement('div');
    row.className = 'eq-extend3d-row';
    row.style.display = 'none';
    row.innerHTML = `
      <label class="eq-extend3d-label">
        <input class="eq-extend3d-checkbox" type="checkbox"/>
        <span>Extend to 3D</span>
      </label>
    `;

    const row1 = card.querySelector('.eq-row-1');
    if (row1 && row1.parentElement) {
      row1.parentElement.insertBefore(row, row1.nextSibling);
    } else {
      card.appendChild(row);
    }
    return row;
  }

  function _toggleExtend3DVisibility(card, show) {
    const row = card.querySelector('.eq-extend3d-row');
    if (row) row.style.display = show ? 'flex' : 'none';
  }

  /** Sync the type dropdown, placeholder, and Extend-to-3D visibility with eq.type. */
  function _syncTypeUI(eq, card) {
    const sel   = card.querySelector('.eq-type-select');
    const input = card.querySelector('.eq-input');
    if (sel) {
      _ensureTypeOption(sel, '2d-line', '2D Line');
      sel.value = eq.type;
    }
    if (input) input.placeholder = TYPE_HINTS[eq.type] || TYPE_HINTS.explicit;
    _toggleExtend3DVisibility(card, eq.type === '2d-line');
  }

  // ══════════════════════════════════════════════════════
  // IMPLICIT EQUATIONS  — "LHS = RHS" normalization
  //
  // Root cause of both reported bugs: this file only ever passed eq.expr
  // straight through to MathEngine/GraphBuilder, completely unmodified.
  // Neither "z = <expr with z>" nor "<expr> = <expr>" was ever split or
  // routed to the implicit pipeline — everything stayed on whatever type
  // was already selected (almost always 'explicit', the default), and
  // 'explicit' has no notion of a right-hand-side "=" at all.
  //
  // Fix: detect these shapes, normalize LHS = RHS into LHS - (RHS) — the
  // same bare f(x,y,z) form the EXISTING, already-working implicit
  // examples use (e.g. "x^2+y^2+z^2-4") — and route through the implicit
  // type. GraphBuilder itself is untouched; it only ever sees a form it
  // already knows how to handle.
  // ══════════════════════════════════════════════════════

  /**
   * Strip a trailing Desmos-style domain restriction like "{z<2}" or
   * "{x>0}" from the END of an expression, for classification purposes
   * only. Does NOT mutate eq.expr (the user still sees exactly what they
   * typed) — this just prevents an "=" inside the restriction itself
   * (Desmos's own example syntax is "{z=3}"!) from confusing the
   * implicit-equation detector below.
   */
  function _stripTrailingDomainClause(expr) {
    const m = expr.match(/^(.*?)\s*\{[^}]*\}\s*$/);
    return m ? m[1].trim() : expr;
  }

  /**
   * Full split of expr into { core, restriction }. restriction is null if
   * there's no trailing {...} clause. Parsing/storage only for now — see
   * the note on domainRestriction in _rebuildEquation for what's still
   * needed on the GraphBuilder side before this has any visual effect.
   */
  function _extractDomainRestriction(expr) {
    const m = expr.match(/^(.*?)\s*\{\s*([^}]+?)\s*\}\s*$/);
    if (!m) return { core: expr, restriction: null };
    return { core: m[1].trim(), restriction: m[2].trim() };
  }

  /**
   * Index of the first "=" that's a genuine equation separator — not part
   * of ==, <=, >=, or != . Returns -1 if there's no such "=" in expr.
   */
  function _findTopLevelEquals(expr) {
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] !== '=') continue;
      const prev = expr[i - 1];
      const next = expr[i + 1];
      if (prev === '=' || prev === '<' || prev === '>' || prev === '!') continue;
      if (next === '=') continue;
      return i;
    }
    return -1;
  }

  /** True if varName appears as a standalone identifier token in expr (reuses the existing tokenizer, so "z" inside "size" is correctly ignored). */
  function _hasFreeVariable(expr, varName) {
    if (!expr) return false;
    const target = varName.toLowerCase();
    return _tokenize(expr).some(t => t.type === 'var' && t.value.toLowerCase() === target);
  }

  /**
   * Recognizes "z = ..." and "f(x,y) = ..." as equivalent — both are just
   * ways of labeling "the dependent variable is z" (the f(x,y)= habit is
   * common coming from textbooks/Desmos). Returns { rhs } if expr starts
   * with either prefix, else null (meaning: check the general LHS=RHS
   * case instead).
   */
  function _matchExplicitPrefix(expr) {
    let m = expr.match(/^z\s*=\s*(.+)$/i);
    if (m) return { rhs: m[1].trim() };
    m = expr.match(/^f\s*\(\s*x\s*,\s*y\s*\)\s*=\s*(.+)$/i);
    if (m) return { rhs: m[1].trim() };
    return null;
  }

  /** Strip a "f(x,y) = " labeling prefix for BUILD purposes on plain
   *  (non-recurring-z) explicit equations — the existing pipeline already
   *  knows how to handle a bare expression or a "z = " prefix, but not
   *  this alias, so it needs stripping here rather than left to whatever
   *  already-working "z=" handling GraphBuilder has. No-op otherwise. */
  function _stripFxyPrefix(expr) {
    const m = expr.match(/^\s*f\s*\(\s*x\s*,\s*y\s*\)\s*=\s*(.+)$/i);
    return m ? m[1].trim() : expr;
  }

  /**
   * Turn "LHS = RHS" into the bare implicit form "(LHS)-(RHS)". A no-op
   * (returns expr unchanged) if there's no top-level "=" — so the existing,
   * already-working bare form like "x^2+y^2+z^2-4" is completely unaffected.
   * Understands the "z=" / "f(x,y)=" aliasing too, using the literal "z"
   * as the placeholder rather than the label text (so "f(x,y) = ...sin(z)"
   * normalizes against z, not against the meaningless identifier "f").
   */
  function _normalizeImplicitExpr(rawExpr) {
    const { core } = _extractDomainRestriction(rawExpr);

    const prefixMatch = _matchExplicitPrefix(core);
    if (prefixMatch) return `z-(${prefixMatch.rhs})`;

    const idx = _findTopLevelEquals(core);
    if (idx === -1) return core;
    const lhs = core.slice(0, idx).trim();
    const rhs = core.slice(idx + 1).trim();
    if (!lhs || !rhs) return core; // malformed — let MathEngine.validate report it normally
    return `(${lhs})-(${rhs})`;
  }

  /**
   * If eq is still on the default 'explicit' type but its expression is
   * really an implicit equation, promote it to 'implicit'. Two shapes:
   *   (a) "z = <expr with z>" / "f(x,y) = <expr with z>" — self-referential,
   *       not true z=f(x,y)
   *   (b) "<anything> = <anything>"                       — general
   *       equation, LHS need not be a single variable
   * Plain "z = sin(x)+cos(y)" (no recurring z) is deliberately left alone —
   * that's ordinary explicit behavior and must keep working exactly as
   * before. 2D-line patterns ("y=mx+c", "x=k") are also left to their own
   * detector so the two don't fight over the same input. A trailing domain
   * restriction like "{z<2}" is ignored for classification (see
   * _stripTrailingDomainClause) so Desmos's own "{z=3}" example syntax
   * can't be misread as a second equation.
   *
   * Returns a reason string ('self-referential-z' | 'general-equation') if
   * it promoted, or null if it left the equation alone — the reason is
   * what lets the AI assistant give an equation-specific explanation
   * instead of a generic one (see ModAI.explainAutoPromotion).
   */
  function _promoteTypeIfImplicit(eq) {
    if (!eq || eq.type !== 'explicit') return null;
    if (!eq.expr || !eq.expr.trim()) return null;
    if (_parseLinearEquation(eq.expr)) return null; // let the 2D-line detector own that shape

    const core = _stripTrailingDomainClause(eq.expr);

    const prefixMatch = _matchExplicitPrefix(core);
    if (prefixMatch) {
      if (!_hasFreeVariable(prefixMatch.rhs, 'z')) return null; // ordinary explicit surface, untouched
      eq.type = 'implicit';
      return 'self-referential-z';
    }

    const idx = _findTopLevelEquals(core);
    if (idx === -1) return null; // no "=" at all — ordinary bare expression, untouched

    const lhs = core.slice(0, idx).trim();
    const rhs = core.slice(idx + 1).trim();
    if (!lhs || !rhs) return null;

    eq.type = 'implicit';
    return 'general-equation';
  }

  // ══════════════════════════════════════════════════════
  // REBUILD / RENDER  — live graph updates
  // ══════════════════════════════════════════════════════

  function _rebuildEquation(eq, card) {
    if (eq.locked) return;

    // A slow async isosurface/implicit-surface build from a *previous*
    // version of this equation could still be in flight. Invalidating its
    // generation here — before this attempt's outcome (success, parse
    // error, or emptied expression) is even known — means it can never
    // land after this rebuild and silently resurrect a stale mesh, no
    // matter which branch below ends up running.
    GraphBuilder.forgetEquation(eq.id);

    let err = null;

    if (eq.expr.trim()) {
      if (eq.type === '2d-line') {
        // ── 2D Line: translate to an existing supported type before building ──
        const parsed = _parseLinearEquation(eq.expr);
        if (!parsed) {
          err = 'Enter a line like y = mx + c, y = 2x + 5, or x = 4';
          Engine.removeMesh(eq.id);
        } else {
          _autoCreateSlidersForVars(parsed.vars);
          const translated = _translateLinearForBuild(parsed, eq.extendTo3D);
          const buildEq     = { ...eq, type: translated.type, expr: translated.expr };
          const sliders      = ModSliders ? ModSliders.getValues() : {};
          try {
            const mesh = GraphBuilder.build(buildEq, sliders);
            Engine.addMesh(eq.id, mesh);
            _addToHistory(eq.expr, eq.type); // record the original "y = mx + c" form
          } catch (e) {
            err = e.message;
            Engine.removeMesh(eq.id);
          }
        }
      } else if (eq.type === 'implicit') {
        // ── Implicit surface: normalize "LHS = RHS" into "(LHS)-(RHS)"
        // before building. A no-op for the already-working bare form
        // (e.g. "x^2+y^2+z^2-4"), so nothing here changes for equations
        // that never had an "=" sign in the first place.
        //
        // Domain restriction ({z<2}-style, PART 3.6 item 4): extracted and
        // stored on eq.domainRestriction so GraphBuilder CAN consume it —
        // but as of this file, nothing downstream reads that field yet.
        // This is parsing/storage only; the actual visual slicing needs a
        // matching change in graph-builder.js (outside this file's scope).
        const { restriction } = _extractDomainRestriction(eq.expr);
        eq.domainRestriction = restriction;

        const normalizedExpr = _normalizeImplicitExpr(eq.expr);
        const sliders = ModSliders ? ModSliders.getValues() : {};
        const validation = MathEngine.validate(normalizedExpr);
        if (!validation.ok) {
          err = validation.error;
        } else {
          try {
            const buildEq = { ...eq, expr: normalizedExpr, domainRestriction: restriction };
            const mesh = GraphBuilder.build(buildEq, sliders);
            Engine.addMesh(eq.id, mesh);
            _addToHistory(eq.expr, eq.type); // record the equation as the user typed it
          } catch (e) {
            err = e.message;
            Engine.removeMesh(eq.id);
          }
        }
      } else {
        // ── All other types — unchanged existing behavior, plus a small
        // build-time-only translation for explicit's "f(x,y) = " labeling
        // habit (the existing pipeline already strips a bare "z = " prefix
        // successfully; "f(x,y) = " is a new alias that needs stripping
        // here instead, so it doesn't regress the already-working case).
        const sliders = ModSliders ? ModSliders.getValues() : {};
        let restriction = null;
        let exprForBuild = eq.expr;

        if (eq.type === 'explicit') {
          const extracted = _extractDomainRestriction(eq.expr);
          restriction  = extracted.restriction;
          eq.domainRestriction = restriction;
          exprForBuild = _stripFxyPrefix(extracted.core);
        }

        const validation = MathEngine.validate(exprForBuild);
        if (!validation.ok) {
          err = validation.error;
        } else {
          try {
            const buildEq = (exprForBuild === eq.expr && restriction === null)
              ? eq
              : { ...eq, expr: exprForBuild, domainRestriction: restriction };
            const mesh = GraphBuilder.build(buildEq, sliders);
            Engine.addMesh(eq.id, mesh);
            _addToHistory(eq.expr, eq.type); // record on success
          } catch (e) {
            err = e.message;
            Engine.removeMesh(eq.id);
          }
        }
      }
    } else {
      Engine.removeMesh(eq.id);
    }

    _setCardError(card, err);
    return err;
  }

  function _scheduleRebuild(eq, card, delay = 360) {
    clearTimeout(_debounceTimers[eq.id]);
    _debounceTimers[eq.id] = setTimeout(() => _rebuildEquation(eq, card), delay);
  }

  function rebuildAll() {
    _equations.forEach(eq => {
      const card = _getCard(eq.id);
      if (card) _rebuildEquation(eq, card);
    });
  }

  // Like rebuildAll(), but skips any equation whose expression doesn't
  // reference one of the given variable names. Used by the slider
  // animation loop (mod-sliders.js's _tick(), which runs every frame)
  // instead of rebuildAll() — rebuilding every equation on the graph 60
  // times a second regardless of whether it actually depends on the
  // animating slider(s) was the root cause of the whole app hanging as
  // soon as "Animate" was pressed, especially with implicit/isosurface
  // equations in the mix (marching cubes is not a cheap thing to redo
  // every frame for equations that never changed).
  //
  // Recomputed fresh from eq.expr on every call rather than cached on
  // the equation object — caching "which vars does this equation use"
  // would need active invalidation on every edit to avoid going stale,
  // which is exactly the class of bug fixed elsewhere this session
  // (forgetEquation()). A text-parse is cheap next to a geometry
  // rebuild, so there's no real performance reason to cache it either.
  function rebuildForChangedVars(varNames) {
    if (!varNames || !varNames.size) return;
    _equations.forEach(eq => {
      if (!eq.expr) return;
      const used = window.MathEngine ? MathEngine.detectAllVars(eq.expr) : [];
      if (!used.some(v => varNames.has(v))) return; // doesn't depend on anything that changed this frame — skip
      const card = _getCard(eq.id);
      if (card) _rebuildEquation(eq, card);
    });
  }

  function rebuildOne(id) {
    const eq = _getEq(id);
    if (!eq) return;
    const card = _getCard(id);
    if (card) _rebuildEquation(eq, card);
  }

  // ══════════════════════════════════════════════════════
  // FRIENDLY ERROR MESSAGES  +  ERROR DISPLAY
  // ══════════════════════════════════════════════════════

  function _friendlyError(raw) {
    if (!raw) return null;
    for (const { test, msg } of FRIENDLY_ERRORS) {
      if (test.test(raw)) return msg;
    }
    return raw.replace(/^Error:\s*/i, '');
  }

  function _setCardError(card, errorMsg) {
    if (!card) return;
    const errEl  = card.querySelector('.eq-error-text');
    const inp    = card.querySelector('.eq-input');
    const hasErr = !!errorMsg;
    const wasErr = card.classList.contains('has-error');
    const prevMsg = errEl ? errEl.textContent : '';
    const friendly = hasErr ? _friendlyError(errorMsg) : '';

    card.classList.toggle('has-error', hasErr);
    if (errEl) errEl.textContent = friendly;
    if (inp) {
      inp.classList.toggle('error', hasErr);
      inp.setAttribute('aria-invalid', hasErr ? 'true' : 'false');
      _autoColorInput(inp, !hasErr);
    }

    // Only announce on an actual transition — not on every debounced
    // rebuild while the same error persists, which would spam the AT.
    if (hasErr && (!wasErr || friendly !== prevMsg)) {
      _announce('Error in equation: ' + friendly);
    } else if (!hasErr && wasErr) {
      _announce('Error resolved');
    }
  }

  function _autoColorInput(input, ok) {
    if (!input.value.trim()) { input.style.color = ''; return; }
    input.style.color = ok ? '' : '#fca5a5';
  }

  // ══════════════════════════════════════════════════════
  // SYNTAX HIGHLIGHTING
  // ══════════════════════════════════════════════════════

  const _HL_FUNCTIONS = new Set([
    'sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh',
    'sqrt','cbrt','pow','exp','log','log2','log10','abs','floor','ceil',
    'round','sign','min','max','mod','fract','clamp','dot','cross','norm','length',
  ]);
  const _HL_CONSTANTS = new Set(['PI','E','pi','e','Infinity','inf','NaN']);
  const _BRACKETS     = new Set(['(',')','{','}','[',']']);

  /** Lex expression into [{type, value, start}] tokens */
  function _tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];

      if (/\s/.test(ch)) {
        tokens.push({ type: 'ws', value: ch, start: i++ }); continue;
      }
      if (/\d/.test(ch) || (ch === '.' && /\d/.test(expr[i+1] || ''))) {
        let j = i;
        while (j < expr.length && /[\d.]/.test(expr[j])) j++;
        tokens.push({ type: 'num', value: expr.slice(i, j), start: i }); i = j; continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        let j = i;
        while (j < expr.length && /[a-zA-Z0-9_]/.test(expr[j])) j++;
        const word = expr.slice(i, j);
        const type = _HL_CONSTANTS.has(word) ? 'const'
                   : _HL_FUNCTIONS.has(word)  ? 'fn' : 'var';
        tokens.push({ type, value: word, start: i }); i = j; continue;
      }
      if (_BRACKETS.has(ch)) {
        tokens.push({ type: 'paren', value: ch, start: i++ }); continue;
      }
      if ('+-*/^=<>!,'.includes(ch)) {
        tokens.push({ type: 'op', value: ch, start: i++ }); continue;
      }
      tokens.push({ type: 'err', value: ch, start: i++ });
    }
    return tokens;
  }

  /** Convert tokens to highlighted HTML, marking matched brackets */
  function _tokensToHTML(tokens, matchA, matchB) {
    const html = tokens.map(({ type, value, start }) => {
      const cls  = (start === matchA || start === matchB) ? 'match' : type;
      const safe = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="eq-hl-${cls}">${safe}</span>`;
    }).join('');
    return html + '<span class="eq-hl-space"> </span>'; // prevents scroll flicker
  }

  // ══════════════════════════════════════════════════════
  // BRACKET MATCHING
  // ══════════════════════════════════════════════════════

  /** Return the index of the bracket matching the one at pos, or -1 */
  function _matchBracket(expr, pos) {
    const OPEN = '([{', CLOSE = ')]}';
    const ch = expr[pos];
    if (!ch) return -1;
    if (OPEN.includes(ch)) {
      const close = CLOSE[OPEN.indexOf(ch)];
      let depth = 0;
      for (let i = pos; i < expr.length; i++) {
        if (expr[i] === ch)    depth++;
        if (expr[i] === close) depth--;
        if (depth === 0) return i;
      }
    } else if (CLOSE.includes(ch)) {
      const open = OPEN[CLOSE.indexOf(ch)];
      let depth = 0;
      for (let i = pos; i >= 0; i--) {
        if (expr[i] === ch)   depth++;
        if (expr[i] === open) depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /** Copy computed font metrics from input → hlDiv so they render identically */
  function _syncHLStyle(input, hlDiv) {
    const cs = getComputedStyle(input);
    [
      'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    ].forEach(p => { hlDiv.style[p] = cs[p]; });
  }

  /** Full highlight refresh: tokenize + bracket match at current cursor */
  function _refreshHL(input, hlDiv) {
    const expr   = input.value;
    const cursor = input.selectionStart;
    let matchA = -1, matchB = -1;

    const ALL_BRACKETS = '()[]{}';
    if (ALL_BRACKETS.includes(expr[cursor])) {
      matchA = cursor;
      matchB = _matchBracket(expr, cursor);
    } else if (cursor > 0 && ALL_BRACKETS.includes(expr[cursor - 1])) {
      matchA = cursor - 1;
      matchB = _matchBracket(expr, cursor - 1);
    }

    hlDiv.innerHTML = _tokensToHTML(_tokenize(expr), matchA, matchB);
    hlDiv.scrollLeft = input.scrollLeft;
  }

  // ══════════════════════════════════════════════════════
  // EXPRESSION FORMATTING
  // ══════════════════════════════════════════════════════

  function _formatExpression(expr) {
    return expr
      .trim()
      .replace(/\*\*/g,               '^')        // ** → ^
      .replace(/\bpi\b/gi,            'PI')       // pi → PI
      .replace(/\binfinity\b/gi,      'Infinity')
      .replace(/\s*([+*\/=,])\s*/g,   ' $1 ')    // spaces around + * / = ,
      .replace(/  +/g, ' ')
      .trim();
  }

  function _applyFormat(eq, card, input, hlDiv) {
    if (!input.value.trim()) return;
    const formatted = _formatExpression(input.value);
    if (formatted === input.value) return;
    _pushHistory('edit', { id: eq.id, prevExpr: eq.expr, nextExpr: formatted });
    eq.expr     = formatted;
    input.value = formatted;
    if (hlDiv) _refreshHL(input, hlDiv);
    _scheduleRebuild(eq, card, 80);
    if (window.ModToast) ModToast.show('Expression formatted', 'info');
  }

  // ══════════════════════════════════════════════════════
  // AUTOCOMPLETE
  // ══════════════════════════════════════════════════════

  /** Extract the identifier being typed immediately before the cursor */
  function _currentWord(input) {
    const before = input.value.slice(0, input.selectionStart);
    const m = before.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    return m ? m[0] : '';
  }

  function _showAutocomplete(input, acDiv) {
    const word = _currentWord(input);
    if (!word) { _hideAutocomplete(acDiv); return; }

    const lower   = word.toLowerCase();
    const matches = AC_DICT.filter(item => {
      const lbl = item.label.replace('(', '').toLowerCase();
      return lbl.startsWith(lower) && lbl !== lower;
    }).slice(0, 8);

    if (!matches.length) { _hideAutocomplete(acDiv); return; }

    acDiv.innerHTML = '';
    _acIndex  = -1;
    _acTarget = input;

    matches.forEach(item => {
      const div = document.createElement('div');
      div.className      = 'eq-ac-item';
      div.dataset.type   = item.type;
      div.dataset.label  = item.label;
      div.innerHTML = `<span class="eq-ac-label">${item.label}</span>
                       <span class="eq-ac-doc">${item.doc}</span>`;
      div.addEventListener('mousedown', e => {
        e.preventDefault(); // keep input focused
        _acIndex = [...acDiv.children].indexOf(div);
        _acceptAC(input, acDiv);
      });
      acDiv.appendChild(div);
    });

    acDiv.classList.add('open');
  }

  function _hideAutocomplete(acDiv) {
    if (!acDiv) return;
    acDiv.classList.remove('open');
    _acTarget = null;
    _acIndex  = -1;
  }

  function _navigateAC(acDiv, dir) {
    const items = acDiv.querySelectorAll('.eq-ac-item');
    if (!items.length) return;
    if (_acIndex >= 0) items[_acIndex].classList.remove('active');
    _acIndex = Math.max(0, Math.min(items.length - 1, _acIndex + dir));
    items[_acIndex].classList.add('active');
    items[_acIndex].scrollIntoView({ block: 'nearest' });
  }

  function _acceptAC(input, acDiv) {
    const items  = acDiv.querySelectorAll('.eq-ac-item');
    const active = _acIndex >= 0 ? items[_acIndex] : items[0];
    if (!active) { _hideAutocomplete(acDiv); return; }

    const label = active.dataset.label;
    const word  = _currentWord(input);
    const pos   = input.selectionStart;
    const pre   = input.value.slice(0, pos - word.length);
    const post  = input.value.slice(pos);

    input.value = pre + label + post;
    const newPos = pre.length + label.length;
    input.setSelectionRange(newPos, newPos);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    _hideAutocomplete(acDiv);
    input.focus();
  }

  // ══════════════════════════════════════════════════════
  // EQUATION HISTORY  (session)
  // ══════════════════════════════════════════════════════

  function _addToHistory(expr, type) {
    if (!expr?.trim()) return;
    // Move to front if already exists, otherwise prepend
    const idx = _eqHistory.findIndex(h => h.expr === expr && h.type === type);
    if (idx !== -1) _eqHistory.splice(idx, 1);
    _eqHistory.unshift({ expr, type, time: Date.now() });
    if (_eqHistory.length > MAX_EQ_HISTORY) _eqHistory.pop();
    _renderHistoryPanel();
  }

  function getHistory() { return [..._eqHistory]; }

  function _clearHistory() {
    _eqHistory.length = 0;
    _renderHistoryPanel();
  }

  function _initHistoryPanel() {
    if (document.getElementById('eq-history-panel')) return;
    const panel = document.createElement('div');
    panel.id        = 'eq-history-panel';
    panel.className = 'eq-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Equation History');
    panel.innerHTML = `
      <div class="eq-panel-header">
        <span>Equation History</span>
        <div class="eq-panel-header-actions">
          <button class="eq-panel-clear" title="Clear all history">Clear</button>
          <button class="eq-panel-close" title="Close  (Esc)">✕</button>
        </div>
      </div>
      <div class="eq-panel-search-wrap">
        <input class="eq-panel-search-input" type="text"
               placeholder="Filter history…" autocomplete="off"/>
      </div>
      <div class="eq-panel-body" id="eq-history-body"></div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.eq-panel-close').addEventListener('click', () =>
      panel.classList.remove('open'));
    panel.querySelector('.eq-panel-clear').addEventListener('click', () => {
      _clearHistory();
      if (window.ModToast) ModToast.show('History cleared', 'info');
    });
    panel.querySelector('.eq-panel-search-input').addEventListener('input', e =>
      _renderHistoryPanel(e.target.value));

    document.addEventListener('pointerdown', e => {
      if (panel.classList.contains('open')
          && !panel.contains(e.target)
          && !e.target.closest('#eq-open-history-btn')) {
        panel.classList.remove('open');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') panel.classList.remove('open');
    });
  }

  function _renderHistoryPanel(filter = '') {
    const body = document.getElementById('eq-history-body');
    if (!body) return;
    const q     = filter.toLowerCase();
    const items = q
      ? _eqHistory.filter(h => h.expr.toLowerCase().includes(q))
      : _eqHistory;

    if (!items.length) {
      body.innerHTML = `<div class="eq-panel-empty">${
        q ? 'No matches.' : 'No history yet.<br>Equations appear here after they render successfully.'
      }</div>`;
      return;
    }

    body.innerHTML = '';
    items.forEach(h => {
      const div = document.createElement('div');
      div.className = 'eq-panel-item';
      div.innerHTML = `
        <span class="eq-panel-expr" title="${h.expr}">${h.expr}</span>
        <span class="eq-panel-meta">${h.type}</span>
        <button class="eq-panel-item-del" title="Remove from history">✕</button>
      `;
      div.addEventListener('click', e => {
        if (e.target.classList.contains('eq-panel-item-del')) {
          const idx = _eqHistory.indexOf(h);
          if (idx !== -1) { _eqHistory.splice(idx, 1); _renderHistoryPanel(filter); }
          return;
        }
        addEquation({ expr: h.expr, type: h.type });
        document.getElementById('eq-history-panel').classList.remove('open');
      });
      body.appendChild(div);
    });
  }

  function openHistory() {
    const panel = document.getElementById('eq-history-panel');
    if (!panel) return;
    _renderHistoryPanel();
    document.getElementById('eq-favorites-panel')?.classList.remove('open');
    panel.classList.toggle('open');
  }

  // ══════════════════════════════════════════════════════
  // FAVORITES
  // ══════════════════════════════════════════════════════

  function _loadFavorites() {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); }
    catch { return []; }
  }

  function _saveFavorites(favs) {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs)); }
    catch { /* localStorage unavailable */ }
  }

  function toggleFavorite(expr, type) {
    if (!expr?.trim()) return false;
    const favs = _loadFavorites();
    const idx  = favs.findIndex(f => f.expr === expr && f.type === type);
    if (idx !== -1) {
      favs.splice(idx, 1);
      _saveFavorites(favs);
      _renderFavoritesPanel();
      return false; // removed
    }
    favs.unshift({ expr, type, time: Date.now() });
    _saveFavorites(favs);
    _renderFavoritesPanel();
    return true;  // added
  }

  function isFavorite(expr, type) {
    return _loadFavorites().some(f => f.expr === expr && f.type === type);
  }

  function getFavorites() { return _loadFavorites(); }

  function _updateFavBtn(btn, expr, type) {
    const starred = isFavorite(expr, type);
    btn.classList.toggle('starred', starred);
    btn.title = starred ? 'Remove from favorites' : 'Add to favorites';
  }

  function _initFavoritesPanel() {
    if (document.getElementById('eq-favorites-panel')) return;
    const panel = document.createElement('div');
    panel.id        = 'eq-favorites-panel';
    panel.className = 'eq-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Favorites');
    panel.innerHTML = `
      <div class="eq-panel-header">
        <span>Favorites</span>
        <div class="eq-panel-header-actions">
          <button class="eq-panel-clear" title="Clear all favorites">Clear all</button>
          <button class="eq-panel-close" title="Close  (Esc)">✕</button>
        </div>
      </div>
      <div class="eq-panel-search-wrap">
        <input class="eq-panel-search-input" type="text"
               placeholder="Search favorites…" autocomplete="off"/>
      </div>
      <div class="eq-panel-body" id="eq-favorites-body"></div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.eq-panel-close').addEventListener('click', () =>
      panel.classList.remove('open'));
    panel.querySelector('.eq-panel-clear').addEventListener('click', () => {
      _saveFavorites([]);
      _renderFavoritesPanel();
      if (window.ModToast) ModToast.show('Favorites cleared', 'info');
    });
    panel.querySelector('.eq-panel-search-input').addEventListener('input', e =>
      _renderFavoritesPanel(e.target.value));

    document.addEventListener('pointerdown', e => {
      if (panel.classList.contains('open')
          && !panel.contains(e.target)
          && !e.target.closest('#eq-open-favorites-btn')) {
        panel.classList.remove('open');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') panel.classList.remove('open');
    });
  }

  function _renderFavoritesPanel(filter = '') {
    const body = document.getElementById('eq-favorites-body');
    if (!body) return;
    const q     = filter.toLowerCase();
    const favs  = _loadFavorites();
    const items = q ? favs.filter(f => f.expr.toLowerCase().includes(q)) : favs;

    if (!items.length) {
      body.innerHTML = `<div class="eq-panel-empty">${
        q ? 'No matches.' : 'No favorites yet.<br>Click ★ on any equation to save it here.'
      }</div>`;
      return;
    }

    body.innerHTML = '';
    items.forEach(f => {
      const div = document.createElement('div');
      div.className = 'eq-panel-item';
      div.innerHTML = `
        <span class="eq-panel-expr" title="${f.expr}">${f.expr}</span>
        <span class="eq-panel-meta">${f.type}</span>
        <button class="eq-panel-item-del" title="Remove from favorites">✕</button>
      `;
      div.addEventListener('click', e => {
        if (e.target.classList.contains('eq-panel-item-del')) {
          toggleFavorite(f.expr, f.type);
          _renderFavoritesPanel(filter);
          return;
        }
        addEquation({ expr: f.expr, type: f.type });
        document.getElementById('eq-favorites-panel').classList.remove('open');
      });
      body.appendChild(div);
    });
  }

  function openFavorites() {
    const panel = document.getElementById('eq-favorites-panel');
    if (!panel) return;
    _renderFavoritesPanel();
    document.getElementById('eq-history-panel')?.classList.remove('open');
    panel.classList.toggle('open');
  }

  // ══════════════════════════════════════════════════════
  // SEARCH EQUATIONS
  // ══════════════════════════════════════════════════════

  function _initSearch() {
    const list = document.getElementById('equation-list');
    if (!list?.parentElement) return;

    const wrap = document.createElement('div');
    wrap.className = 'eq-search-wrap';
    wrap.innerHTML = `
      <input class="eq-search-input" type="text"
             placeholder="Search equations…" autocomplete="off" aria-label="Search equations"/>
      <span class="eq-search-count" id="eq-search-count"></span>
      <button class="eq-search-clear" title="Clear search">✕</button>
    `;
    list.parentElement.insertBefore(wrap, list);

    const input    = wrap.querySelector('.eq-search-input');
    const clearBtn = wrap.querySelector('.eq-search-clear');
    const countEl  = wrap.querySelector('#eq-search-count');

    input.addEventListener('input', () => {
      clearBtn.classList.toggle('vis', input.value.length > 0);
      _applySearch(input.value, countEl);
    });
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('vis');
      _applySearch('', countEl);
      input.focus();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        clearBtn.classList.remove('vis');
        _applySearch('', countEl);
      }
    });
  }

  function _applySearch(query, countEl) {
    const q       = query.trim().toLowerCase();
    let   visible = 0;

    document.querySelectorAll('.eq-card').forEach(card => {
      const eq    = _getEq(card.dataset.id);
      if (!eq) return;
      const match = !q
        || eq.expr.toLowerCase().includes(q)
        || (eq.label || '').toLowerCase().includes(q)
        || eq.type.toLowerCase().includes(q);
      card.classList.toggle('hidden-by-search', !match);
      if (match) visible++;
    });

    if (countEl) {
      countEl.textContent = q ? `${visible} of ${_equations.length}` : '';
    }
  }

  function searchEquations(query) { _applySearch(query, null); }

  function _updateSearchVisibility() {
    const input = document.querySelector('.eq-search-input');
    if (input?.value) _applySearch(input.value, document.getElementById('eq-search-count'));
  }

  // ══════════════════════════════════════════════════════
  // AUTO SLIDER DETECTION
  // ══════════════════════════════════════════════════════

  function _checkAutoSliders(eq) {
    if (!ModSliders) return;
    // detectSliderVars is a black box we don't control — normalize first so
    // it never sees a raw "LHS = RHS" equation, only the bare form it (and
    // every other type) already expects.
    const exprForDetection = eq.type === 'implicit' ? _normalizeImplicitExpr(eq.expr) : eq.expr;
    const vars = MathEngine.detectSliderVars(exprForDetection);
    vars.forEach(name => {
      if (!ModSliders.has(name)) {
        ModSliders.addSlider(name, 1);
        if (window.ModToast) ModToast.show('Auto-created slider: ' + name, 'info');
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════

  function _deleteEquation(id) {
    const eq = _getEq(id);
    if (!eq) return;

    _pushHistory('delete', { eq: { ...eq } });
    Engine.removeMesh(id);
    GraphBuilder.forgetEquation(id); // invalidate any in-flight async isosurface build for this id — see forgetEquation()'s doc comment in core/graph-builder.js
    _equations = _equations.filter(e => e.id !== id);
    _selectedIds.delete(id);

    const card = _getCard(id);
    if (card) {
      card.style.transition = 'opacity .15s, transform .15s';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(-8px)';
      setTimeout(() => card.remove(), 160);
    }

    clearTimeout(_debounceTimers[id]);
    delete _debounceTimers[id];
    _syncCount();
    _updateSelectionUI();
    _repositionGroupHeaders();
    _announce('Equation deleted');
  }

  // ══════════════════════════════════════════════════════
  // DUPLICATE
  // ══════════════════════════════════════════════════════

  function _duplicateEquation(id) {
    const eq = _getEq(id);
    if (!eq) return;
    const newEq = addEquation({
      expr: eq.expr, type: eq.type, color: Engine.nextColor(),
      uMin: eq.uMin, uMax: eq.uMax,
      vMin: eq.vMin, vMax: eq.vMax,
      tMin: eq.tMin, tMax: eq.tMax,
    });
    if (window.ModToast) ModToast.show('Equation duplicated', 'success');
    return newEq;
  }

  // ══════════════════════════════════════════════════════
  // MULTI-SELECT  (shift-click range, ctrl/cmd-click toggle)
  // ══════════════════════════════════════════════════════

  function _toggleSelect(id) {
    if (_selectedIds.has(id)) _selectedIds.delete(id);
    else _selectedIds.add(id);
    _lastSelectedId = id;
    _updateSelectionUI();
  }

  function _selectRange(fromId, toId) {
    const ids = _equations.map(e => e.id);
    const i = ids.indexOf(fromId);
    const j = ids.indexOf(toId);
    if (i === -1 || j === -1) return;
    const [start, end] = i < j ? [i, j] : [j, i];
    for (let k = start; k <= end; k++) _selectedIds.add(ids[k]);
    _lastSelectedId = toId;
    _updateSelectionUI();
  }

  function _clearSelection() {
    if (_selectedIds.size === 0) return;
    _selectedIds.clear();
    _lastSelectedId = null;
    _updateSelectionUI();
  }

  function _updateSelectionUI() {
    document.querySelectorAll('.eq-card').forEach(card => {
      const id = card.dataset.id;
      const selected = _selectedIds.has(id);
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    _updateBulkActionBar();
  }

  function getSelected() {
    return _equations.filter(e => _selectedIds.has(e.id));
  }

  // ══════════════════════════════════════════════════════
  // BULK ACTION BAR  — appears above the list when 1+ selected
  // ══════════════════════════════════════════════════════

  function _initBulkActionBar() {
    const list = document.getElementById('equation-list');
    if (!list || !list.parentElement || document.getElementById('eq-bulk-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'eq-bulk-bar';
    bar.className = 'eq-bulk-bar';
    bar.innerHTML = `
      <span class="eq-bulk-count" id="eq-bulk-count"></span>
      <button class="eq-bulk-btn" id="eq-bulk-color">Change color</button>
      <button class="eq-bulk-btn" id="eq-bulk-duplicate">Duplicate</button>
      <button class="eq-bulk-btn" id="eq-bulk-group">Group…</button>
      <button class="eq-bulk-btn" id="eq-bulk-export">Export</button>
      <button class="eq-bulk-btn danger" id="eq-bulk-delete">Delete</button>
      <button class="eq-bulk-clear" id="eq-bulk-clear">Clear selection</button>
    `;
    list.parentElement.insertBefore(bar, list);

    bar.querySelector('#eq-bulk-color').addEventListener('click', e => _bulkColor(e.currentTarget));
    bar.querySelector('#eq-bulk-duplicate').addEventListener('click', _bulkDuplicate);
    bar.querySelector('#eq-bulk-group').addEventListener('click', _bulkGroup);
    bar.querySelector('#eq-bulk-export').addEventListener('click', _bulkExport);
    bar.querySelector('#eq-bulk-delete').addEventListener('click', _bulkDelete);
    bar.querySelector('#eq-bulk-clear').addEventListener('click', _clearSelection);
  }

  function _updateBulkActionBar() {
    const bar   = document.getElementById('eq-bulk-bar');
    const count = document.getElementById('eq-bulk-count');
    if (!bar) return;
    const n = _selectedIds.size;
    bar.classList.toggle('open', n > 0);
    if (count) count.textContent = n + (n === 1 ? ' selected' : ' selected');
  }

  function _bulkColor(triggerBtn) {
    const targets = getSelected();
    if (!targets.length) return;
    _openColorPicker(targets, triggerBtn);
  }

  function _bulkDuplicate() {
    const targets = getSelected();
    if (!targets.length) return;
    const created = targets.map(eq => addEquation({
      expr: eq.expr, type: eq.type, color: Engine.nextColor(),
      uMin: eq.uMin, uMax: eq.uMax,
      vMin: eq.vMin, vMax: eq.vMax,
      tMin: eq.tMin, tMax: eq.tMax,
      extendTo3D: eq.extendTo3D,
    }));
    _pushHistory('bulk-duplicate', { snapshots: created.map(e => ({ ...e })) });
    _clearSelection();
    _announce(`${created.length} equations duplicated`);
  }

  function _bulkDelete() {
    const targets = getSelected();
    if (!targets.length) return;
    if (!confirm(`Delete ${targets.length} equation${targets.length === 1 ? '' : 's'}? This can be undone with Ctrl+Z.`)) return;

    const snapshot = targets.map(eq => ({ eq: { ...eq }, index: _equations.indexOf(eq) }));
    _pushHistory('bulk-delete', { snapshot });

    targets.forEach(eq => {
      Engine.removeMesh(eq.id);
      GraphBuilder.forgetEquation(eq.id);
      _getCard(eq.id)?.remove();
    });
    const ids = new Set(targets.map(e => e.id));
    _equations = _equations.filter(e => !ids.has(e.id));

    _clearSelection();
    _syncCount();
    _repositionGroupHeaders();
    _announce(`${targets.length} equations deleted`);
  }

  function _bulkExport() {
    const targets = getSelected();
    if (!targets.length) return;
    const data = targets.map(eq => ({
      expr: eq.expr, type: eq.type, color: eq.color,
      visible: eq.visible, label: eq.label, extendTo3D: eq.extendTo3D,
    }));

    if (window.ModExport && typeof window.ModExport.exportEquations === 'function') {
      window.ModExport.exportEquations(data);
      _announce(`${targets.length} equations sent to export`);
      return;
    }

    // Fallback if mod-export.js isn't loaded: copy JSON to the clipboard.
    const json = JSON.stringify(data, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        if (window.ModToast) ModToast.show(`${targets.length} equations copied as JSON`, 'success');
        _announce(`${targets.length} equations copied to clipboard as JSON`);
      });
    }
  }

  function _bulkGroup() {
    const targets = getSelected();
    if (!targets.length) return;
    const name = prompt('Group name (existing or new):', '');
    if (name === null || !name.trim()) return;

    let group = _groups.find(g => g.name.toLowerCase() === name.trim().toLowerCase());
    if (!group) group = _createGroup(name.trim());

    _assignToGroup(targets.map(e => e.id), group.id);
    _clearSelection();
    _announce(`${targets.length} equations added to group ${group.name}`);
  }

  // ══════════════════════════════════════════════════════
  // LOCK / UNLOCK
  // ══════════════════════════════════════════════════════

  function _toggleLock(id) {
    const eq = _getEq(id);
    if (!eq) return;
    eq.locked = !eq.locked;
    const card = _getCard(id);
    if (card) {
      card.classList.toggle('locked', eq.locked);
      const input = card.querySelector('.eq-input');
      if (input) input.readOnly = eq.locked;
    }
    if (window.ModToast) ModToast.show(eq.locked ? 'Equation locked' : 'Equation unlocked', 'info');
  }

  // ══════════════════════════════════════════════════════
  // RENAME (label)
  // ══════════════════════════════════════════════════════

  function _renameEquation(id) {
    const eq = _getEq(id);
    if (!eq) return;
    const prevLabel = eq.label || '';
    const name = prompt('Label for this equation:', prevLabel);
    if (name === null) return;
    const nextLabel = name.trim();
    if (nextLabel === prevLabel) return;
    eq.label = nextLabel;
    _pushHistory('rename', { id, prevLabel, nextLabel });
    _announce(nextLabel ? `Renamed to ${nextLabel}` : 'Label cleared');
  }

  // ══════════════════════════════════════════════════════
  // GROUPS / FOLDERS  — collapsible, nameable equation groups
  //
  // Equations stay in one flat array/DOM list (so drag-and-drop keeps
  // working exactly as before); group headers are just additional
  // siblings repositioned to sit right before their group's first
  // member card whenever the list changes.
  // ══════════════════════════════════════════════════════

  function _createGroup(name) {
    const group = { id: 'grp-' + (++_groupIdCounter), name: name || 'Group', collapsed: false };
    _groups.push(group);
    return group;
  }

  function _renameGroup(id, name) {
    const group = _groups.find(g => g.id === id);
    if (!group || !name || !name.trim()) return;
    group.name = name.trim();
    const header = document.querySelector(`.eq-group-header[data-group-id="${id}"]`);
    const nameEl = header?.querySelector('.eq-group-name');
    if (nameEl) nameEl.textContent = group.name;
    _announce(`Group renamed to ${group.name}`);
  }

  /** Ungroups all member equations (does NOT delete them) and removes the group. */
  function _deleteGroup(id) {
    const group = _groups.find(g => g.id === id);
    if (!group) return;
    const memberCount = _equations.filter(e => e.groupId === id).length;
    _equations.forEach(e => { if (e.groupId === id) e.groupId = null; });
    _groups = _groups.filter(g => g.id !== id);
    document.querySelector(`.eq-group-header[data-group-id="${id}"]`)?.remove();
    document.querySelectorAll('.eq-card').forEach(card => {
      const eq = _getEq(card.dataset.id);
      if (eq && eq.groupId === null) { card.classList.remove('grouped'); card.style.display = ''; }
    });
    _announce(`Group ${group.name} deleted, ${memberCount} equations ungrouped`);
  }

  function _toggleGroupCollapsed(id) {
    const group = _groups.find(g => g.id === id);
    if (!group) return;
    group.collapsed = !group.collapsed;
    _applyGroupCollapse(group);
    _announce(group.collapsed ? `Group ${group.name} collapsed` : `Group ${group.name} expanded`);
  }

  function _applyGroupCollapse(group) {
    const header = document.querySelector(`.eq-group-header[data-group-id="${group.id}"]`);
    if (header) {
      header.classList.toggle('collapsed', group.collapsed);
      header.setAttribute('aria-expanded', group.collapsed ? 'false' : 'true');
    }
    _equations.forEach(eq => {
      if (eq.groupId !== group.id) return;
      const card = _getCard(eq.id);
      if (card) card.style.display = group.collapsed ? 'none' : '';
    });
  }

  /** Assign equations to a group and move them together so the group looks coherent. */
  function _assignToGroup(ids, groupId) {
    const idSet = new Set(ids);
    ids.forEach(id => {
      const eq = _getEq(id);
      if (eq) eq.groupId = groupId;
    });

    // Consolidate: pull all members of this group together, right after
    // the position of the first one, preserving everyone else's order.
    const members = _equations.filter(e => e.groupId === groupId);
    const rest     = _equations.filter(e => e.groupId !== groupId);
    const firstIdx = _equations.findIndex(e => idSet.has(e.id) || e.groupId === groupId);
    const insertAt = Math.min(firstIdx === -1 ? rest.length : firstIdx, rest.length);
    rest.splice(insertAt, 0, ...members);
    _equations = rest;

    // Re-order the DOM to match, then drop headers into place.
    const list = document.getElementById('equation-list');
    if (list) {
      _equations.forEach(eq => {
        const card = _getCard(eq.id);
        if (card) list.appendChild(card);
      });
    }

    ids.forEach(id => _getCard(id)?.classList.add('grouped'));
    _repositionGroupHeaders();
  }

  function _buildGroupHeader(group) {
    const header = document.createElement('div');
    header.className = 'eq-group-header' + (group.collapsed ? ' collapsed' : '');
    header.dataset.groupId = group.id;
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', group.collapsed ? 'false' : 'true');
    header.innerHTML = `
      <span class="eq-group-chevron" aria-hidden="true">▾</span>
      <span class="eq-group-name">${group.name}</span>
      <span class="eq-group-count"></span>
      <button class="eq-group-delete" title="Ungroup (equations are kept)" aria-label="Delete group ${group.name}, equations will be kept">✕</button>
    `;

    header.addEventListener('click', e => {
      if (e.target.closest('.eq-group-delete')) return;
      if (e.detail === 2) { // double-click renames
        const name = prompt('Rename group:', group.name);
        if (name) _renameGroup(group.id, name);
        return;
      }
      _toggleGroupCollapsed(group.id);
    });
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _toggleGroupCollapsed(group.id); }
    });
    header.querySelector('.eq-group-delete').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Delete group "${group.name}"? Equations inside will be kept, just ungrouped.`)) {
        _deleteGroup(group.id);
      }
    });

    return header;
  }

  /** Keep each group's header positioned right before its first member card. */
  function _repositionGroupHeaders() {
    const list = document.getElementById('equation-list');
    if (!list) return;

    _groups.forEach(group => {
      const memberIds = _equations.filter(e => e.groupId === group.id).map(e => e.id);
      let header = document.querySelector(`.eq-group-header[data-group-id="${group.id}"]`);

      if (!memberIds.length) {
        header?.remove();
        return;
      }
      if (!header) header = _buildGroupHeader(group);

      const countEl = header.querySelector('.eq-group-count');
      if (countEl) countEl.textContent = memberIds.length + (memberIds.length === 1 ? ' equation' : ' equations');
      header.setAttribute('aria-controls', memberIds.join(' '));

      const firstCard = _getCard(memberIds[0]);
      if (firstCard && firstCard.parentElement === list) {
        list.insertBefore(header, firstCard);
      }
      _applyGroupCollapse(group);
    });
  }

  function getGroups() { return _groups.map(g => ({ ...g })); }

  // ══════════════════════════════════════════════════════
  // COLOR PICKER
  // ══════════════════════════════════════════════════════

  function _initColorPicker() {
    const pop = document.getElementById('color-picker');
    if (!pop) return;

    pop.setAttribute('role', 'listbox');
    pop.setAttribute('aria-label', 'Choose a color');

    PALETTE.forEach(hex => {
      const swatch = document.createElement('div');
      swatch.className        = 'color-swatch';
      swatch.style.background = hex;
      swatch.dataset.hex      = hex;
      swatch.setAttribute('role', 'option');
      swatch.setAttribute('tabindex', '-1');
      swatch.setAttribute('aria-label', _colorName(hex));
      swatch.setAttribute('aria-selected', 'false');
      swatch.addEventListener('click', () => _applyPickerColor(hex));
      pop.appendChild(swatch);
    });

    pop.addEventListener('keydown', e => _handlePickerKeydown(e, pop));

    document.addEventListener('pointerdown', e => {
      if (pop.classList.contains('open')
          && !pop.contains(e.target)
          && !e.target.closest('.eq-color-dot')) {
        _closeColorPicker();
      }
    });
  }

  function _handlePickerKeydown(e, pop) {
    const swatches = [...pop.querySelectorAll('.color-swatch')];
    const current   = document.activeElement;
    let idx = swatches.indexOf(current);

    if (e.key === 'Escape') {
      e.preventDefault();
      _closeColorPicker();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (idx !== -1) _applyPickerColor(swatches[idx].dataset.hex);
      return;
    }
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (idx === -1) idx = 0;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (idx + 1) % swatches.length;
      else if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   idx = (idx - 1 + swatches.length) % swatches.length;
      else if (e.key === 'Home') idx = 0;
      else if (e.key === 'End')  idx = swatches.length - 1;

      swatches.forEach(s => s.setAttribute('tabindex', '-1'));
      swatches[idx].setAttribute('tabindex', '0');
      swatches[idx].focus();
    }
  }

  /** Open the color picker for one or more equations at once (single-select or bulk). */
  function _openColorPicker(eqs, dot) {
    const pop = document.getElementById('color-picker');
    if (!pop || !eqs || !eqs.length) return;
    _pickerTarget        = eqs; // always an array now
    _pickerDot            = dot || null;
    _pickerReturnFocusEl = dot || document.activeElement;

    const refColor = eqs[0].color;
    const swatches = [...pop.querySelectorAll('.color-swatch')];
    let matchIdx = 0;
    swatches.forEach((s, i) => {
      const selected = s.dataset.hex.toLowerCase() === (refColor || '').toLowerCase();
      s.setAttribute('aria-selected', selected ? 'true' : 'false');
      s.setAttribute('tabindex', selected ? '0' : '-1');
      if (selected) matchIdx = i;
    });
    if (!swatches.some(s => s.getAttribute('tabindex') === '0') && swatches[0]) {
      swatches[0].setAttribute('tabindex', '0');
    }

    if (dot) {
      const rect = dot.getBoundingClientRect();
      const popW = 120;
      let left = rect.left, top = rect.bottom + 5;
      if (left + popW > window.innerWidth)  left = window.innerWidth  - popW - 8;
      if (top  + 100  > window.innerHeight) top  = rect.top - 105;
      pop.style.left = left + 'px';
      pop.style.top  = top  + 'px';
    }

    pop.classList.add('open');
    swatches[matchIdx]?.focus();
  }

  function _applyPickerColor(hex) {
    const pop = document.getElementById('color-picker');
    const targets = _pickerTarget;
    if (!targets || !targets.length) { _closeColorPicker(); return; }

    if (targets.length === 1) {
      const eq = targets[0];
      const prevColor = eq.color;
      eq.color = hex;
      const dot = _getCard(eq.id)?.querySelector('.eq-color-dot');
      if (dot) { dot.style.background = hex; _updateColorDotLabel(dot, hex); }
      rebuildOne(eq.id);
      if (prevColor !== hex) {
        _pushHistory('color', { id: eq.id, prevColor, nextColor: hex });
      }
    } else {
      const changes = [];
      targets.forEach(eq => {
        const prevColor = eq.color;
        if (prevColor === hex) return;
        eq.color = hex;
        const dot = _getCard(eq.id)?.querySelector('.eq-color-dot');
        if (dot) { dot.style.background = hex; _updateColorDotLabel(dot, hex); }
        rebuildOne(eq.id);
        changes.push({ id: eq.id, prevColor, nextColor: hex });
      });
      if (changes.length) _pushHistory('bulk-color', { changes });
      _announce(`${targets.length} equations recolored to ${_colorName(hex)}`);
    }

    if (pop) pop.classList.remove('open');
    _closeColorPicker(false);
  }

  function _closeColorPicker(restoreFocus = true) {
    const pop = document.getElementById('color-picker');
    if (pop) pop.classList.remove('open');
    const returnEl = _pickerReturnFocusEl;
    _pickerTarget         = null;
    _pickerDot             = null;
    _pickerReturnFocusEl = null;
    if (restoreFocus && returnEl && document.body.contains(returnEl)) returnEl.focus();
  }

  // ══════════════════════════════════════════════════════
  // CONTEXT MENU
  // ══════════════════════════════════════════════════════

  function _initContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    const actions = {
      'ctx-duplicate':  () => _ctxTarget && _duplicateEquation(_ctxTarget.id),
      'ctx-lock':       () => _ctxTarget && _toggleLock(_ctxTarget.id),
      'ctx-rename':     () => _ctxTarget && _renameEquation(_ctxTarget.id),
      'ctx-copy-expr':  () => {
        if (!_ctxTarget) return;
        navigator.clipboard.writeText(_ctxTarget.expr).then(() => {
          if (window.ModToast) ModToast.show('Expression copied', 'success');
        });
      },
      'ctx-favorite': () => {
        if (!_ctxTarget) return;
        const starred = toggleFavorite(_ctxTarget.expr, _ctxTarget.type);
        const card    = _getCard(_ctxTarget.id);
        const favBtn  = card?.querySelector('.eq-fav-btn');
        if (favBtn) _updateFavBtn(favBtn, _ctxTarget.expr, _ctxTarget.type);
        if (window.ModToast) ModToast.show(starred ? 'Added to favorites' : 'Removed from favorites', 'info');
      },
      'ctx-format': () => {
        if (!_ctxTarget) return;
        const card  = _getCard(_ctxTarget.id);
        const input = card?.querySelector('.eq-input');
        const hlDiv = card?.querySelector('.eq-highlight-layer');
        if (input) _applyFormat(_ctxTarget, card, input, hlDiv);
      },
      'ctx-ai-explain': () => {
        if (_ctxTarget && window.ModAI) ModAI.explainEquation(_ctxTarget);
      },
      'ctx-group': () => {
        if (!_ctxTarget) return;
        const name = prompt('Group name (existing or new):', '');
        if (name === null || !name.trim()) return;
        let group = _groups.find(g => g.name.toLowerCase() === name.trim().toLowerCase());
        if (!group) group = _createGroup(name.trim());
        _assignToGroup([_ctxTarget.id], group.id);
        _announce(`Added to group ${group.name}`);
      },
      'ctx-ungroup': () => {
        if (!_ctxTarget || !_ctxTarget.groupId) return;
        _ctxTarget.groupId = null;
        _getCard(_ctxTarget.id)?.classList.remove('grouped');
        _repositionGroupHeaders();
        _announce('Removed from group');
      },
      'ctx-delete': () => _ctxTarget && _deleteEquation(_ctxTarget.id),
    };

    Object.entries(actions).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { fn(); _closeContextMenu(); });
    });

    document.addEventListener('pointerdown', e => {
      if (!menu.contains(e.target)) _closeContextMenu();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') _closeContextMenu();
    });
  }

  function _openContextMenu(eq, e) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    _ctxTarget = eq;

    const lockEl = document.getElementById('ctx-lock');
    if (lockEl) {
      const span = lockEl.querySelector('span');
      if (span) span.textContent = eq.locked ? 'Unlock' : 'Lock';
    }

    const favEl = document.getElementById('ctx-favorite');
    if (favEl) {
      const span = favEl.querySelector('span');
      if (span) span.textContent = isFavorite(eq.expr, eq.type) ? 'Unfavorite' : 'Favorite';
    }

    const ungroupEl = document.getElementById('ctx-ungroup');
    if (ungroupEl) ungroupEl.style.display = eq.groupId ? '' : 'none';

    const x = Math.min(e.clientX, window.innerWidth  - 180);
    const y = Math.min(e.clientY, window.innerHeight - 220);
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.classList.add('open');

    if (window.lucide) lucide.createIcons({ nodes: [menu] });
  }

  function _closeContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.classList.remove('open');
    _ctxTarget = null;
  }

  // ══════════════════════════════════════════════════════
  // ADD BUTTON  +  panel trigger wiring
  // ══════════════════════════════════════════════════════

  function _initAddButton() {
    const btn = document.getElementById('add-equation-btn');
    if (btn) btn.addEventListener('click', () => addEquation());

    // Optional trigger buttons in HTML
    document.getElementById('eq-open-history-btn')?.addEventListener('click', openHistory);
    document.getElementById('eq-open-favorites-btn')?.addEventListener('click', openFavorites);
  }

  // ══════════════════════════════════════════════════════
  // DRAG TO REORDER
  // ══════════════════════════════════════════════════════

  let _dragId = null;

  function _onDragStart(e, id) {
    _dragId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  }

  function _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function _onDrop(e, targetId) {
    e.preventDefault();
    if (!_dragId || _dragId === targetId) return;

    const fromIdx = _equations.findIndex(eq => eq.id === _dragId);
    const toIdx   = _equations.findIndex(eq => eq.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const prevOrder = _equations.map(eq => eq.id);

    const [moved] = _equations.splice(fromIdx, 1);
    _equations.splice(toIdx, 0, moved);

    const nextOrder = _equations.map(eq => eq.id);

    const list   = document.getElementById('equation-list');
    const cards  = [...list.querySelectorAll('.eq-card')];
    const fromEl = cards.find(c => c.dataset.id === _dragId);
    const toEl   = cards.find(c => c.dataset.id === targetId);

    if (fromEl) fromEl.style.opacity = '1';
    if (fromEl && toEl) {
      if (fromIdx < toIdx) list.insertBefore(fromEl, toEl.nextSibling);
      else                 list.insertBefore(fromEl, toEl);
    }
    _dragId = null;

    _pushHistory('reorder', { prevOrder, nextOrder });
    _repositionGroupHeaders();
    _announce('Equation reordered');
  }

  // ══════════════════════════════════════════════════════
  // UNDO / REDO  (add | delete | edit | color | bulk-color | rename |
  //               reorder | bulk-delete | bulk-duplicate)
  // ══════════════════════════════════════════════════════

  function _pushHistory(action, data) {
    _undoStack.push({ action, data, time: Date.now() });
    if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
    _redoStack.length = 0; // any new action clears redo
  }

  /** Move existing cards to match a given id order — appendChild() on an
   *  already-attached node relocates it, so this rebuilds DOM order cheaply. */
  function _reorderDOMToMatch(idOrder) {
    const list = document.getElementById('equation-list');
    if (!list) return;
    idOrder.forEach(id => {
      const card = _getCard(id);
      if (card) list.appendChild(card);
    });
  }

  function _setColorOnEq(id, hex) {
    const eq = _getEq(id);
    if (!eq) return;
    eq.color = hex;
    const dot = _getCard(id)?.querySelector('.eq-color-dot');
    if (dot) { dot.style.background = hex; _updateColorDotLabel(dot, hex); }
    rebuildOne(id);
  }

  function undo() {
    const last = _undoStack.pop();
    if (!last) return;
    _redoStack.push(last);

    if (last.action === 'add') {
      Engine.removeMesh(last.data.eq.id);
      GraphBuilder.forgetEquation(last.data.eq.id);
      _equations = _equations.filter(e => e.id !== last.data.eq.id);
      _getCard(last.data.eq.id)?.remove();

    } else if (last.action === 'delete') {
      addEquation({ ...last.data.eq });

    } else if (last.action === 'edit') {
      const { id, prevExpr } = last.data;
      const eq    = _getEq(id);
      if (!eq) return;
      eq.expr     = prevExpr;
      const card  = _getCard(id);
      const input = card?.querySelector('.eq-input');
      const hlDiv = card?.querySelector('.eq-highlight-layer');
      if (input) { input.value = prevExpr; if (hlDiv) _refreshHL(input, hlDiv); }
      _scheduleRebuild(eq, card, 80);

    } else if (last.action === 'color') {
      _setColorOnEq(last.data.id, last.data.prevColor);

    } else if (last.action === 'bulk-color') {
      last.data.changes.forEach(({ id, prevColor }) => _setColorOnEq(id, prevColor));

    } else if (last.action === 'rename') {
      const eq = _getEq(last.data.id);
      if (eq) eq.label = last.data.prevLabel;

    } else if (last.action === 'reorder') {
      _equations = last.data.prevOrder.map(id => _getEq(id)).filter(Boolean);
      _reorderDOMToMatch(last.data.prevOrder);
      _repositionGroupHeaders();

    } else if (last.action === 'bulk-delete') {
      const items = [...last.data.snapshot].sort((a, b) => a.index - b.index);
      items.forEach(({ eq, index }) => {
        _equations.splice(Math.min(index, _equations.length), 0, { ...eq });
        const card = _buildCard(_getEq(eq.id));
        document.getElementById('equation-list').appendChild(card);
        if (window.lucide) lucide.createIcons({ nodes: [card] });
      });
      _reorderDOMToMatch(_equations.map(e => e.id));
      items.forEach(({ eq }) => { if (eq.expr) rebuildOne(eq.id); });
      _repositionGroupHeaders();

    } else if (last.action === 'bulk-duplicate') {
      last.data.snapshots.forEach(({ id }) => {
        Engine.removeMesh(id);
        GraphBuilder.forgetEquation(id);
        _getCard(id)?.remove();
      });
      const ids = new Set(last.data.snapshots.map(s => s.id));
      _equations = _equations.filter(e => !ids.has(e.id));
    }

    _syncCount();
    _updateSelectionUI();
    if (window.ModToast) ModToast.show('Undo', 'info');
  }

  function redo() {
    const last = _redoStack.pop();
    if (!last) return;
    _undoStack.push(last);

    if (last.action === 'add') {
      addEquation({ ...last.data.eq });

    } else if (last.action === 'delete') {
      _deleteEquation(last.data.eq.id);

    } else if (last.action === 'edit') {
      const { id, nextExpr } = last.data;
      const eq    = _getEq(id);
      if (!eq) return;
      eq.expr     = nextExpr;
      const card  = _getCard(id);
      const input = card?.querySelector('.eq-input');
      const hlDiv = card?.querySelector('.eq-highlight-layer');
      if (input) { input.value = nextExpr; if (hlDiv) _refreshHL(input, hlDiv); }
      _scheduleRebuild(eq, card, 80);

    } else if (last.action === 'color') {
      _setColorOnEq(last.data.id, last.data.nextColor);

    } else if (last.action === 'bulk-color') {
      last.data.changes.forEach(({ id, nextColor }) => _setColorOnEq(id, nextColor));

    } else if (last.action === 'rename') {
      const eq = _getEq(last.data.id);
      if (eq) eq.label = last.data.nextLabel;

    } else if (last.action === 'reorder') {
      _equations = last.data.nextOrder.map(id => _getEq(id)).filter(Boolean);
      _reorderDOMToMatch(last.data.nextOrder);
      _repositionGroupHeaders();

    } else if (last.action === 'bulk-delete') {
      last.data.snapshot.forEach(({ eq }) => {
        Engine.removeMesh(eq.id);
        GraphBuilder.forgetEquation(eq.id);
        _getCard(eq.id)?.remove();
      });
      const ids = new Set(last.data.snapshot.map(s => s.eq.id));
      _equations = _equations.filter(e => !ids.has(e.id));

    } else if (last.action === 'bulk-duplicate') {
      last.data.snapshots.forEach(snap => addEquation({ ...snap }));
    }

    _syncCount();
    _updateSelectionUI();
    if (window.ModToast) ModToast.show('Redo', 'info');
  }

  // ══════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════════════════

  function _initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (e.key === 'n' || e.key === 'N') { addEquation(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // H = History panel
      if (e.key === 'h' || e.key === 'H') { openHistory();   return; }
      // F = Favorites panel (Ctrl+F is browser find; bare F opens panel)
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) { openFavorites(); return; }
    });
  }

  // ══════════════════════════════════════════════════════
  // SYNC COUNT — update status bar
  // ══════════════════════════════════════════════════════

  function _syncCount() {
    const n  = _equations.length;
    const el = document.getElementById('equation-count');
    if (el) el.textContent = n + ' equation' + (n !== 1 ? 's' : '');
  }

  // ══════════════════════════════════════════════════════
  // CLEAR ALL
  // ══════════════════════════════════════════════════════

  function clearAll() {
    [..._equations].forEach(eq => {
      Engine.removeMesh(eq.id);
      GraphBuilder.forgetEquation(eq.id);
    });
    _equations = [];
    _groups = [];
    _selectedIds.clear();
    _lastSelectedId = null;
    document.getElementById('equation-list').innerHTML = '';
    Object.keys(_debounceTimers).forEach(id => clearTimeout(_debounceTimers[id]));
    _debounceTimers = {};
    _syncCount();
    _updateBulkActionBar();
  }

  // ══════════════════════════════════════════════════════
  // SERIALIZATION — save / restore
  // ══════════════════════════════════════════════════════

  function serialize() {
    return _equations.map(eq => ({
      expr: eq.expr, type: eq.type, color: eq.color,
      visible: eq.visible, locked: eq.locked, label: eq.label,
      uMin: eq.uMin, uMax: eq.uMax,
      vMin: eq.vMin, vMax: eq.vMax,
      tMin: eq.tMin, tMax: eq.tMax,
      extendTo3D: eq.extendTo3D,
      groupId: eq.groupId,
    }));
  }

  function deserialize(data) {
    if (!Array.isArray(data)) return;
    clearAll();
    data.forEach(d => addEquation(d));
    _repositionGroupHeaders();
  }

  // Opt-in, separate from serialize()/deserialize() so existing callers
  // that only persist the equation array keep working unchanged.
  function serializeGroups() {
    return _groups.map(g => ({ ...g }));
  }

  function deserializeGroups(data) {
    if (!Array.isArray(data)) return;
    _groups = data.map(g => ({ id: g.id, name: g.name || 'Group', collapsed: !!g.collapsed }));
    const maxNum = _groups.reduce((max, g) => {
      const n = parseInt(String(g.id).replace('grp-', ''), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    _groupIdCounter = Math.max(_groupIdCounter, maxNum);
    _repositionGroupHeaders();
  }

  // ══════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════

  function _getEq(id)   { return _equations.find(e => e.id === id) || null; }
  function _getCard(id) { return document.querySelector(`.eq-card[data-id="${id}"]`); }

  function getAll()    { return [..._equations]; }
  function getCount()  { return _equations.length; }
  function getById(id) { return _getEq(id); }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════

  return {
    // Core
    init, addEquation, rebuildAll, rebuildOne, rebuildForChangedVars, clearAll,
    serialize, deserialize, getAll, getCount, getById,
    // Undo / Redo — covers add | delete | edit | color | bulk-color |
    // rename | reorder | bulk-delete | bulk-duplicate
    undo, redo,
    // Search
    searchEquations,
    // Session history
    openHistory, getHistory,
    // Favorites  (localStorage-persisted)
    openFavorites, toggleFavorite, isFavorite, getFavorites,
    // Expression formatting  (also callable externally)
    formatExpression: _formatExpression,
    // Multi-select + bulk actions
    getSelected, clearSelection: _clearSelection,
    // Groups/folders  (opt-in persistence, separate from serialize())
    getGroups, serializeGroups, deserializeGroups,
  };

})();
