/**
 * Graph3D Pro — mod-audio-trace.js
 * Module — Audio Trace (sonification)
 * Owner: graph3dsphere.support@gmail.com
 * Purpose: let a user hear the currently selected equation as sound —
 *   pitch follows value, a short click marks every sign change — so the
 *   graph is explorable without seeing it. This is Desmos's single biggest
 *   accessibility feature that we didn't have; see the Desmos audit doc
 *   for the full comparison this was scoped against.
 * Public API: ModAudioTrace.init(), .toggle(), .traceEquation(id), .stop()
 * Depends on: ModEquations (getAll/getSelected), MathEngine (evalExpr),
 *   ModSliders (getValues), ModSettings (get, for x/y range), ModToast
 * Status: in-progress — explicit/curve/polar/parametric are supported;
 *   implicit and vector fields are not (see NOT_TRACEABLE below for why).
 *
 * Honest scope note: a full 2D sonification of a surface (the way Desmos
 * traces an entire 2D graph, not just a 1D slice) is a genuinely hard,
 * research-level problem. What's built here is a 1D slice through
 * whichever equation is selected — a real, working accessibility feature,
 * just not a complete solve of "hear the whole surface at once."
 *
 * ~/graph3d-pro/modules/mod-audio-trace.js
 */

const ModAudioTrace = (() => {

  const SAMPLE_COUNT   = 220;
  const TRACE_DURATION = 4.0;   // seconds — a full sweep takes this long
  const FREQ_MIN       = 220;   // Hz (A3)
  const FREQ_MAX       = 880;   // Hz (A5) — two octaves of range, a common sonification span
  const CLICK_FREQ     = 1400;  // Hz — the sign-change marker tone, deliberately far from the sweep range so it's unmistakable

  const NOT_TRACEABLE = {
    implicit: "Audio trace isn't available for implicit equations yet — there's no single obvious path to sweep through a level surface. Try an explicit, parametric, curve, or polar equation.",
    vector:   "Audio trace isn't available for vector fields yet — a field has a direction at every point, not one value to turn into pitch. Try an explicit, parametric, curve, or polar equation.",
  };

  let _audioCtx    = null;
  let _isPlaying   = false;
  let _stopHandle  = null;
  let _liveRegion  = null;

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _liveRegion = document.createElement('div');
    _liveRegion.setAttribute('aria-live', 'polite');
    _liveRegion.setAttribute('role', 'status');
    _liveRegion.style.cssText = `
      position:absolute;width:1px;height:1px;padding:0;margin:-1px;
      overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;
    `;
    document.body.appendChild(_liveRegion);
  }

  function _announce(text) {
    if (_liveRegion) _liveRegion.textContent = text;
  }

  // ══════════════════════════════════════════════════════
  // PICK WHAT TO TRACE
  // ══════════════════════════════════════════════════════

  function _pickEquation() {
    if (!window.ModEquations) return null;
    const selected = ModEquations.getSelected();
    if (selected.length === 1) return selected[0];

    const visible = ModEquations.getAll().filter(e => e.visible && e.expr && e.expr.trim());
    return visible.length ? visible[visible.length - 1] : null; // most recently added visible one
  }

  // ══════════════════════════════════════════════════════
  // SAMPLE AN EQUATION DOWN TO ONE VALUE PER STEP
  // Returns { values: number[], label: string } or null if not traceable.
  // ══════════════════════════════════════════════════════

  function _sampleEquation(eq) {
    if (!window.MathEngine) return null;
    const sliders = window.ModSliders ? ModSliders.getValues() : {};
    const settings = window.ModSettings ? ModSettings.get() : { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    const values = [];

    if (eq.type === 'explicit') {
      const { xMin, xMax } = settings;
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const x = xMin + (xMax - xMin) * i / (SAMPLE_COUNT - 1);
        let z = NaN;
        try { z = MathEngine.evalExpr(eq.expr, { x, y: 0, ...sliders }); } catch {}
        values.push(_toReal(z));
      }
      return { values, label: `explicit equation ${eq.expr}, sliced at y equals 0, x from ${xMin} to ${xMax}` };
    }

    if (eq.type === 'curve') {
      const parts = eq.expr.split(',');
      if (parts.length < 3) return null;
      const tMin = eq.tMin ?? -Math.PI * 3, tMax = eq.tMax ?? Math.PI * 3;
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const t = tMin + (tMax - tMin) * i / (SAMPLE_COUNT - 1);
        let z = NaN;
        try { z = MathEngine.evalExpr(parts[2].trim(), { t, ...sliders }); } catch {}
        values.push(_toReal(z));
      }
      return { values, label: `space curve ${eq.expr}, height component, t from ${tMin.toFixed(1)} to ${tMax.toFixed(1)}` };
    }

    if (eq.type === 'polar') {
      const { xMin, xMax, yMin, yMax } = settings;
      const rMax = Math.min(Math.abs(xMin), Math.abs(xMax), Math.abs(yMin), Math.abs(yMax));
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const r = rMax * i / (SAMPLE_COUNT - 1);
        let z = NaN;
        try { z = MathEngine.evalExpr(eq.expr, { r, theta: 0, t: sliders.t || 0, ...sliders }); } catch {}
        values.push(_toReal(z));
      }
      return { values, label: `polar equation ${eq.expr}, sliced at angle 0, radius 0 to ${rMax.toFixed(1)}` };
    }

    if (eq.type === 'parametric') {
      const parts = eq.expr.split(',');
      if (parts.length < 3) return null;
      const uMin = eq.uMin ?? 0, uMax = eq.uMax ?? Math.PI * 2;
      const vMid = ((eq.vMin ?? 0) + (eq.vMax ?? Math.PI)) / 2;
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const u = uMin + (uMax - uMin) * i / (SAMPLE_COUNT - 1);
        let z = NaN;
        try { z = MathEngine.evalExpr(parts[2].trim(), { u, v: vMid, t: sliders.t || 0, ...sliders }); } catch {}
        values.push(_toReal(z));
      }
      return { values, label: `parametric surface ${eq.expr}, height component, sliced at the midpoint of v, u from ${uMin.toFixed(1)} to ${uMax.toFixed(1)}` };
    }

    return null; // implicit / vector — see NOT_TRACEABLE
  }

  function _toReal(z) {
    if (z && typeof z === 'object' && 're' in z) return Math.hypot(z.re, z.im || 0); // complex result -> magnitude
    return typeof z === 'number' && isFinite(z) ? z : NaN;
  }

  // ══════════════════════════════════════════════════════
  // PLAY
  // ══════════════════════════════════════════════════════

  function _ensureAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  }

  function _playClick(ctx, when) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(CLICK_FREQ, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.25, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.05);
  }

  function traceEquation(eqOrId) {
    stop(); // only one trace at a time

    const eq = typeof eqOrId === 'string'
      ? (window.ModEquations && ModEquations.getById(eqOrId))
      : eqOrId;

    if (!eq) {
      if (window.ModToast) ModToast.show('No equation to trace', 'error');
      return;
    }
    if (NOT_TRACEABLE[eq.type]) {
      if (window.ModToast) ModToast.show(NOT_TRACEABLE[eq.type], 'info');
      _announce(NOT_TRACEABLE[eq.type]);
      return;
    }

    const sample = _sampleEquation(eq);
    if (!sample) {
      if (window.ModToast) ModToast.show("Couldn't sample this equation for tracing", 'error');
      return;
    }

    const finiteValues = sample.values.filter(isFinite);
    if (finiteValues.length < 2) {
      if (window.ModToast) ModToast.show('This equation is undefined across the whole traceable range', 'error');
      return;
    }
    const lo = Math.min(...finiteValues), hi = Math.max(...finiteValues);
    const range = (hi - lo) || 1;

    const ctx = _ensureAudioCtx();
    const now = ctx.currentTime;
    const step = TRACE_DURATION / (sample.values.length - 1);

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.22, now);
    osc.connect(gain).connect(ctx.destination);

    let prevSign = null;
    sample.values.forEach((v, i) => {
      const when = now + i * step;
      if (isFinite(v)) {
        const freq = FREQ_MIN + ((v - lo) / range) * (FREQ_MAX - FREQ_MIN);
        osc.frequency.linearRampToValueAtTime(freq, when);

        const sign = v >= 0 ? 1 : -1;
        if (prevSign !== null && sign !== prevSign) _playClick(ctx, when);
        prevSign = sign;
      } else {
        gain.gain.setValueAtTime(0.0001, when); // silence through undefined stretches
        gain.gain.setValueAtTime(0.22, when + step * 0.8);
      }
    });

    osc.start(now);
    osc.stop(now + TRACE_DURATION + 0.1);

    _isPlaying = true;
    if (window.ModToast) ModToast.show(`Tracing: ${eq.expr}`, 'info');
    _announce(`Tracing ${sample.label}. Range from ${lo.toFixed(2)} to ${hi.toFixed(2)}.`);

    _stopHandle = setTimeout(() => {
      _isPlaying = false;
      _announce('Trace complete.');
    }, TRACE_DURATION * 1000 + 150);
  }

  function stop() {
    if (_stopHandle) { clearTimeout(_stopHandle); _stopHandle = null; }
    if (_audioCtx && _isPlaying) {
      // Let any in-flight oscillator finish its natural stop() rather than
      // hard-killing the context — abrupt context closure can click/pop.
      _isPlaying = false;
    }
  }

  function toggle() {
    if (_isPlaying) { stop(); if (window.ModToast) ModToast.show('Trace stopped', 'info'); return; }
    const eq = _pickEquation();
    if (!eq) {
      if (window.ModToast) ModToast.show('Add an equation first', 'info');
      return;
    }
    traceEquation(eq);
  }

  return { init, toggle, traceEquation, stop };

})();
window.ModAudioTrace = ModAudioTrace;
