/**
 * Graph3D Pro — mod-sliders.js
 * Module 06 — Slider System, Animation Engine, Speed Control, the
 * four Desmos-parity Animation Modes (loop forward-and-back, repeat
 * one direction, play once, play indefinitely — verified against
 * Desmos's own Help Center and their loopMode API naming), Easing
 * (linear/sine/easeInOut/bounce), Step Size, Auto-Detection, Variable
 * Dependencies (with circular-dependency detection), Locked Constants,
 * the built-in Time Variable (t), named Scenes, and URL-shareable state.
 * ~/graph3d-pro/modules/mod-sliders.js
 *
 * Integration notes for the rest of the app:
 *  - Call ModSliders.autoCreateFromExpr(expr) after parsing an
 *    equation (e.g. from mod-equations.js) to auto-create sliders
 *    for any undefined short variable names found in it. Or just
 *    dispatch a DOM event and this module will pick it up itself:
 *      document.dispatchEvent(new CustomEvent('graph3d:expr-changed',
 *        { detail: { expr } }));
 *  - New sliders default to a range of -5 to 5, matching Desmos's own
 *    3D calculator (their 2D calculator and Geometry tool use -10 to
 *    10 — this app is 3D-only, so -5..5 is the considered default
 *    throughout, not a leftover 2D assumption).
 *  - 't' is a reserved, always-available, free-running time variable
 *    (real elapsed seconds, unbounded). You cannot create a slider
 *    named 't' — use playTime()/pauseTime()/resetTime()/setTimeSpeed(),
 *    or the existing global Animate button, to control it.
 *  - pi / e / tau / phi are reserved built-in constants and can't be
 *    used as slider names, so they can never be shadowed inside formulas.
 *  - A small dedicated time-control widget will render itself into
 *    a `#time-control` element if one exists on the page. It's
 *    entirely optional — the time engine works fine without it.
 *  - Scenes render into a `#scene-list` element and a `#save-scene-btn`
 *    if present; also fully usable headlessly via saveScene()/
 *    restoreScene()/deleteScene()/listScenes().
 *  - A circular formula definition (e.g. a=b+1, b=a+1) is rejected
 *    before it's ever stored — setExpression() reverts the attempted
 *    change, shows a toast, and posts a specific "a -> b -> a"-style
 *    message inline on the card, auto-dismissing after a few seconds.
 *  - getShareableState()/applyShareableState() return/consume the
 *    same shape as serialize()/deserialize(). encodeStateForURL()/
 *    decodeStateFromURL() wrap that in a URL-safe base64 string for
 *    mod-share.js to embed however it likes (query param, QR, etc.).
 *    Not wired into mod-share.js yet — that's a separate batch.
 */

const ModSliders = (() => {

  // ── State ──────────────────────────────────────────────
  let _sliders       = new Map();   // name → slider object
  let _scenes        = new Map();   // name → { sliders:{name:{value,playing}}, time:{value,playing} }
  let _animating     = false;
  let _animFrame     = null;
  let _lastFrameTime = null;        // for delta-time (frame-rate independent) animation
  let _time          = { value: 0, playing: false, speed: 1 }; // built-in free-running 't'

  // Animation modes — matches Desmos's own four modes exactly (verified
  // against their Help Center and the public loopMode API: LOOP_FORWARD_
  // REVERSE, LOOP_FORWARD, PLAY_ONCE, PLAY_FOREVER). Internal string
  // values are kept as they were for LOOP/PINGPONG/ONCE (backward
  // compatible with existing saved data); FOREVER is new.
  const ANIM_MODES = {
    PINGPONG: 'pingpong',  // "loop forwards and backwards" — bounces between min/max
    LOOP:     'loop',      // "repeat in one direction" — wraps at the bound, same direction
    ONCE:     'once',      // "play once" — plays once in the current direction, then stops
    FOREVER:  'forever',   // "play indefinitely" — ignores min/max, counts up (or down) forever
  };

  // Easing curves for slider animation, applied per "leg" (one traversal
  // toward the current target bound). Each is defined on [0,1] -> [0,1]
  // and every one of them satisfies f(0)=0 and f(1)=1 by construction —
  // that matters because _beginLeg() relies on f(0)=0 to guarantee a
  // jump-free restart whenever a leg begins (bound bounce, manual drag,
  // reverse click, scene restore — anything that changes the value out
  // from under the animation).
  const EASINGS = {
    linear:    t => t,
    sine:      t => -(Math.cos(Math.PI * t) - 1) / 2,
    easeInOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    bounce:    t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
      if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
      t -= 2.625 / d1; return n1 * t * t + 0.984375;
    },
  };
  const EASING_NAMES = Object.keys(EASINGS);

  // ── Built-in math available to slider formulas ─────────
  const MATH_FUNCTIONS = {
    sin: Math.sin,   cos: Math.cos,   tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt,
    log: Math.log, log2: Math.log2, log10: Math.log10, ln: Math.log,
    exp: Math.exp, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
    min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot,
    mod: (a, b) => ((a % b) + b) % b,
  };

  const BUILTIN_CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

  // Names a slider is never allowed to take — axes, the time variable,
  // and the built-in constants, so formulas can always trust them.
  const RESERVED_NAMES  = new Set(['x', 'y', 'z', 't', ...Object.keys(BUILTIN_CONSTANTS)]);
  const KNOWN_FUNCTIONS = new Set(Object.keys(MATH_FUNCTIONS));

  // ── Slider schema ──────────────────────────────────────
  function _makeSlider(name, opts = {}) {
    const value = opts.value ?? 1;
    return {
      name,
      value,
      min:       opts.min       ?? -5, // Desmos 3D's slider default (their 2D calc uses -10/10)
      max:       opts.max       ?? 5,
      step:      opts.step      ?? 0.01,
      speed:     opts.speed     ?? 1,
      animMode:  opts.animMode  ?? ANIM_MODES.LOOP,
      easing:    EASINGS[opts.easing] ? opts.easing : 'linear',
      playing:   false,
      direction: opts.direction ?? 1,     // 1 forward / -1 reverse
      locked:    opts.locked    ?? false, // true = fixed "global constant", no drag/animate
      expr:      opts.expr      ?? null,  // if set, value is derived from other variables
      // Animation-leg tracking for eased motion — see _beginLeg().
      legStart:  value,
      phase:     0,
    };
  }

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _initAddButton();
    _initGlobalAnimButton();
    _initTimeControl();
    _initAutoDetectHook();
    _initSceneControls();
  }

  // ══════════════════════════════════════════════════════
  // ADD SLIDER
  // ══════════════════════════════════════════════════════

  function addSlider(name, value = 1, opts = {}) {
    // Validated here (not just in the UI prompt) so every entry point —
    // including deserialize(), which may load data from a shared URL —
    // is guaranteed to only ever produce short, clean identifiers. This
    // matters because slider names flow straight into _safeEval's
    // allowed-identifier whitelist.
    // Character-class restriction (letters/digits only, starting with a
    // letter) is the real safety property here — it guarantees this name
    // can never inject anything through new Function's parameter list in
    // _safeEval below, no matter how long it is. The actual "can this
    // reach real globals" boundary is _safeEval's allow-list check
    // (identifiers must be a literal key of the constructed scope
    // object), not name length. A short length cap was previously
    // enforced here as a style convention, but this app's own shipped
    // Physics presets (theta, omega, inc — see mod-presets.js) never
    // actually followed that convention, so their explicitly-declared
    // needsSliders silently failed this check every time. Capped at 24
    // chars purely to keep the slider UI readable, not for safety.
    if (!name || !/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(name)) {
      if (window.ModToast) ModToast.show('"' + name + '" is not a valid variable name', 'error');
      return null;
    }
    if (RESERVED_NAMES.has(String(name).toLowerCase())) {
      if (window.ModToast) ModToast.show('"' + name + '" is reserved', 'error');
      return null;
    }
    if (_sliders.has(name)) return _sliders.get(name);

    const sl = _makeSlider(name, { value, ...opts });
    _sliders.set(name, sl);

    const card = _buildCard(sl);
    document.getElementById('slider-list').appendChild(card);
    if (window.lucide) lucide.createIcons({ nodes: [card] });

    if (sl.expr) _recomputeDerived();
    _syncCount();
    return sl;
  }

  // ══════════════════════════════════════════════════════
  // AUTOMATIC SLIDER CREATION
  // Scans an expression string for short, undefined identifiers
  // (not axes/t/constants/known functions) and can auto-create
  // sliders for them — mirrors the "add missing variable" pattern
  // from tools like Desmos.
  // ══════════════════════════════════════════════════════

  function scanExpression(expr) {
    if (!expr || typeof expr !== 'string') return [];
    const tokens = expr.match(/[a-zA-Z][a-zA-Z0-9]*/g) || [];
    const found = new Set();
    tokens.forEach(tok => {
      const lower = tok.toLowerCase();
      if (RESERVED_NAMES.has(lower)) return;
      if (KNOWN_FUNCTIONS.has(lower)) return;
      if (tok.length > 24) return; // matches addSlider()'s own length cap
      found.add(tok);
    });
    return [...found];
  }

  function autoDetect(expr) {
    return scanExpression(expr).filter(name => !_sliders.has(name));
  }

  function autoCreateFromExpr(expr, opts = {}) {
    const missing = autoDetect(expr);
    const created = [];
    missing.forEach(name => {
      if (addSlider(name, opts.value ?? 1, opts)) created.push(name);
    });
    if (created.length && window.ModToast) {
      ModToast.show(
        'Auto-added slider' + (created.length > 1 ? 's' : '') + ' for ' + created.join(', '),
        'success'
      );
    }
    return created;
  }

  function _initAutoDetectHook() {
    // Optional wiring: mod-equations.js can dispatch this event instead
    // of calling autoCreateFromExpr() directly.
    document.addEventListener('graph3d:expr-changed', e => {
      const expr = e && e.detail && e.detail.expr;
      if (expr) autoCreateFromExpr(expr);
    });
  }

  // ══════════════════════════════════════════════════════
  // BUILD CARD
  // ══════════════════════════════════════════════════════

  function _buildCard(sl) {
    const card = document.createElement('div');
    card.className = 'sl-card';
    card.dataset.name = sl.name;

    card.innerHTML = `
      <div class="sl-header">
        <span class="sl-name">${_displayName(sl)}</span>
        <span class="sl-value">${sl.value.toFixed(2)}</span>
        <div style="display:flex;align-items:center;gap:2px">
          <button class="sl-formula-btn sl-del" title="Define as a formula of other variables"
            style="color:${sl.expr ? 'var(--amber)' : 'var(--t3)'}">
            <i data-lucide="sigma" width="11" height="11"></i>
          </button>
          <button class="sl-lock-btn sl-del" title="Lock as a constant (no drag/animate)"
            style="color:${sl.locked ? 'var(--amber)' : 'var(--t3)'}">
            <i data-lucide="${sl.locked ? 'lock' : 'unlock'}" width="11" height="11"></i>
          </button>
          <button class="sl-rev-btn sl-del" title="Reverse animation direction"
            style="color:${sl.direction < 0 ? 'var(--amber)' : 'var(--t3)'}">
            <i data-lucide="${sl.direction < 0 ? 'rewind' : 'fast-forward'}" width="11" height="11"></i>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:2px;margin-left:6px">
          <button class="sl-play-btn sl-del" title="Animate this slider"
            style="color:var(--t3)">
            <i data-lucide="play" width="11" height="11"></i>
          </button>
          <button class="sl-del" data-action="delete" title="Remove slider">
            <i data-lucide="x" width="11" height="11"></i>
          </button>
        </div>
      </div>
      <input class="sl-range" type="range" aria-label="Value of ${sl.name}"
        min="${sl.min}" max="${sl.max}"
        step="${sl.step}" value="${sl.value}"/>
      <div class="sl-error" style="display:none;color:#e5484d;font-size:9.5px;
           line-height:1.3;margin:2px 0 0"></div>
      <input class="sl-const-input" type="number" value="${sl.value}" step="any"
        style="display:none;width:100%;box-sizing:border-box;background:var(--s2);
               border:1px solid var(--b1);color:var(--t2);border-radius:3px;
               padding:3px 6px;font-size:11px;margin:4px 0" title="Constant value"/>
      <div class="sl-footer sl-footer-1">
        <input class="sl-bound-input sl-min-input"
          type="number" value="${sl.min}" step="any" title="Min"/>
        <input class="sl-bound-input sl-max-input"
          type="number" value="${sl.max}" step="any" title="Max"/>
        <input class="sl-bound-input sl-step-input"
          type="number" value="${sl.step}" step="any" min="0.0001" title="Step size"/>
      </div>
      <div class="sl-footer sl-footer-2" style="margin-top:3px">
        <div class="sl-speed-wrap">
          <span>spd</span>
          <input class="sl-speed-input"
            type="number" value="${sl.speed}"
            step="0.1" min="0.01" max="20" title="Animation speed"/>
        </div>
        <select class="sl-mode-select" title="Animation mode"
          style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);
                 font-size:9.5px;padding:1px 3px;border-radius:3px;cursor:pointer">
          <option value="pingpong">Loop forward-and-back</option>
          <option value="loop">Repeat one direction</option>
          <option value="once">Play once</option>
          <option value="forever">Play indefinitely</option>
        </select>
        <select class="sl-easing-select" title="Easing curve"
          style="background:var(--s2);border:1px solid var(--b1);color:var(--t2);
                 font-size:9.5px;padding:1px 3px;border-radius:3px;cursor:pointer;
                 margin-left:auto">
          <option value="linear">Linear</option>
          <option value="sine">Sine</option>
          <option value="easeInOut">Ease in-out</option>
          <option value="bounce">Bounce</option>
        </select>
      </div>
    `;

    const range      = card.querySelector('.sl-range');
    const disp       = card.querySelector('.sl-value');
    const constInput = card.querySelector('.sl-const-input');
    const select      = card.querySelector('.sl-mode-select');
    select.value = sl.animMode; // fixes a pre-existing bug: this was never synced before
    const easingSelect = card.querySelector('.sl-easing-select');
    easingSelect.value = sl.easing;
    _updateEasingAvailability(easingSelect, sl.animMode);

    // ── Range input ──────────────────────────────────────
    range.addEventListener('input', () => {
      sl.value = parseFloat(range.value);
      disp.textContent = sl.value.toFixed(2);
      if (sl.playing) _beginLeg(sl); // dragging mid-animation shouldn't cause a jump next frame
      _recomputeDerived();
      _rebuildAll();
    });

    // ── Constant value input (shown only when locked) ────
    constInput.addEventListener('change', e => {
      const v = parseFloat(e.target.value);
      if (!Number.isNaN(v)) {
        sl.value = v;
        _updateCardUI(sl.name, v);
        _recomputeDerived();
        _rebuildAll();
      }
    });

    // ── Min / Max (clamps + keeps the range sane) ────────
    card.querySelector('.sl-min-input').addEventListener('change', e => {
      let v = parseFloat(e.target.value);
      if (Number.isNaN(v)) v = sl.min;
      if (v >= sl.max) v = sl.max - sl.step;
      sl.min = v;
      e.target.value = v;
      range.min = v;
      if (sl.value < v) {
        sl.value = v;
        _updateCardUI(sl.name, v);
        if (sl.playing) _beginLeg(sl);
        _recomputeDerived();
        _rebuildAll();
      }
    });

    card.querySelector('.sl-max-input').addEventListener('change', e => {
      let v = parseFloat(e.target.value);
      if (Number.isNaN(v)) v = sl.max;
      if (v <= sl.min) v = sl.min + sl.step;
      sl.max = v;
      e.target.value = v;
      range.max = v;
      if (sl.value > v) {
        sl.value = v;
        _updateCardUI(sl.name, v);
        if (sl.playing) _beginLeg(sl);
        _recomputeDerived();
        _rebuildAll();
      }
    });

    // ── Step size ─────────────────────────────────────────
    card.querySelector('.sl-step-input').addEventListener('change', e => {
      let v = parseFloat(e.target.value);
      if (Number.isNaN(v) || v <= 0) v = sl.step;
      sl.step = v;
      e.target.value = v;
      range.step = v;
    });

    // ── Speed ────────────────────────────────────────────
    card.querySelector('.sl-speed-input').addEventListener('change', e => {
      sl.speed = Math.max(0.01, parseFloat(e.target.value) || 1);
    });

    // ── Anim mode ────────────────────────────────────────
    select.addEventListener('change', e => {
      const wasForever = sl.animMode === ANIM_MODES.FOREVER;
      sl.animMode = e.target.value;
      if (wasForever && sl.animMode !== ANIM_MODES.FOREVER) {
        // "Play indefinitely" ignores min/max, so the value may be way
        // outside them by now. Snap back into range immediately rather
        // than let a bounded mode ease slowly back from far outside the
        // track, which could look stuck for several seconds.
        const clamped = Math.max(sl.min, Math.min(sl.max, sl.value));
        if (clamped !== sl.value) {
          sl.value = clamped;
          _updateCardUI(sl.name, sl.value);
        }
      }
      if (sl.playing) _beginLeg(sl); // resync so switching modes mid-flight doesn't jump
      _updateEasingAvailability(easingSelect, sl.animMode);
    });

    // ── Easing curve ──────────────────────────────────────
    easingSelect.addEventListener('change', e => {
      sl.easing = e.target.value;
    });

    // ── Reverse direction toggle ─────────────────────────
    const revBtn = card.querySelector('.sl-rev-btn');
    revBtn.addEventListener('click', () => {
      sl.direction *= -1;
      if (sl.playing) _beginLeg(sl); // continue smoothly toward the new target
      _updateRevBtn(revBtn, sl.direction);
    });

    // ── Lock as constant ──────────────────────────────────
    const lockBtn = card.querySelector('.sl-lock-btn');
    lockBtn.addEventListener('click', () => {
      sl.locked = !sl.locked;
      if (sl.locked) sl.playing = false;
      _updateLockBtn(lockBtn, sl.locked);
      _applyCardState(card, sl);
      _updateAllPlayBtns();
    });

    // ── Formula / dependency toggle ───────────────────────
    const formulaBtn = card.querySelector('.sl-formula-btn');
    formulaBtn.addEventListener('click', () => {
      const input = prompt(
        'Define "' + sl.name + '" as a formula of other variables (e.g. "2*a + sin(b)").\n' +
        'Leave blank to make it an independent slider again:',
        sl.expr || ''
      );
      if (input === null) return; // cancelled
      const ok = setExpression(sl.name, input);
      if (ok) {
        _rebuildAll();
        if (window.ModToast) {
          ModToast.show(
            sl.expr ? '"' + sl.name + '" is now derived' : '"' + sl.name + '" is now independent',
            'success'
          );
        }
      }
    });

    // ── Per-slider play button ───────────────────────────
    const playBtn = card.querySelector('.sl-play-btn');
    playBtn.addEventListener('click', () => {
      sl.playing = !sl.playing;
      if (sl.playing) _beginLeg(sl);
      _updatePlayBtn(playBtn, sl.playing);
      if (sl.playing && !_animating) _startGlobalAnim();
    });

    // ── Delete ───────────────────────────────────────────
    card.querySelector('[data-action="delete"]').addEventListener('click', () => {
      _removeSlider(sl.name);
    });

    // ── Double-click name to rename ──────────────────────
    card.querySelector('.sl-name').addEventListener('dblclick', () => {
      const newName = prompt('Rename slider:', sl.name);
      if (!newName || newName === sl.name) return;
      const clean = newName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 2);
      if (!clean) return;
      _renameSlider(sl.name, clean);
    });

    _applyCardState(card, sl);
    return card;
  }

  function _displayName(sl) {
    return sl.expr ? sl.name + ' = ' + sl.expr : sl.name;
  }

  // Shows/hides controls depending on whether a slider is a plain
  // draggable slider, a locked constant, or a derived/formula variable.
  function _applyCardState(card, sl) {
    const isDerived = !!sl.expr;
    const isLocked  = sl.locked && !isDerived;
    const isPlain   = !isDerived && !isLocked;

    const range      = card.querySelector('.sl-range');
    const constInput = card.querySelector('.sl-const-input');
    const footer1    = card.querySelector('.sl-footer-1');
    const footer2    = card.querySelector('.sl-footer-2');
    const playBtn    = card.querySelector('.sl-play-btn');
    const revBtn     = card.querySelector('.sl-rev-btn');
    const lockBtn    = card.querySelector('.sl-lock-btn');
    const formulaBtn = card.querySelector('.sl-formula-btn');
    const nameEl     = card.querySelector('.sl-name');
    const errorEl    = card.querySelector('.sl-error');

    if (nameEl)      nameEl.textContent   = _displayName(sl);
    if (range)       range.setAttribute('aria-label', 'Value of ' + sl.name);
    if (range)       range.style.display      = isPlain  ? '' : 'none';
    if (constInput)  constInput.style.display = isLocked ? '' : 'none';
    if (footer1)     footer1.style.display    = isPlain  ? '' : 'none';
    if (footer2)     footer2.style.display    = isPlain  ? '' : 'none';
    if (playBtn)     playBtn.style.display    = isPlain  ? '' : 'none';
    if (revBtn)      revBtn.style.display     = isPlain  ? '' : 'none';
    if (lockBtn)     lockBtn.style.display    = isDerived ? 'none' : '';
    if (formulaBtn)  formulaBtn.style.color   = isDerived ? 'var(--amber)' : 'var(--t3)';
    if (errorEl) {
      // _applyCardState only ever runs after a SUCCESSFUL change, so any
      // error left over from an earlier rejected attempt is now stale.
      errorEl.style.display = 'none';
      clearTimeout(errorEl._hideTimer);
    }
  }

  function _updatePlayBtn(btn, playing) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', playing ? 'pause' : 'play');
    btn.style.color = playing ? 'var(--amber)' : 'var(--t3)';
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }

  function _updateRevBtn(btn, direction) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', direction < 0 ? 'rewind' : 'fast-forward');
    btn.style.color = direction < 0 ? 'var(--amber)' : 'var(--t3)';
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }

  function _updateLockBtn(btn, locked) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', locked ? 'lock' : 'unlock');
    btn.style.color = locked ? 'var(--amber)' : 'var(--t3)';
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }

  // Easing shapes progress across a bounded leg (toward a min/max target);
  // "play indefinitely" has no target to ease toward, so grey the control
  // out rather than leave a setting visible that silently does nothing.
  function _updateEasingAvailability(easingSelect, animMode) {
    if (!easingSelect) return;
    const disabled = animMode === ANIM_MODES.FOREVER;
    easingSelect.disabled = disabled;
    easingSelect.style.opacity = disabled ? '0.35' : '';
  }

  // ══════════════════════════════════════════════════════
  // REMOVE SLIDER
  // ══════════════════════════════════════════════════════

  function _removeSlider(name) {
    const dependents = [];
    _sliders.forEach((other, n) => {
      if (n !== name && other.expr && new RegExp('\\b' + name + '\\b').test(other.expr)) {
        dependents.push(n);
      }
    });

    _sliders.delete(name);
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (card) {
      card.style.transition = 'opacity .15s, transform .15s';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(-8px)';
      setTimeout(() => card.remove(), 160);
    }

    if (dependents.length && window.ModToast) {
      ModToast.show('"' + dependents.join(', ') + '" depended on "' + name + '"', 'error');
    }

    _recomputeDerived();
    _rebuildAll();
    _syncCount();
  }

  function removeSlider(name) {
    _removeSlider(name);
  }

  // ══════════════════════════════════════════════════════
  // RENAME SLIDER
  // ══════════════════════════════════════════════════════

  function _renameSlider(oldName, newName) {
    if (RESERVED_NAMES.has(newName.toLowerCase())) {
      if (window.ModToast) ModToast.show('"' + newName + '" is reserved', 'error');
      return;
    }
    if (_sliders.has(newName)) {
      if (window.ModToast) ModToast.show('"' + newName + '" already exists', 'error');
      return;
    }
    const sl = _sliders.get(oldName);
    if (!sl) return;

    sl.name = newName;
    _sliders.delete(oldName);
    _sliders.set(newName, sl);

    // Keep any formulas that referenced the old name pointing at the new one
    const pattern = new RegExp('\\b' + oldName + '\\b', 'g');
    _sliders.forEach(other => {
      if (other.expr && pattern.test(other.expr)) {
        other.expr = other.expr.replace(pattern, newName);
      }
    });

    const card = document.querySelector(`.sl-card[data-name="${oldName}"]`);
    if (card) {
      card.dataset.name = newName;
      _applyCardState(card, sl);
    }
    // Refresh any other cards whose displayed formula mentioned the old name
    _sliders.forEach((other, name) => {
      if (other.expr) {
        const c = document.querySelector(`.sl-card[data-name="${name}"]`);
        if (c) _applyCardState(c, other);
      }
    });

    _recomputeDerived();
    _rebuildAll();
  }

  // ══════════════════════════════════════════════════════
  // VARIABLE DEPENDENCIES (derived / formula sliders)
  // ══════════════════════════════════════════════════════

  function setExpression(name, exprInput) {
    const sl = _sliders.get(name);
    if (!sl) return false;

    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    const expr = (exprInput || '').trim();

    if (!expr) {
      sl.expr = null;
      if (card) _applyCardState(card, sl);
      _recomputeDerived();
      return true;
    }

    autoCreateFromExpr(expr); // make sure every referenced variable exists first

    const prevExpr = sl.expr;
    sl.expr = expr;
    const cycle = _findCycle();
    if (cycle) {
      sl.expr = prevExpr;
      const path = _rotateCycleTo(cycle, name).join(' \u2192 ');
      const msg = 'Circular dependency: ' + path;
      if (window.ModToast) ModToast.show(msg, 'error');
      _showCardError(name, msg);
      return false;
    }

    sl.playing = false; // derived variables don't animate independently
    if (card) _applyCardState(card, sl);
    _recomputeDerived();
    return true;
  }

  function _dependencyMap() {
    const map = new Map();
    _sliders.forEach((sl, name) => {
      map.set(name, sl.expr ? scanExpression(sl.expr).filter(n => _sliders.has(n)) : []);
    });
    return map;
  }

  // Returns the cycle as an ordered array like ['a','b','a'] (the last
  // element repeats the first, closing the loop), or null if the current
  // dependency graph is acyclic. Uses the standard white/gray/black DFS
  // marking (visited = done, visiting = currently on the call stack) so
  // it always terminates in O(V+E) regardless of graph shape — it cannot
  // loop forever or blow the stack even if the data were somehow already
  // cyclic (e.g. hand-edited save data).
  function _findCycle() {
    const map = _dependencyMap();
    const visiting = new Set(), visited = new Set();
    const stack = [];
    let found = null;

    function dfs(n) {
      if (found || visited.has(n)) return;
      if (visiting.has(n)) {
        const idx = stack.indexOf(n);
        found = stack.slice(idx).concat(n);
        return;
      }
      visiting.add(n);
      stack.push(n);
      for (const dep of (map.get(n) || [])) {
        dfs(dep);
        if (found) break;
      }
      stack.pop();
      visiting.delete(n);
      visited.add(n);
    }

    for (const n of map.keys()) {
      dfs(n);
      if (found) break;
    }
    return found;
  }

  // Rotates a cycle array so it reads starting from `start` (the variable
  // the person was just editing), purely for a more intuitive message —
  // e.g. reports "b -> a -> b" rather than "a -> b -> a" when the person
  // was the one who just tried to define "b".
  function _rotateCycleTo(cycle, start) {
    if (!cycle || cycle.length < 2) return cycle || [];
    const core = cycle.slice(0, -1);
    const idx = core.indexOf(start);
    if (idx === -1) return cycle;
    const rotated = core.slice(idx).concat(core.slice(0, idx));
    return rotated.concat(rotated[0]);
  }

  // Dependencies-before-dependents ordering. Guards against ever
  // infinite-looping even if a cycle somehow made it into the data.
  function _topoOrder() {
    const map = _dependencyMap();
    const order = [];
    const visited = new Set(), visiting = new Set();
    function dfs(n) {
      if (visited.has(n) || visiting.has(n)) return;
      visiting.add(n);
      (map.get(n) || []).forEach(dfs);
      visiting.delete(n);
      visited.add(n);
      order.push(n);
    }
    [..._sliders.keys()].forEach(dfs);
    return order;
  }

  function _recomputeDerived() {
    const order = _topoOrder();
    if (!order.length) return;

    const scope = { t: _time.value };
    _sliders.forEach((s2, n2) => { scope[n2] = s2.value; });

    order.forEach(name => {
      const sl = _sliders.get(name);
      if (!sl || !sl.expr) return;
      const result = _safeEval(sl.expr, scope);
      sl.value = result;
      scope[name] = result;
      _updateCardUI(name, result);
    });
  }

  // Evaluates a formula against a fixed, explicit set of variables and
  // math functions ONLY. Every bare identifier in the expression must
  // be one of those known-safe names or the whole expression is
  // rejected — this matters because saved/shared graphs (mod-share.js)
  // may be opened by someone other than the person who typed the
  // formula, so this can't be allowed to reach real globals like
  // `window`, `fetch`, or `document` no matter how it's phrased.
  function _safeEval(expr, extraScope) {
    if (typeof expr !== 'string' || !expr.trim()) return NaN;
    if (!/^[a-zA-Z0-9_+\-*/%^.,()\s]*$/.test(expr)) return NaN;

    const body = expr
      .replace(/\^/g, '**')
      .replace(/(\d)(\s*)([a-zA-Z(])/g, '$1*$3')   // implicit mult: 2a → 2*a, 2( → 2*(
      .replace(/([a-zA-Z][a-zA-Z0-9]*)(\s*)\(/g, (m, ident) =>
        KNOWN_FUNCTIONS.has(ident.toLowerCase()) ? m : ident + '*(') // a(b) → a*(b), but sin(a) stays sin(a)
      .replace(/(\))(\s*)([0-9a-zA-Z(])/g, ')*$3'); // )a, )( → )*a, )*(

    const scope = { ...MATH_FUNCTIONS, ...BUILTIN_CONSTANTS, ...extraScope };
    const allowedNames = new Set(Object.keys(scope));

    const idents = body.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    for (const id of idents) {
      if (!allowedNames.has(id)) return NaN;
    }

    const keys = Object.keys(scope);
    const vals = keys.map(k => scope[k]);

    try {
      const fn = new Function(...keys, `"use strict"; return (${body});`);
      const result = fn(...vals);
      return typeof result === 'number' && Number.isFinite(result) ? result : NaN;
    } catch (err) {
      return NaN;
    }
  }

  // ══════════════════════════════════════════════════════
  // GLOBAL ANIMATE BUTTON  (top bar)
  // ══════════════════════════════════════════════════════

  function _initGlobalAnimButton() {
    const btn = document.getElementById('anim-btn');
    if (!btn) return;
    btn.addEventListener('click', toggleGlobalAnimation);
  }

  function toggleGlobalAnimation() {
    if (_animating) {
      _stopGlobalAnim();
    } else {
      _time.playing = true;
      const timeBtn = document.getElementById('time-play-btn');
      if (timeBtn) _updatePlayBtn(timeBtn, true);

      _sliders.forEach(sl => {
        if (!sl.locked && !sl.expr) {
          sl.playing = true;
          _beginLeg(sl);
        }
      });
      _updateAllPlayBtns();
      _startGlobalAnim();
    }
  }

  function _startGlobalAnim() {
    if (_animating) return;
    _animating = true;
    _lastFrameTime = null;

    const btn = document.getElementById('anim-btn');
    if (btn) {
      btn.classList.add('on');
      btn.innerHTML = '<i data-lucide="pause" width="12" height="12"></i><span> Pause</span>';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }

    _animFrame = requestAnimationFrame(_tick);
  }

  function _stopGlobalAnim() {
    _animating = false;
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    _lastFrameTime = null;

    _sliders.forEach(sl => { sl.playing = false; });
    _time.playing = false;
    _updateAllPlayBtns();
    const timeBtn = document.getElementById('time-play-btn');
    if (timeBtn) _updatePlayBtn(timeBtn, false);

    const btn = document.getElementById('anim-btn');
    if (btn) {
      btn.classList.remove('on');
      btn.innerHTML = '<i data-lucide="play" width="12" height="12"></i><span> Animate</span>';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }
  }

  function _updateAllPlayBtns() {
    _sliders.forEach(sl => {
      const card = document.querySelector(`.sl-card[data-name="${sl.name}"]`);
      if (!card) return;
      const btn = card.querySelector('.sl-play-btn');
      _updatePlayBtn(btn, sl.playing);
    });
  }

  // ══════════════════════════════════════════════════════
  // ANIMATION TICK  (delta-time based — same speed at any framerate)
  // ══════════════════════════════════════════════════════

  const BASE_SPEED_PER_SEC = 1.08; // ≈ the old 0.018 rad/frame, rebased to rad/sec @ 60fps

  function _legTarget(sl) {
    return sl.direction > 0 ? sl.max : sl.min;
  }

  // Begins a fresh eased leg starting from wherever the slider's value
  // currently is. Every entry in EASINGS satisfies f(0)=0, so this is
  // ALWAYS continuous no matter what triggered it — a natural bound
  // bounce, a manual drag mid-animation, a reverse-direction click, a
  // min/max edit that clamped the value, or a scene restore. Without
  // this, resuming eased motion from an arbitrary point would require
  // inverting the easing curve, which has no clean solution for a
  // non-monotonic curve like bounce.
  function _beginLeg(sl) {
    sl.legStart = sl.value;
    sl.phase = 0;
  }

  function _tick(now) {
    if (!_animating) return;

    if (_lastFrameTime == null) _lastFrameTime = now;
    const dt = Math.min(0.1, Math.max(0, (now - _lastFrameTime) / 1000));
    _lastFrameTime = now;

    let anyPlaying = false;
    // Which variables actually moved this frame — passed to
    // ModEquations.rebuildForChangedVars() below so only equations that
    // reference one of them get rebuilt, instead of every equation on
    // the graph. Rebuilding everything unconditionally here (the
    // previous behavior) was the root cause of the whole app hanging as
    // soon as an animation started: with an implicit/isosurface
    // equation anywhere on the graph, redoing its marching-cubes pass
    // 60 times a second — even though it never referenced the
    // animating variable — was enough to saturate the main thread and
    // make every button in the app feel unresponsive.
    const changedVars = new Set();

    if (_time.playing) {
      anyPlaying = true;
      _time.value += dt * _time.speed;
      _updateTimeUI();
      changedVars.add('t');
    }

    _sliders.forEach((sl, name) => {
      if (sl.expr || sl.locked) return; // derived/constant — never auto-animates
      if (!sl.playing) return;
      anyPlaying = true;
      changedVars.add(name);

      if (sl.animMode === ANIM_MODES.FOREVER) {
        // Ignores min/max entirely once playing — same idea as the
        // built-in time variable, just per-slider. No easing curve
        // applies here since there's no bounded leg to shape progress
        // across; it's constant velocity, indefinitely, in either
        // direction depending on the reverse toggle.
        sl.value += BASE_SPEED_PER_SEC * sl.speed * dt * sl.direction;
        _updateCardUI(name, sl.value);
        return;
      }

      const range = sl.max - sl.min;
      if (range <= 0) return;

      const target = _legTarget(sl);
      const span   = target - sl.legStart;
      const easeFn = EASINGS[sl.easing] || EASINGS.linear;

      const phaseStep = (BASE_SPEED_PER_SEC * sl.speed * dt) / Math.max(1e-9, Math.abs(span));
      sl.phase = Math.min(1, sl.phase + phaseStep);
      sl.value = sl.legStart + easeFn(sl.phase) * span;

      if (sl.phase >= 1) {
        const btnSel = `.sl-card[data-name="${name}"] .sl-play-btn`;
        if (sl.animMode === ANIM_MODES.ONCE) {
          sl.value = target;
          sl.playing = false;
          _updatePlayBtn(document.querySelector(btnSel), false);
        } else if (sl.animMode === ANIM_MODES.PINGPONG) {
          sl.value = target;
          sl.direction *= -1;
          _beginLeg(sl);
        } else { // LOOP — sawtooth: jump back to the start bound, same direction
          sl.value = sl.direction > 0 ? sl.min : sl.max;
          _beginLeg(sl);
        }
      }

      _updateCardUI(name, sl.value);
    });

    _recomputeDerived();
    // _recomputeDerived() re-evaluates every derived (formula) slider
    // unconditionally each tick, regardless of whether its inputs
    // actually changed — so conservatively treat all of them as
    // "changed" too. This can rebuild a handful of equations that
    // didn't strictly need it in rare cases, but it can never MISS one
    // that did, which is the property that actually matters here.
    _sliders.forEach((sl, name) => { if (sl.expr) changedVars.add(name); });

    if (!anyPlaying) {
      _stopGlobalAnim();
      return;
    }

    if (window.ModEquations) ModEquations.rebuildForChangedVars(changedVars);
    _animFrame = requestAnimationFrame(_tick);
  }

  function _updateCardUI(name, value) {
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (!card) return;
    const range      = card.querySelector('.sl-range');
    const disp       = card.querySelector('.sl-value');
    const constInput = card.querySelector('.sl-const-input');
    const bad = Number.isNaN(value);

    if (range && !bad) range.value = value;
    if (disp) {
      disp.textContent = bad ? '—' : value.toFixed(2);
      disp.style.color = bad ? '#e5484d' : '';
    }
    if (constInput && document.activeElement !== constInput && !bad) {
      constInput.value = value;
    }
  }

  // Shows a specific, persistent (auto-dismissing) error message directly
  // on the card involved — e.g. a circular-dependency rejection — rather
  // than relying solely on a toast that's easy to miss or that doesn't
  // say which slider was the problem.
  function _showCardError(name, message, ms = 6000) {
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (!card) return;
    const el = card.querySelector('.sl-error');
    if (!el) return;
    el.textContent = message;
    el.style.display = '';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
  }

  // ══════════════════════════════════════════════════════
  // TIME VARIABLE (t) — always-on, free-running, unbounded
  // ══════════════════════════════════════════════════════

  function _initTimeControl() {
    const host = document.getElementById('time-control');
    if (!host) return; // optional widget — the time engine works without it

    host.innerHTML = `
      <div class="sl-card sl-time-card">
        <div class="sl-header">
          <span class="sl-name">t <span style="opacity:.55;font-size:9px">(time)</span></span>
          <span class="sl-value" id="time-value-disp">${_time.value.toFixed(2)}</span>
          <div style="display:flex;align-items:center;gap:2px;margin-left:6px">
            <button class="sl-play-btn sl-del" id="time-play-btn" title="Play/pause time"
              style="color:var(--t3)">
              <i data-lucide="play" width="11" height="11"></i>
            </button>
            <button class="sl-del" id="time-reset-btn" title="Reset time to 0">
              <i data-lucide="rotate-ccw" width="11" height="11"></i>
            </button>
          </div>
        </div>
        <div class="sl-footer">
          <div class="sl-speed-wrap">
            <span>spd</span>
            <input class="sl-speed-input" id="time-speed-input" type="number"
              value="${_time.speed}" step="0.1" min="0.01" max="20" title="Time speed"/>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [host] });

    document.getElementById('time-play-btn').addEventListener('click', () => {
      _time.playing = !_time.playing;
      _updatePlayBtn(document.getElementById('time-play-btn'), _time.playing);
      if (_time.playing && !_animating) _startGlobalAnim();
    });

    document.getElementById('time-reset-btn').addEventListener('click', resetTime);

    document.getElementById('time-speed-input').addEventListener('change', e => {
      _time.speed = Math.max(0.01, parseFloat(e.target.value) || 1);
    });
  }

  function _updateTimeUI() {
    const disp = document.getElementById('time-value-disp');
    if (disp) disp.textContent = _time.value.toFixed(2);
  }

  function playTime() {
    _time.playing = true;
    _updatePlayBtn(document.getElementById('time-play-btn'), true);
    if (!_animating) _startGlobalAnim();
  }

  function pauseTime() {
    _time.playing = false;
    _updatePlayBtn(document.getElementById('time-play-btn'), false);
  }

  function resetTime() {
    _time.value = 0;
    _updateTimeUI();
    _recomputeDerived();
    _rebuildAll();
  }

  function setTimeSpeed(v) {
    _time.speed = Math.max(0.01, v || 1);
    const el = document.getElementById('time-speed-input');
    if (el) el.value = _time.speed;
  }

  function getTime() { return _time.value; }

  // ══════════════════════════════════════════════════════
  // SCENES — named snapshots of every slider's value and play
  // state, restored instantly (no tweening). For demos/teaching:
  // set sliders up for one configuration, save it, set up
  // another, save that too, then jump between them on demand.
  // ══════════════════════════════════════════════════════

  function saveScene(name) {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) {
      if (window.ModToast) ModToast.show('Give the scene a name', 'error');
      return false;
    }
    if (_scenes.has(clean) && !confirm('Overwrite existing scene "' + clean + '"?')) {
      return false;
    }

    const sliders = {};
    _sliders.forEach((sl, n) => { sliders[n] = { value: sl.value, playing: sl.playing }; });
    _scenes.set(clean, { sliders, time: { value: _time.value, playing: _time.playing } });

    _renderScenes();
    if (window.ModToast) ModToast.show('Scene "' + clean + '" saved', 'success');
    return true;
  }

  function restoreScene(name) {
    const scene = _scenes.get(name);
    if (!scene) return false;

    Object.entries(scene.sliders).forEach(([n, snap]) => {
      const sl = _sliders.get(n);
      if (!sl || sl.expr) return; // skip sliders that no longer exist or are now derived
      sl.value = Math.min(sl.max, Math.max(sl.min, snap.value));
      sl.playing = !!snap.playing && !sl.locked;
      if (sl.playing) _beginLeg(sl);
      _updateCardUI(n, sl.value);
      _updatePlayBtn(document.querySelector(`.sl-card[data-name="${n}"] .sl-play-btn`), sl.playing);
    });

    if (scene.time) {
      _time.value   = scene.time.value;
      _time.playing = !!scene.time.playing;
      _updateTimeUI();
      _updatePlayBtn(document.getElementById('time-play-btn'), _time.playing);
    }

    if (!_animating && (_time.playing || [..._sliders.values()].some(sl => sl.playing))) {
      _startGlobalAnim();
    }

    _recomputeDerived();
    _rebuildAll();
    if (window.ModToast) ModToast.show('Scene "' + name + '" restored', 'success');
    return true;
  }

  function deleteScene(name) {
    _scenes.delete(name);
    _renderScenes();
  }

  function listScenes() {
    return [..._scenes.keys()];
  }

  function _renderScenes() {
    const list = document.getElementById('scene-list');
    if (!list) return; // optional UI — scenes work fine through the API without it
    list.innerHTML = '';
    _scenes.forEach((scene, name) => {
      const row = document.createElement('div');
      row.className = 'sl-card sl-scene-row';
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
        'gap:6px;padding:4px 8px;cursor:pointer';
      row.innerHTML = `
        <span class="sl-name">${name}</span>
        <button class="sl-del" data-action="delete-scene" title="Delete scene">
          <i data-lucide="x" width="11" height="11"></i>
        </button>
      `;
      row.addEventListener('click', e => {
        if (e.target.closest('[data-action="delete-scene"]')) return;
        restoreScene(name);
      });
      row.querySelector('[data-action="delete-scene"]').addEventListener('click', e => {
        e.stopPropagation();
        deleteScene(name);
      });
      list.appendChild(row);
    });
    if (window.lucide) lucide.createIcons({ nodes: [list] });
  }

  function _initSceneControls() {
    const btn = document.getElementById('save-scene-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const name = prompt('Save current values as a scene named:', '');
        if (name === null) return;
        saveScene(name);
      });
    }
    _renderScenes();
  }

  // ══════════════════════════════════════════════════════
  // ADD SLIDER BUTTON
  // ══════════════════════════════════════════════════════

  function _initAddButton() {
    const btn = document.getElementById('add-slider-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const raw = prompt('Variable name (single letter, e.g. a, b, k):', 'a');
      if (!raw) return;
      const name = raw.trim().replace(/[^a-zA-Z]/g, '').slice(0, 2);
      if (!name) {
        if (window.ModToast) ModToast.show('Use a single letter like a, b, or k', 'error');
        return;
      }
      if (RESERVED_NAMES.has(name.toLowerCase())) {
        if (window.ModToast) ModToast.show('"' + name + '" is reserved (built-in)', 'error');
        return;
      }
      if (_sliders.has(name)) {
        if (window.ModToast) ModToast.show('"' + name + '" already exists', 'error');
        return;
      }
      addSlider(name);
      if (window.ModToast) ModToast.show('Slider "' + name + '" added', 'success');
    });
  }

  // ══════════════════════════════════════════════════════
  // EXTERNAL SETTERS — e.g. from AI, presets, or other modules
  // ══════════════════════════════════════════════════════

  function setValue(name, value) {
    const sl = _sliders.get(name);
    if (!sl) return;
    sl.value = Math.max(sl.min, Math.min(sl.max, value));
    if (sl.playing) _beginLeg(sl);
    _updateCardUI(name, sl.value);
    _recomputeDerived();
    _rebuildAll();
  }

  function setRange(name, min, max) {
    const sl = _sliders.get(name);
    if (!sl) return;
    sl.min = min;
    sl.max = max;
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (!card) return;
    const range = card.querySelector('.sl-range');
    const minIn = card.querySelector('.sl-min-input');
    const maxIn = card.querySelector('.sl-max-input');
    if (range) { range.min = min; range.max = max; }
    if (minIn) minIn.value = min;
    if (maxIn) maxIn.value = max;
  }

  function setStep(name, step) {
    const sl = _sliders.get(name);
    if (!sl || !(step > 0)) return;
    sl.step = step;
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (!card) return;
    const range  = card.querySelector('.sl-range');
    const stepIn = card.querySelector('.sl-step-input');
    if (range)  range.step = step;
    if (stepIn) stepIn.value = step;
  }

  function setDirection(name, dir) {
    const sl = _sliders.get(name);
    if (!sl) return;
    sl.direction = dir < 0 ? -1 : 1;
    if (sl.playing) _beginLeg(sl);
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (card) _updateRevBtn(card.querySelector('.sl-rev-btn'), sl.direction);
  }

  function reverseSlider(name) {
    const sl = _sliders.get(name);
    if (!sl) return;
    setDirection(name, sl.direction * -1);
  }

  function setEasing(name, easing) {
    const sl = _sliders.get(name);
    if (!sl || !EASINGS[easing]) return;
    sl.easing = easing;
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    const sel = card && card.querySelector('.sl-easing-select');
    if (sel) sel.value = easing;
  }

  function lockSlider(name, locked = true) {
    const sl = _sliders.get(name);
    if (!sl) return;
    sl.locked = locked;
    if (locked) sl.playing = false;
    const card = document.querySelector(`.sl-card[data-name="${name}"]`);
    if (!card) return;
    _updateLockBtn(card.querySelector('.sl-lock-btn'), sl.locked);
    _applyCardState(card, sl);
    _updateAllPlayBtns();
  }

  // ══════════════════════════════════════════════════════
  // GET VALUES  — called by graph-builder via MathEngine
  // ══════════════════════════════════════════════════════

  function getValues() {
    const out = { ...BUILTIN_CONSTANTS, t: _time.value };
    _sliders.forEach((sl, name) => { out[name] = sl.value; });
    return out;
  }

  function has(name) {
    if (name === 't' || Object.prototype.hasOwnProperty.call(BUILTIN_CONSTANTS, name)) return true;
    return _sliders.has(name);
  }

  function get(name) {
    if (name === 't') {
      return { name: 't', value: _time.value, speed: _time.speed, playing: _time.playing,
               locked: false, expr: null, builtin: true };
    }
    return _sliders.get(name) || null;
  }

  function getAll() {
    const out = [];
    _sliders.forEach(sl => out.push({ ...sl }));
    return out;
  }

  // ══════════════════════════════════════════════════════
  // REBUILD TRIGGER
  // ══════════════════════════════════════════════════════

  function _rebuildAll() {
    if (window.ModEquations) ModEquations.rebuildAll();
  }

  // ══════════════════════════════════════════════════════
  // SYNC COUNT
  // ══════════════════════════════════════════════════════

  function _syncCount() {
    const n   = _sliders.size;
    const el  = document.getElementById('slider-count');
    if (el) el.textContent = n + ' slider' + (n !== 1 ? 's' : '');
  }

  // ══════════════════════════════════════════════════════
  // CLEAR ALL
  // ══════════════════════════════════════════════════════

  function clearAll() {
    _stopGlobalAnim();
    _sliders.clear();
    _scenes.clear();
    const list = document.getElementById('slider-list');
    if (list) list.innerHTML = '';
    _renderScenes();
    _syncCount();
  }

  // ══════════════════════════════════════════════════════
  // SERIALIZATION
  // ══════════════════════════════════════════════════════

  function serialize() {
    const out = { __time: { value: _time.value, speed: _time.speed } };
    _sliders.forEach((sl, name) => {
      out[name] = {
        value:     sl.value,
        min:       sl.min,
        max:       sl.max,
        step:      sl.step,
        speed:     sl.speed,
        animMode:  sl.animMode,
        direction: sl.direction,
        easing:    sl.easing,
        locked:    sl.locked,
        expr:      sl.expr,
      };
    });
    if (_scenes.size) out.__scenes = Object.fromEntries(_scenes);
    return out;
  }

  function deserialize(data) {
    if (!data || typeof data !== 'object') return;
    clearAll();

    const deferredExprs = [];
    Object.entries(data).forEach(([name, opts]) => {
      if (name === '__time') {
        _time.value = opts.value ?? 0;
        _time.speed = opts.speed ?? 1;
        _updateTimeUI();
        const speedEl = document.getElementById('time-speed-input');
        if (speedEl) speedEl.value = _time.speed;
        return;
      }
      if (name === '__scenes') {
        _scenes = new Map(Object.entries(opts || {}));
        _renderScenes();
        return;
      }
      const { expr, ...rest } = opts || {};
      addSlider(name, rest.value ?? 1, rest);
      if (expr) deferredExprs.push([name, expr]);
    });

    // Apply formulas last (with cycle checking) so cross-references
    // resolve regardless of what order they appeared in the saved data.
    deferredExprs.forEach(([name, expr]) => setExpression(name, expr));
    _recomputeDerived();
    _rebuildAll();
  }

  // ══════════════════════════════════════════════════════
  // SHAREABLE STATE — the full animated configuration (values,
  // speeds, modes, easing, play state, scenes), packaged for a
  // URL. mod-share.js owns deciding where this string goes
  // (query param, path segment, QR code, etc.) — this module
  // just guarantees a lossless round trip so an animated view,
  // not just a frozen one, can be shared.
  // ══════════════════════════════════════════════════════

  function getShareableState() {
    return serialize();
  }

  function applyShareableState(state) {
    deserialize(state);
  }

  function encodeStateForURL(state) {
    const json = JSON.stringify(state || serialize());
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeStateFromURL(str) {
    if (!str) return null;
    try {
      let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) {
      return null; // malformed/tampered string — caller decides what to do
    }
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    init,
    addSlider,
    removeSlider,
    setValue,
    setRange,
    setStep,
    setDirection,
    reverseSlider,
    setEasing,
    lockSlider,
    setExpression,
    getValues,
    has,
    get,
    getAll,
    clearAll,
    toggleGlobalAnimation,
    serialize,
    deserialize,
    ANIM_MODES,
    EASING_NAMES,
    // Auto-detection
    autoDetect,
    autoCreateFromExpr,
    scanExpression,
    // Time variable
    playTime,
    pauseTime,
    resetTime,
    setTimeSpeed,
    getTime,
    // Scenes — named snapshots for demos/teaching
    saveScene,
    restoreScene,
    deleteScene,
    listScenes,
    // Shareable state — for mod-share.js to build on
    getShareableState,
    applyShareableState,
    encodeStateForURL,
    decodeStateFromURL,
    // Shared constants/reserved names, for other modules to reuse
    BUILTIN_CONSTANTS,
    RESERVED_NAMES,
  };

})();
