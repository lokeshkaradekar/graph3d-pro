/**
 * Graph3D Pro — math-engine.js
 * Module 02 — Math Parser, Cache, User Functions, Constants,
 *              Numerical Calculus (incl. vector calculus), Complex Numbers
 * ~/graph3d-pro/core/math-engine.js
 */

const MathEngine = (() => {

  // ── Compiled function cache ────────────────────────────
  const _cache = new Map();
  const _userFunctions = new Map();
  const _userConstants = new Map();

  // ── Built-in extra constants ───────────────────────────
  let _iCache = null; // cache for the lazy BUILTINS.i getter below
  const BUILTINS = {
    pi:  Math.PI,
    e:   Math.E,
    phi: (1 + Math.sqrt(5)) / 2,   // golden ratio
    tau: Math.PI * 2,
    inf: Infinity,
    get i() { return _iCache || (_iCache = math.complex(0, 1)); }, // imaginary unit, computed lazily so mathjs doesn't need to be loaded yet when this object is built

    // Color functions and list builder — implementations further down
    // this file, in the COLOR FUNCTIONS / LIST BUILDERS sections.
    // (function declarations are hoisted, so referencing them here
    // ahead of their definition is safe.)
    rgb:    fnRgb,
    hsv:    fnHsv,
    okhsv:  fnOkhsv,
    oklab:  fnOklab,
    oklch:  fnOklch,
    repeat: fnRepeat,

    // ── GLSL-style math utilities ────────────────────────────────
    smoothstep: fnSmoothstep, clamp: fnClamp, fract: fnFract,
    mix: fnMix, lerp: fnMix, step: fnStep,
    remap: fnRemap, ping: fnPing,
    noise2: fnNoise2, noise3: fnNoise3,

    // ── Trig aliases and reciprocals ─────────────────────────────
    ln:  Math.log,        // natural log alias
    log1p: Math.log1p,   // log(1+x), accurate near 0
    expm1: Math.expm1,   // exp(x)-1, accurate near 0
    trunc: Math.trunc,
    sec:  fnSec,          // 1/cos
    csc:  fnCsc,          // 1/sin
    cot:  fnCot,          // cos/sin
    asec: fnAsec,         // acos(1/x)
    acsc: fnAcsc,         // asin(1/x)
    acot: fnAcot,         // atan(1/x)

    // ── Signal / waveform functions ──────────────────────────────
    heaviside: fnHeaviside,  // 0 for x<0, 0.5 at x=0, 1 for x>0
    sawtooth:  fnSawtooth,   // fract(x) → periodic 0→1
    square:    fnSquare,     // sign(sin(pi*x))
    sinc:      fnSinc,       // sin(pi*x)/(pi*x)

    // ── Higher math ──────────────────────────────────────────────
    erf:       fnErf,        // error function (series approx)
    erfc:      fnErfc,       // complementary error function
    gamma:     fnGamma,      // gamma(x) via Lanczos approximation
    logGamma:  fnLogGamma,   // log|gamma(x)| (avoids overflow)
    beta:      fnBeta,       // beta(a,b) = gamma(a)*gamma(b)/gamma(a+b)
  };

  // ══════════════════════════════════════════════════════
  // CORE — compile + evaluate
  // ══════════════════════════════════════════════════════

  /**
   * Finds every "bare" "=" in `str` — a single equals sign that is NOT
   * part of ==, !=, <=, or >=. Used to detect a genuine equation
   * ("x^2+y^2=1") as opposed to a comparison inside a condition.
   */
  function findBareEquals(str) {
    const positions = [];
    const re = /(?<![!<>=])=(?!=)/g;
    let m;
    while ((m = re.exec(str)) !== null) {
      positions.push(m.index);
    }
    return positions;
  }

  /**
   * Rewrites an implicit equation "LHS=RHS" into "(LHS) - (RHS)" so
   * math.js's compiler — which otherwise reads a bare "=" as an
   * ASSIGNMENT operator — doesn't choke on it. math.js only accepts a
   * single bare symbol as an assignment target, so something like
   * "sin(x)+cos(y)+sin(z)=0" throws "Invalid left hand side of
   * assignment operator" the moment it's compiled; "x^2+y^2+z^2=1" and
   * "x^2+y^2=z" throw the same way.
   *
   * Explicit single-variable equations — "z=sin(x)+cos(y)", "y=x^2",
   * "x=t" — are left completely untouched: their LHS (x, y, or z) IS a
   * valid assignment target, math.js already compiles them correctly
   * today (evaluating the AssignmentNode returns the RHS's value), and
   * rewriting them would be unnecessary and could only introduce risk.
   *
   * Expressions with no bare "=" at all (plain expressions, or
   * anything already in "(...)-(...)" form) pass through unchanged.
   */
  function normalizeImplicitEquation(exprPart) {
    const positions = findBareEquals(exprPart);
    if (positions.length !== 1) {
      // No equation here, or an ambiguous/chained one (e.g. "x=y=5") —
      // leave it alone and let math.js report its own error if any.
      return exprPart;
    }
    const idx = positions[0];
    const lhs = exprPart.slice(0, idx).trim();
    const rhs = exprPart.slice(idx + 1).trim();
    if (!lhs || !rhs) {
      return exprPart; // malformed ("=x" or "x=") — let math.js's own error surface
    }
    if (lhs === 'x' || lhs === 'y' || lhs === 'z') {
      return exprPart; // explicit assignment-style equation — already works as-is
    }
    return `(${lhs}) - (${rhs})`;
  }

  /**
   * Counts genuine equation-separator "=" signs in `expr` — used to
   * detect a chained equation like "x=y=5" or
   * "z=sin(x)+cos(y)+sin(z)=0" (2 or more bare "="s).
   *
   * Deliberately NOT `(expr.match(/=/g)||[]).length`: that naive count
   * also counts every "==", "!=", "<=", ">=" — so a perfectly valid
   * equation with a compound domain-restriction condition, e.g.
   * "sin(x){x>=0 && y<=5}", would be miscounted as 2 and incorrectly
   * rejected as "chained" even though it has zero real ambiguity.
   * This counts only bare "="s (via findBareEquals), so it doesn't.
   */
  function countEquals(expr) {
    return findBareEquals(String(expr)).length;
  }

  /**
   * Strips a leading "varName=" prefix, e.g.
   * stripAssignmentPrefix("z=sin(x)+cos(y)", "z") -> "sin(x)+cos(y)".
   * Returns `expr` unchanged if it doesn't start with exactly that
   * prefix (so "z1=5" is untouched when varName is "z" — the match
   * requires "=" to immediately follow varName, not just any name
   * that happens to start with it).
   */
  function stripAssignmentPrefix(expr, varName) {
    const escaped = String(varName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^\\s*' + escaped + '\\s*=\\s*(.+)$', 's');
    const m = String(expr).match(re);
    return m ? m[1] : expr;
  }

  /**
   * Strips a trailing "=0" (or "=0.0", "=0.00", ...) for implicit-type
   * input, e.g. "sin(x)+cos(y)+sin(z)=0" -> "sin(x)+cos(y)+sin(z)".
   * Domain-restriction-aware: "sin(x)=0{x>0}" strips correctly even
   * though the "=0" isn't at the true end of the string once the
   * {condition} is attached.
   */
  function stripTrailingZero(expr) {
    const str = String(expr);
    const domain = parseDomainRestriction(str.trim());
    const core = domain ? domain.exprPart : str;
    const stripped = core.replace(/\s*=\s*0(\.0+)?\s*$/, '');
    return domain ? `${stripped}{${domain.condition}}` : stripped;
  }


  /**
   * Compile an expression string into a reusable function.
   * Results are cached — same expression string = same compiled fn.
   *
   * Also recognizes a trailing Desmos-style domain restriction, e.g.
   * "sin(x){x>0}" — see parseDomainRestriction() / compileDomainRestricted().
   * Any expression without a "{...}" suffix compiles exactly as before.
   *
   * Also recognizes an implicit equation whose left-hand side isn't a
   * bare x/y/z (e.g. "x^2+y^2+z^2=1") and rewrites it internally into
   * "(LHS) - (RHS)" before compiling — see normalizeImplicitEquation().
   * Explicit equations like "z=sin(x)+cos(y)" are untouched.
   */
  function compile(expr) {
    const key = expr.trim();
    if (_cache.has(key)) return _cache.get(key);

    const domain = parseDomainRestriction(key);
    const fn = domain
      ? compileDomainRestricted(domain.exprPart, domain.condition) // normalizes internally
      : math.compile(normalizeImplicitEquation(key));

    _cache.set(key, fn);
    return fn;
  }

  /**
   * Evaluate a pre-compiled function with a scope.
   * Merges builtins + user constants + user functions into scope.
   * Returns NaN on any error. Complex results are returned as-is
   * (a math.js Complex object with .re / .im) unless non-finite.
   */
  function evaluate(compiled, scope = {}) {
    try {
      const fullScope = buildScope(scope);
      const result = compiled.evaluate(fullScope);
      if (isComplexNum(result)) {
        if (!isFinite(result.re) || !isFinite(result.im)) return NaN;
        return result;
      }
      if (typeof result !== 'number' || !isFinite(result)) return NaN;
      return result;
    } catch {
      return NaN;
    }
  }

  /**
   * Compile and immediately evaluate — convenience wrapper.
   */
  function evalExpr(expr, scope = {}) {
    try {
      const fn = compile(expr);
      return evaluate(fn, scope);
    } catch {
      return NaN;
    }
  }

  /**
   * Validate an expression. Returns { ok, error }.
   *
   * Also accepts multi-part expressions like "cos(u), sin(u), v"
   * (parametric/space-curve/vector/plane style) — valid when every
   * top-level comma-separated part parses on its own, matching how
   * graph-builder.js's buildParametric/buildSpaceCurve/buildVector/
   * buildPlane/compileExprList already split-then-compile them. A
   * comma inside a function call, e.g. "max(x,y)", is NOT top-level
   * and does not trigger this — only one part is found and it's
   * validated as a normal single expression.
   *
   * Domain-restricted expressions (e.g. "sin(x){x>0}") are validated
   * as a whole, same as any other expression. Implicit equations
   * (e.g. "x^2+y^2+z^2=1") are normalized the same way compile() does
   * — see normalizeImplicitEquation() — so a valid implicit equation
   * doesn't get flagged as invalid here just because math.js reads a
   * bare "=" as an assignment operator.
   *
   * A chained equation (2+ bare "="s, e.g. "x=y=5") is rejected up
   * front with a specific message, before even attempting to compile.
   */
  function validate(expr) {
    if (!expr || !expr.trim()) {
      return { ok: false, error: 'Empty expression' };
    }
    const trimmed = expr.trim();
    if (countEquals(trimmed) >= 2) {
      return {
        ok: false,
        error: 'This has more than one equals sign — only one equation at a time is supported. Did you mean to pick Implicit type instead?',
      };
    }
    try {
      const domain = parseDomainRestriction(trimmed);
      const core = domain ? domain.exprPart : trimmed;
      const parts = splitTopLevel(core, [',']);

      if (parts.length > 1) {
        parts.forEach(p => math.compile(normalizeImplicitEquation(p)));
      } else if (domain) {
        compileDomainRestricted(domain.exprPart, domain.condition); // normalizes internally
      } else {
        math.compile(normalizeImplicitEquation(core));
      }

      return { ok: true, error: null };
    } catch (e) {
      return { ok: false, error: friendlyError(e.message) };
    }
  }

  // ══════════════════════════════════════════════════════
  // SCOPE BUILDER
  // ══════════════════════════════════════════════════════

  function buildScope(userScope = {}) {
    const scope = { ...BUILTINS };

    // Inject user-defined constants
    _userConstants.forEach((val, name) => { scope[name] = val; });

    // Inject user-defined functions
    _userFunctions.forEach((fn, name) => { scope[name] = fn; });

    // Inject call-time scope (x, y, t, u, v, sliders, etc.)
    Object.assign(scope, userScope);

    return scope;
  }

  // ══════════════════════════════════════════════════════
  // USER FUNCTIONS  e.g. f(x) = sin(x)*x
  // ══════════════════════════════════════════════════════

  /**
   * Register a named user function.
   * Example: defineFunction('f', 'x', 'sin(x)*x')
   */
  function defineFunction(name, params, bodyExpr) {
    if (!name || !bodyExpr) return { ok: false, error: 'Missing name or body' };
    try {
      const paramList = typeof params === 'string'
        ? params.split(',').map(p => p.trim()).filter(Boolean)
        : params;

      const compiled = math.compile(bodyExpr.trim());

      const fn = (...args) => {
        const scope = buildScope({});
        paramList.forEach((p, i) => { scope[p] = args[i] ?? 0; });
        try {
          const result = compiled.evaluate(scope);
          return typeof result === 'number' ? result : NaN;
        } catch {
          return NaN;
        }
      };

      // Make it a math.js compatible function
      fn.toTex = () => `\\text{${name}}`;

      _userFunctions.set(name, fn);

      // Bust cache so existing expressions re-evaluate with new function
      clearCache();

      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyError(e.message) };
    }
  }

  function removeFunction(name) {
    _userFunctions.delete(name);
    clearCache();
  }

  function listFunctions() {
    const result = [];
    _userFunctions.forEach((fn, name) => result.push(name));
    return result;
  }

  // ══════════════════════════════════════════════════════
  // USER CONSTANTS  e.g. k = 3.14
  // ══════════════════════════════════════════════════════

  function defineConstant(name, value) {
    if (!name) return { ok: false, error: 'Missing name' };
    const num = parseFloat(value);
    if (isNaN(num)) return { ok: false, error: 'Value must be a number' };
    _userConstants.set(name, num);
    clearCache();
    return { ok: true };
  }

  function removeConstant(name) {
    _userConstants.delete(name);
    clearCache();
  }

  function listConstants() {
    const result = {};
    _userConstants.forEach((val, name) => { result[name] = val; });
    return result;
  }

  // ══════════════════════════════════════════════════════
  // CACHE MANAGEMENT
  // ══════════════════════════════════════════════════════

  function clearCache() {
    _cache.clear();
  }

  function getCacheSize() {
    return _cache.size;
  }

  // ══════════════════════════════════════════════════════
  // COLOR FUNCTIONS — rgb / hsv / okhsv / oklab / oklch
  // ══════════════════════════════════════════════════════
  //
  // Each returns a single packed 24-bit integer 0xRRGGBB (a plain JS
  // number) — that's a normal math.js expression result, and it's
  // directly usable on the render side as `new THREE.Color(packed)`.
  // They're registered in BUILTINS above, so they work inside any
  // compiled expression (e.g. a per-vertex color expression like
  // "hsv(x*360, 1, 1)"), and are also exported directly below for
  // callers that just want to convert a static color in plain JS.
  //
  // Out-of-range NUMERIC input is clamped/wrapped, matching standard
  // color-library behavior (hue wraps mod 360; saturation/value/
  // channels clamp to their valid range) — that's not an error
  // condition. A genuinely wrong ARGUMENT TYPE (e.g. a list where a
  // number is expected) throws a clear, typed error that
  // friendlyError() turns into a plain-language message. Any NaN
  // input propagates as NaN (consistent with how domain violations
  // are handled everywhere else in this file), rather than throwing.
  //
  // oklab()/oklch() use the exact, published Oklab <-> linear-sRGB
  // matrices (Björn Ottosson's reference constants — the same ones
  // CSS's native oklab()/oklch() are built on). They're verified in
  // this file's test suite via round-trip checks (gray colors map to
  // a=b=0; rgb -> oklab -> rgb recovers the original channel values).
  //
  // okhsv() is explicitly a SIMPLIFIED APPROXIMATION, not a bit-exact
  // reproduction of Ottosson's full Okhsv algorithm. The real Okhsv
  // finds the exact sRGB-gamut boundary ("cusp") for each hue via a
  // set of additional per-channel fitting constants; reproducing that
  // precisely from memory without a reference to verify against risks
  // a subtly wrong result that would be very hard to catch. Instead,
  // okhsv() here maps (h,s,v) through the same verified Oklab math
  // with a simple, monotonic, gamut-safe chroma envelope — it gives a
  // usable, correctly-ordered HSV-like cylinder in Oklab space, just
  // not Ottosson's exact one. If bit-exact Okhsv matters later, this
  // is the function to revisit with the reference algorithm in hand.

  function requireNumber(val, fnName, argIndex) {
    if (typeof val !== 'number') {
      const gotType = Array.isArray(val) ? 'a list' : (val === null ? 'null' : typeof val);
      throw new TypeError(`${fnName}() expected a number for argument ${argIndex}, got ${gotType}`);
    }
    return val;
  }

  /**
   * coerceReal — like requireNumber but accepts mathjs complex numbers.
   * If the complex number has a negligible imaginary part (|im| < 1e-9)
   * the real part is returned; otherwise NaN is returned (domain error,
   * same as how sqrt(-1) propagates NaN in pure-real contexts).
   * This prevents TypeError crashes when mathjs auto-promotes real
   * arithmetic to complex (e.g. (-1)^0.5, sqrt(-x) at negative x).
   */
  function coerceReal(val, fnName, argIndex) {
    if (typeof val === 'number') return val;
    if (val !== null && typeof val === 'object' && typeof val.re === 'number') {
      // mathjs Complex — return real part if imaginary part is negligible
      return Math.abs(val.im) < 1e-9 ? val.re : NaN;
    }
    const gotType = Array.isArray(val) ? 'a list' : (val === null ? 'null' : typeof val);
    throw new TypeError(`${fnName}() expected a number for argument ${argIndex}, got ${gotType}`);
  }

  function clampRange(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function wrapDegrees(deg) { return ((deg % 360) + 360) % 360; }

  function packRgb(r, g, b) {
    const R = Math.round(clampRange(r, 0, 255));
    const G = Math.round(clampRange(g, 0, 255));
    const B = Math.round(clampRange(b, 0, 255));
    return (R << 16) | (G << 8) | B;
  }

  function fnRgb(r, g, b) {
    requireNumber(r, 'rgb', 1); requireNumber(g, 'rgb', 2); requireNumber(b, 'rgb', 3);
    if ([r, g, b].some(Number.isNaN)) return NaN;
    return packRgb(r, g, b);
  }

  function hsvToRgbChannels(h, s, v) {
    h = wrapDegrees(h);
    s = clampRange(s, 0, 1);
    v = clampRange(v, 0, 1);
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r1, g1, b1;
    if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else              { r1 = c; g1 = 0; b1 = x; }
    return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
  }

  function fnHsv(h, s, v) {
    requireNumber(h, 'hsv', 1); requireNumber(s, 'hsv', 2); requireNumber(v, 'hsv', 3);
    if ([h, s, v].some(Number.isNaN)) return NaN;
    const [r, g, b] = hsvToRgbChannels(h, s, v);
    return packRgb(r, g, b);
  }

  function linearToSrgbChannel(c) {
    c = clampRange(c, 0, 1);
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return s * 255;
  }
  function srgbChannelToLinear(c255) {
    const c = clampRange(c255, 0, 255) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /** linear sRGB -> Oklab (used internally for round-trip verification) */
  function linearSrgbToOklab(r, g, b) {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
  }

  /** Oklab -> linear sRGB */
  function oklabToLinearSrgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    return [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  function oklabToPackedRgb(L, a, b) {
    const [rl, gl, bl] = oklabToLinearSrgb(L, a, b);
    return packRgb(linearToSrgbChannel(rl), linearToSrgbChannel(gl), linearToSrgbChannel(bl));
  }

  /** rgb (0-255 each) -> [L,a,b] Oklab — exposed for round-trip testing. */
  function rgbToOklab(r, g, b) {
    return linearSrgbToOklab(srgbChannelToLinear(r), srgbChannelToLinear(g), srgbChannelToLinear(b));
  }

  function fnOklab(L, a, b) {
    requireNumber(L, 'oklab', 1); requireNumber(a, 'oklab', 2); requireNumber(b, 'oklab', 3);
    if ([L, a, b].some(Number.isNaN)) return NaN;
    return oklabToPackedRgb(L, a, b);
  }

  function fnOklch(L, C, H) {
    requireNumber(L, 'oklch', 1); requireNumber(C, 'oklch', 2); requireNumber(H, 'oklch', 3);
    if ([L, C, H].some(Number.isNaN)) return NaN;
    const hRad = wrapDegrees(H) * Math.PI / 180;
    return oklabToPackedRgb(L, C * Math.cos(hRad), C * Math.sin(hRad));
  }

  /** Ottosson's "toe" lightness remap, used by the okhsv approximation. */
  function toeOk(x) {
    const k1 = 0.206, k2 = 0.03, k3 = (1 + k1) / (1 + k2);
    return 0.5 * (k3 * x - k1 + Math.sqrt((k3 * x - k1) ** 2 + 4 * k2 * k3 * x));
  }

  function fnOkhsv(h, s, v) {
    requireNumber(h, 'okhsv', 1); requireNumber(s, 'okhsv', 2); requireNumber(v, 'okhsv', 3);
    if ([h, s, v].some(Number.isNaN)) return NaN;
    const hh = wrapDegrees(h), ss = clampRange(s, 0, 1), vv = clampRange(v, 0, 1);
    const L = toeOk(vv);
    // Simplified gamut-safe chroma envelope — see the section note above.
    const maxC = 0.32 * (1 - Math.abs(2 * L - 1));
    const C = ss * maxC;
    const hRad = hh * Math.PI / 180;
    return oklabToPackedRgb(L, C * Math.cos(hRad), C * Math.sin(hRad));
  }

  // ══════════════════════════════════════════════════════
  // LIST BUILDERS
  // ══════════════════════════════════════════════════════

  /**
   * repeat(value, n) -> a list of `value` repeated n times, matching
   * Desmos's repeat() list builder. `value` can be any type (numbers,
   * colors, other lists); only the count is validated.
   */
  function fnRepeat(value, n) {
    requireNumber(n, 'repeat', 2);
    if (!Number.isFinite(n) || n < 0) {
      throw new RangeError(`repeat() expected a non-negative count for argument 2, got ${n}`);
    }
    const count = Math.floor(n);
    const arr = new Array(count).fill(value);
    return typeof math.matrix === 'function' ? math.matrix(arr) : arr;
  }

  // ══════════════════════════════════════════════════════
  // GLSL-STYLE MATH UTILITIES
  // ══════════════════════════════════════════════════════

  function fnSmoothstep(a, b, x) {
    a=coerceReal(a,'smoothstep',1); b=coerceReal(b,'smoothstep',2); x=coerceReal(x,'smoothstep',3);
    if (isNaN(a)||isNaN(b)||isNaN(x)) return NaN;
    const t = Math.min(1, Math.max(0, (x-a)/(b-a)));
    return t*t*(3-2*t);
  }
  function fnClamp(x, lo, hi) {
    x=coerceReal(x,'clamp',1); lo=coerceReal(lo,'clamp',2); hi=coerceReal(hi,'clamp',3);
    if (isNaN(x)||isNaN(lo)||isNaN(hi)) return NaN;
    return Math.min(hi, Math.max(lo, x));
  }
  function fnFract(x) {
    x=coerceReal(x,'fract',1); if (isNaN(x)) return NaN;
    return x - Math.floor(x);
  }
  function fnMix(a, b, t) {
    a=coerceReal(a,'mix',1); b=coerceReal(b,'mix',2); t=coerceReal(t,'mix',3);
    if (isNaN(a)||isNaN(b)||isNaN(t)) return NaN;
    return a*(1-t) + b*t;
  }
  function fnStep(edge, x) {
    edge=coerceReal(edge,'step',1); x=coerceReal(x,'step',2);
    if (isNaN(edge)||isNaN(x)) return NaN;
    return x < edge ? 0 : 1;
  }
  function fnRemap(x, a, b, c, d) {
    x=coerceReal(x,'remap',1); a=coerceReal(a,'remap',2); b=coerceReal(b,'remap',3);
    c=coerceReal(c,'remap',4); d=coerceReal(d,'remap',5);
    if (isNaN(x)||isNaN(a)||isNaN(b)||isNaN(c)||isNaN(d)) return NaN;
    if (Math.abs(b-a) < 1e-15) return NaN;
    return c + (d-c)*(x-a)/(b-a);
  }
  function fnPing(x) {
    x=coerceReal(x,'ping',1); if (isNaN(x)) return NaN;
    const f = ((x%2)+2)%2;
    return f < 1 ? f : 2-f;
  }

  function _hashInt(n) {
    let h = n|0;
    h = Math.imul(h^(h>>>16), 0x85ebca6b);
    h = Math.imul(h^(h>>>13), 0xc2b2ae35);
    return (h^(h>>>16))>>>0;
  }
  function _hashN2(ix,iy) { return _hashInt(ix ^ Math.imul(iy,2654435761)) / 4294967296; }
  function _hashN3(ix,iy,iz) { return _hashInt(ix ^ Math.imul(iy,2654435761) ^ Math.imul(iz,805459861)) / 4294967296; }

  function fnNoise2(x, y) {
    x=coerceReal(x,'noise2',1); y=coerceReal(y,'noise2',2);
    if (isNaN(x)||isNaN(y)) return NaN;
    const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
    const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
    const a=_hashN2(ix,iy), b=_hashN2(ix+1,iy), c=_hashN2(ix,iy+1), d=_hashN2(ix+1,iy+1);
    return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;
  }
  function fnNoise3(x, y, z) {
    x=coerceReal(x,'noise3',1); y=coerceReal(y,'noise3',2); z=coerceReal(z,'noise3',3);
    if (isNaN(x)||isNaN(y)||isNaN(z)) return NaN;
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const fx=x-ix,fy=y-iy,fz=z-iz;
    const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),uz=fz*fz*(3-2*fz);
    const a000=_hashN3(ix,iy,iz),a100=_hashN3(ix+1,iy,iz),a010=_hashN3(ix,iy+1,iz),a110=_hashN3(ix+1,iy+1,iz);
    const a001=_hashN3(ix,iy,iz+1),a101=_hashN3(ix+1,iy,iz+1),a011=_hashN3(ix,iy+1,iz+1),a111=_hashN3(ix+1,iy+1,iz+1);
    const v0=a000+(a100-a000)*ux, v1=a010+(a110-a010)*ux;
    const v2=a001+(a101-a001)*ux, v3=a011+(a111-a011)*ux;
    const v01=v0+(v1-v0)*uy, v23=v2+(v3-v2)*uy;
    return v01+(v23-v01)*uz;
  }

  // ══════════════════════════════════════════════════════
  // TRIG RECIPROCALS & INVERSES
  // ══════════════════════════════════════════════════════

  function fnSec(x)  { x=coerceReal(x,'sec',1);   if(isNaN(x))return NaN; const c=Math.cos(x); return c===0?NaN:1/c; }
  function fnCsc(x)  { x=coerceReal(x,'csc',1);   if(isNaN(x))return NaN; const s=Math.sin(x); return s===0?NaN:1/s; }
  function fnCot(x)  { x=coerceReal(x,'cot',1);   if(isNaN(x))return NaN; const s=Math.sin(x); return s===0?NaN:Math.cos(x)/s; }
  function fnAsec(x) { x=coerceReal(x,'asec',1);  if(isNaN(x))return NaN; if(Math.abs(x)<1)return NaN; return Math.acos(1/x); }
  function fnAcsc(x) { x=coerceReal(x,'acsc',1);  if(isNaN(x))return NaN; if(Math.abs(x)<1)return NaN; return Math.asin(1/x); }
  function fnAcot(x) { x=coerceReal(x,'acot',1);  if(isNaN(x))return NaN; return x===0 ? Math.PI/2 : Math.atan(1/x); }

  // ══════════════════════════════════════════════════════
  // SIGNAL / WAVEFORM FUNCTIONS
  // ══════════════════════════════════════════════════════

  function fnHeaviside(x) {
    x=coerceReal(x,'heaviside',1); if(isNaN(x))return NaN;
    return x < 0 ? 0 : (x === 0 ? 0.5 : 1);
  }
  function fnSawtooth(x) {
    x=coerceReal(x,'sawtooth',1); if(isNaN(x))return NaN;
    return x - Math.floor(x); // same as fract
  }
  function fnSquare(x) {
    x=coerceReal(x,'square',1); if(isNaN(x))return NaN;
    // sign(sin(pi*x)) — square wave period 2
    const s = Math.sin(Math.PI * x);
    return s > 0 ? 1 : (s < 0 ? -1 : 0);
  }
  function fnSinc(x) {
    x=coerceReal(x,'sinc',1); if(isNaN(x))return NaN;
    if (Math.abs(x) < 1e-12) return 1;
    return Math.sin(Math.PI * x) / (Math.PI * x);
  }

  // ══════════════════════════════════════════════════════
  // HIGHER MATH — erf, gamma, beta
  // ══════════════════════════════════════════════════════

  // Abramowitz & Stegun 7.1.26 — max error ~1.5e-7
  function fnErf(x) {
    x=coerceReal(x,'erf',1); if(isNaN(x)||!isFinite(x))return x<0?-1:1;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t * Math.exp(-x*x);
    return sign * y;
  }
  function fnErfc(x) { x=coerceReal(x,'erfc',1); return 1 - fnErf(x); }

  // Lanczos approximation (g=7, n=9) — accurate to ~1e-12 for Re(x) > 0
  const _LANCZOS_G = 7;
  const _LANCZOS_C = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  function fnLogGamma(x) {
    x=coerceReal(x,'logGamma',1); if(isNaN(x))return NaN;
    if (x <= 0) return Infinity;
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI*x)) - fnLogGamma(1-x);
    x -= 1;
    let a = _LANCZOS_C[0];
    for (let i = 1; i < _LANCZOS_G+2; i++) a += _LANCZOS_C[i] / (x+i);
    const t = x + _LANCZOS_G + 0.5;
    return 0.5*Math.log(2*Math.PI) + (x+0.5)*Math.log(t) - t + Math.log(a);
  }
  function fnGamma(x) {
    x=coerceReal(x,'gamma',1); if(isNaN(x))return NaN;
    if (x <= 0 && Number.isInteger(x)) return NaN; // poles at non-positive integers
    return Math.sign(x > 0 ? 1 : (Math.floor(x)%2 === 0 ? -1 : 1)) * Math.exp(fnLogGamma(x));
  }
  function fnBeta(a, b) {
    a=coerceReal(a,'beta',1); b=coerceReal(b,'beta',2);
    if (isNaN(a)||isNaN(b)) return NaN;
    return Math.exp(fnLogGamma(a) + fnLogGamma(b) - fnLogGamma(a+b));
  }

  // ══════════════════════════════════════════════════════
  // REGRESSION — linear & polynomial least-squares fit — linear & polynomial least-squares fit
  // ══════════════════════════════════════════════════════
  //
  // Exposed as plain JS utility functions rather than Desmos's special
  // "~" fit-operator equation syntax. Reproducing that syntax exactly
  // would mean adding a new parser-level operator AND hooking into
  // however this app represents user-entered data tables — both are
  // outside math-engine.js. These functions take the same data
  // (arrays of x/y values) and return a fitted model any caller
  // (graph-builder.js, mod-equations.js) can plot or display, which
  // covers the "basic linear/polynomial best-fit" ask directly.

  /**
   * Solves the linear system Ax=b via Gaussian elimination with
   * partial pivoting. Returns null if the system is singular.
   */
  function solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
      }
      if (Math.abs(M[pivotRow][col]) < 1e-12) return null;
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) {
          M[r][c] -= factor * M[col][c];
        }
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  /**
   * Least-squares linear regression: y = slope*x + intercept.
   * @returns {{ok:boolean, slope?:number, intercept?:number, r2?:number, expr?:string, predict?:function, error?:string}}
   */
  function linearRegression(xs, ys) {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) {
      return { ok: false, error: 'linearRegression needs two equal-length arrays with at least 2 points' };
    }
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - meanX) * (ys[i] - meanY);
      sxx += (xs[i] - meanX) ** 2;
    }
    if (sxx === 0) {
      return { ok: false, error: 'All x values are identical — cannot fit a line' };
    }
    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;
    const predict = (x) => slope * x + intercept;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssRes += (ys[i] - predict(xs[i])) ** 2;
      ssTot += (ys[i] - meanY) ** 2;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
    return { ok: true, slope, intercept, r2, expr: `${slope}*x + ${intercept}`, predict };
  }

  /**
   * Least-squares polynomial regression of the given degree, via the
   * normal equations over a Vandermonde design matrix.
   * @returns {{ok:boolean, coefficients?:number[], r2?:number, expr?:string, predict?:function, error?:string}}
   */
  function polynomialRegression(xs, ys, degree) {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length) {
      return { ok: false, error: 'polynomialRegression needs two equal-length arrays' };
    }
    const n = xs.length;
    const deg = Math.floor(degree);
    if (deg < 0 || n < deg + 1) {
      return { ok: false, error: `polynomialRegression needs at least ${deg + 1} points for degree ${deg}` };
    }

    const size = deg + 1;
    const XtX = Array.from({ length: size }, () => new Array(size).fill(0));
    const Xty = new Array(size).fill(0);
    for (let i = 0; i < n; i++) {
      const powers = new Array(size);
      powers[0] = 1;
      for (let p = 1; p < size; p++) powers[p] = powers[p - 1] * xs[i];
      for (let a = 0; a < size; a++) {
        Xty[a] += powers[a] * ys[i];
        for (let b = 0; b < size; b++) {
          XtX[a][b] += powers[a] * powers[b];
        }
      }
    }

    const coefficients = solveLinearSystem(XtX, Xty);
    if (!coefficients) {
      return { ok: false, error: 'Regression system is singular (points may be too collinear/degenerate for this degree)' };
    }

    const predict = (x) => coefficients.reduce((sum, c, p) => sum + c * Math.pow(x, p), 0);
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssRes += (ys[i] - predict(xs[i])) ** 2;
      ssTot += (ys[i] - meanY) ** 2;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
    const expr = coefficients.map((c, p) => (p === 0 ? `${c}` : `${c}*x^${p}`)).join(' + ');
    return { ok: true, coefficients, r2, expr, predict };
  }



  const H = 1e-5;   // base step for first-order finite differences
  const H2 = 1e-4;  // base step for second-order finite differences (Hessian)

  /**
   * Scales a finite-difference step relative to the magnitude of the
   * point being evaluated, which keeps derivatives accurate for both
   * tiny values (near zero) and very large ones. Complex-aware.
   */
  function adaptiveStep(value, base = H) {
    const mag = isComplexNum(value)
      ? Math.hypot(value.re, value.im)
      : Math.abs(typeof value === 'number' ? value : 0);
    return base * Math.max(1, mag);
  }

  /**
   * Generic numerical partial derivative of `fnOrExpr` with respect to
   * `varName`, evaluated at `point` (an object of variable → value,
   * e.g. { x: 1, y: 2, z: 0 }). Central difference, complex-safe.
   *
   * Accepts either a compiled function or a raw expression string.
   */
  function partialDerivative(fnOrExpr, varName, point = {}, scope = {}) {
    const fn = typeof fnOrExpr === 'string' ? compile(fnOrExpr) : fnOrExpr;
    const val = point[varName];
    const h = adaptiveStep(val, H);
    const base = buildScope({ ...scope, ...point });
    try {
      base[varName] = math.add(val, h);
      const f1 = fn.evaluate({ ...base });
      base[varName] = math.subtract(val, h);
      const f2 = fn.evaluate({ ...base });
      return math.divide(math.subtract(f1, f2), 2 * h);
    } catch {
      return NaN;
    }
  }

  /**
   * Numerical partial derivative df/dx at (x, y) — kept for backward
   * compatibility. Prefer partialDerivative() for new code.
   */
  function partialX(compiled, x, y, scope = {}) {
    return partialDerivative(compiled, 'x', { x, y }, scope);
  }

  /**
   * Numerical partial derivative df/dy at (x, y) — kept for backward
   * compatibility. Prefer partialDerivative() for new code.
   */
  function partialY(compiled, x, y, scope = {}) {
    return partialDerivative(compiled, 'y', { x, y }, scope);
  }

  /**
   * Gradient of a scalar field with respect to an arbitrary list of
   * variables, e.g. gradient('x^2 + y*z', ['x','y','z'], {x:1,y:2,z:3})
   */
  function gradient(fnOrExpr, varNames, point = {}, scope = {}) {
    const fn = typeof fnOrExpr === 'string' ? compile(fnOrExpr) : fnOrExpr;
    return varNames.map(v => partialDerivative(fn, v, point, scope));
  }

  /**
   * Gradient vector [df/dx, df/dy] at a point — kept for backward
   * compatibility. Prefer gradient() for new code.
   */
  function gradient2D(compiled, x, y, scope = {}) {
    return gradient(compiled, ['x', 'y'], { x, y }, scope);
  }

  /**
   * Numerical derivative d/dt of a 1D expression
   */
  function derivative1D(compiled, t, scope = {}) {
    return partialDerivative(compiled, 't', { t }, scope);
  }

  /**
   * Jacobian matrix of a vector-valued function F = [f1, f2, ..., fm]
   * with respect to variables [x1, ..., xn], evaluated at `point`.
   * Returns an m×n matrix: J[i][j] = ∂f_i/∂x_j
   *
   * exprs: array of expression strings or compiled functions
   * varNames: array of variable names, e.g. ['x', 'y', 'z']
   */
  function jacobian(exprs, varNames, point = {}, scope = {}) {
    const fns = exprs.map(e => typeof e === 'string' ? compile(e) : e);
    return fns.map(fn => varNames.map(v => partialDerivative(fn, v, point, scope)));
  }

  /**
   * Hessian matrix of a scalar field f, evaluated at `point`.
   * Returns an n×n symmetric matrix: H[i][j] = ∂²f/∂x_i∂x_j
   *
   * Uses central differences: diagonal entries via the standard
   * 3-point second-derivative stencil, off-diagonal entries via the
   * mixed-partial 4-point stencil.
   */
  function hessian(fnOrExpr, varNames, point = {}, scope = {}) {
    const fn = typeof fnOrExpr === 'string' ? compile(fnOrExpr) : fnOrExpr;
    const n = varNames.length;
    const H_out = Array.from({ length: n }, () => new Array(n).fill(0));

    const evalAt = (pt) => {
      const s = buildScope({ ...scope, ...pt });
      try {
        return fn.evaluate(s);
      } catch {
        return NaN;
      }
    };

    const f0 = evalAt(point);

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const vi = varNames[i], vj = varNames[j];
        const hi = adaptiveStep(point[vi], H2);
        let val;

        if (i === j) {
          const fPlus  = evalAt({ ...point, [vi]: math.add(point[vi], hi) });
          const fMinus = evalAt({ ...point, [vi]: math.subtract(point[vi], hi) });
          val = math.divide(
            math.add(math.subtract(fPlus, math.multiply(2, f0)), fMinus),
            hi * hi
          );
        } else {
          const hj = adaptiveStep(point[vj], H2);
          const fPP = evalAt({ ...point, [vi]: math.add(point[vi], hi), [vj]: math.add(point[vj], hj) });
          const fPM = evalAt({ ...point, [vi]: math.add(point[vi], hi), [vj]: math.subtract(point[vj], hj) });
          const fMP = evalAt({ ...point, [vi]: math.subtract(point[vi], hi), [vj]: math.add(point[vj], hj) });
          const fMM = evalAt({ ...point, [vi]: math.subtract(point[vi], hi), [vj]: math.subtract(point[vj], hj) });
          val = math.divide(
            math.subtract(math.add(fPP, fMM), math.add(fPM, fMP)),
            4 * hi * hj
          );
        }

        H_out[i][j] = val;
        H_out[j][i] = val;
      }
    }

    return H_out;
  }

  /**
   * Divergence of a vector field F = [F1, ..., Fn] with respect to
   * variables [x1, ..., xn]: div F = Σ ∂F_i/∂x_i
   *
   * exprs.length must equal varNames.length (one component per axis).
   */
  function divergence(exprs, varNames, point = {}, scope = {}) {
    if (!Array.isArray(exprs) || exprs.length !== varNames.length) {
      throw new Error('divergence(): needs exactly one vector-field component per variable');
    }
    let sum = 0;
    for (let i = 0; i < exprs.length; i++) {
      const fn = typeof exprs[i] === 'string' ? compile(exprs[i]) : exprs[i];
      sum = math.add(sum, partialDerivative(fn, varNames[i], point, scope));
    }
    return sum;
  }

  /**
   * Scalar curl of a 2D vector field F = (Fx, Fy):
   * curl F = ∂Fy/∂x − ∂Fx/∂y
   */
  function curl2D(exprs, point = {}, scope = {}, varNames = ['x', 'y']) {
    if (!Array.isArray(exprs) || exprs.length !== 2) {
      throw new Error('curl2D(): needs exactly 2 components [Fx, Fy]');
    }
    const [Fx, Fy] = exprs.map(e => typeof e === 'string' ? compile(e) : e);
    const [vx, vy] = varNames;
    const dFy_dx = partialDerivative(Fy, vx, point, scope);
    const dFx_dy = partialDerivative(Fx, vy, point, scope);
    return math.subtract(dFy_dx, dFx_dy);
  }

  /**
   * Curl of a 3D vector field F = (Fx, Fy, Fz):
   * curl F = (∂Fz/∂y − ∂Fy/∂z, ∂Fx/∂z − ∂Fz/∂x, ∂Fy/∂x − ∂Fx/∂y)
   * Returns [curl_x, curl_y, curl_z]
   */
  function curl3D(exprs, point = {}, scope = {}, varNames = ['x', 'y', 'z']) {
    if (!Array.isArray(exprs) || exprs.length !== 3) {
      throw new Error('curl3D(): needs exactly 3 components [Fx, Fy, Fz]');
    }
    const [Fx, Fy, Fz] = exprs.map(e => typeof e === 'string' ? compile(e) : e);
    const [vx, vy, vz] = varNames;

    const dFz_dy = partialDerivative(Fz, vy, point, scope);
    const dFy_dz = partialDerivative(Fy, vz, point, scope);
    const dFx_dz = partialDerivative(Fx, vz, point, scope);
    const dFz_dx = partialDerivative(Fz, vx, point, scope);
    const dFy_dx = partialDerivative(Fy, vx, point, scope);
    const dFx_dy = partialDerivative(Fx, vy, point, scope);

    return [
      math.subtract(dFz_dy, dFy_dz),
      math.subtract(dFx_dz, dFz_dx),
      math.subtract(dFy_dx, dFx_dy),
    ];
  }

  /**
   * Convenience dispatcher — picks curl2D or curl3D based on how many
   * vector-field components are passed in.
   */
  function curl(exprs, point = {}, scope = {}, varNames) {
    if (exprs.length === 2) return curl2D(exprs, point, scope, varNames || ['x', 'y']);
    if (exprs.length === 3) return curl3D(exprs, point, scope, varNames || ['x', 'y', 'z']);
    throw new Error('curl(): only defined for 2D or 3D vector fields');
  }

  /**
   * Simple numerical integration using Simpson's rule
   * Integrates expr(x) from a to b with n steps. Complex-safe.
   */
  function integrate(expr, varName, a, b, n = 100, scope = {}) {
    try {
      // Composite Simpson's rule's 1-4-2-4-...-4-1 weight pattern below is
      // only a valid quadrature formula for an EVEN number of
      // subintervals — an odd n silently produces a materially wrong
      // result (verified: n=101 over a known integral was off by ~1.6e-4
      // instead of the ~1e-8 a correct even-n Simpson's rule gives),
      // with no error raised. Round up to the nearest even n rather than
      // let that happen silently.
      if (n % 2 !== 0) n += 1;
      const fn = compile(expr);
      const h = (b - a) / n;
      let sum = 0;
      const s = buildScope(scope);

      for (let i = 0; i <= n; i++) {
        const x = a + i * h;
        s[varName] = x;
        let val;
        try { val = fn.evaluate({ ...s }); } catch { continue; }

        const finite = isComplexNum(val)
          ? isFinite(val.re) && isFinite(val.im)
          : isFinite(val);
        if (!finite) continue;

        const weight = (i === 0 || i === n) ? 1 : (i % 2 === 0 ? 2 : 4);
        sum = math.add(sum, math.multiply(weight, val));
      }

      return math.multiply(sum, h / 3);
    } catch {
      return NaN;
    }
  }

  /**
   * Find zero crossings of f(x) in [a, b] — used for implicit surfaces
   * Returns list of approximate x values where f changes sign
   */
  function findZeroCrossings(compiled, varName, a, b, n = 200, scope = {}) {
    const crossings = [];
    const s = buildScope(scope);
    let prev = NaN;
    let prevX = a;

    for (let i = 0; i <= n; i++) {
      const x = a + (b - a) * i / n;
      s[varName] = x;
      let val;
      try { val = compiled.evaluate({ ...s }); } catch { val = NaN; }
      if (isFinite(prev) && isFinite(val) && Math.sign(prev) !== Math.sign(val)) {
        // Bisect to refine
        const mid = bisect(compiled, varName, prevX, x, s);
        crossings.push(mid);
      }
      prev = val;
      prevX = x;
    }
    return crossings;
  }

  function bisect(compiled, varName, a, b, scope, iters = 12) {
    const s = { ...scope };
    for (let i = 0; i < iters; i++) {
      const mid = (a + b) / 2;
      s[varName] = mid;
      let vm;
      try { vm = compiled.evaluate(s); } catch { break; }
      s[varName] = a;
      let va;
      try { va = compiled.evaluate(s); } catch { break; }
      if (Math.sign(vm) === Math.sign(va)) a = mid;
      else b = mid;
    }
    return (a + b) / 2;
  }

  // ══════════════════════════════════════════════════════
  // COMPLEX NUMBERS
  // ══════════════════════════════════════════════════════

  /**
   * Duck-types whether a value is a math.js Complex number.
   */
  function isComplexNum(val) {
    return !!val && typeof val === 'object'
      && typeof val.re === 'number' && typeof val.im === 'number';
  }

  /**
   * Construct a complex number a + bi
   */
  function makeComplex(re, im = 0) {
    return math.complex(re, im);
  }

  function real(z) {
    return isComplexNum(z) ? z.re : z;
  }

  function imag(z) {
    return isComplexNum(z) ? z.im : 0;
  }

  /**
   * Magnitude (modulus) |z|. Works for real or complex input.
   */
  function magnitude(z) {
    return isComplexNum(z) ? Math.hypot(z.re, z.im) : Math.abs(z);
  }

  /**
   * Argument (phase angle in radians). Works for real or complex input.
   */
  function argument(z) {
    return isComplexNum(z) ? Math.atan2(z.im, z.re) : (z < 0 ? Math.PI : 0);
  }

  function conjugate(z) {
    return isComplexNum(z) ? math.complex(z.re, -z.im) : z;
  }

  /**
   * Thin wrappers around math.js arithmetic that work transparently
   * across real numbers, complex numbers, and mixed operands.
   */
  const complexOps = {
    add:      (a, b) => math.add(a, b),
    subtract: (a, b) => math.subtract(a, b),
    multiply: (a, b) => math.multiply(a, b),
    divide:   (a, b) => math.divide(a, b),
    pow:      (a, b) => math.pow(a, b),
    sqrt:     (a) => math.sqrt(a),
    exp:      (a) => math.exp(a),
    log:      (a) => math.log(a),
  };

  /**
   * Evaluate an expression and return a normalized result object,
   * regardless of whether the result is real or complex. Handy for
   * UI code that needs to branch on isComplex without duck-typing.
   */
  function evalComplex(expr, scope = {}) {
    const result = evalExpr(expr, scope);
    if (isComplexNum(result)) {
      return {
        re: result.re,
        im: result.im,
        magnitude: magnitude(result),
        argument: argument(result),
        isComplex: true,
        formatted: formatComplex(result),
      };
    }
    if (typeof result === 'number') {
      return {
        re: result,
        im: 0,
        magnitude: Math.abs(result),
        argument: result < 0 ? Math.PI : 0,
        isComplex: false,
        formatted: formatNumber(result),
      };
    }
    return { re: NaN, im: NaN, magnitude: NaN, argument: NaN, isComplex: false, formatted: 'NaN' };
  }

  /**
   * Human-readable "a + bi" formatting for a complex (or real) value.
   */
  function formatComplex(z, precision = 4) {
    if (!isComplexNum(z)) {
      return typeof z === 'number' ? formatNumber(z, precision) : String(z);
    }
    const re = +z.re.toFixed(precision);
    const im = +z.im.toFixed(precision);
    if (im === 0) return `${re}`;
    if (re === 0) return `${im}i`;
    const sign = im < 0 ? '-' : '+';
    return `${re} ${sign} ${Math.abs(im)}i`;
  }

  /**
   * Rounds and stringifies a real number for display.
   */
  function formatNumber(n, precision = 4) {
    if (!isFinite(n)) return String(n);
    return String(+n.toFixed(precision));
  }

  // ══════════════════════════════════════════════════════
  // VARIABLE DETECTION
  // ══════════════════════════════════════════════════════

  // Known non-slider variables
  const KNOWN_VARS = new Set([
    'x','y','z','u','v','t','r','theta','phi',
    'pi','e','phi','tau','inf','i',
    'sin','cos','tan','asin','acos','atan','atan2',
    'sinh','cosh','tanh','exp','log','log2','log10','ln','log1p','expm1',
    'sqrt','abs','floor','ceil','round','sign','mod','trunc',
    'min','max','pow','cbrt','hypot',
    'rgb','hsv','okhsv','oklab','oklch','repeat',
    // GLSL-style
    'smoothstep','clamp','fract','mix','step','lerp','remap','ping','noise2','noise3',
    // Trig reciprocals
    'sec','csc','cot','asec','acsc','acot',
    // Signal/waveform
    'heaviside','sawtooth','square','sinc',
    // Higher math
    'erf','erfc','gamma','logGamma','beta',
  ]);

  /**
   * Detect unknown variables in an expression — candidates for sliders.
   * Matches full identifiers of any length (not just single letters —
   * see below), excluding known coordinate/constant names, user
   * functions/constants, and anything used as a function CALL (an
   * identifier immediately followed by "(", via the negative lookahead
   * below) so this doesn't start flagging sin/cos/sqrt/etc. Also scans
   * inside a trailing {condition} domain restriction, after expanding
   * implicit multiplication (so "m" in "{z<mx+c}" is correctly picked up).
   *
   * Previously this only matched a single bare letter (\b([a-zA-Z])\b),
   * which structurally could never match a multi-character identifier at
   * all — so descriptive parameter names like "theta", "omega", "tau",
   * "inc" (all used by this app's own shipped Physics presets) were
   * completely invisible to slider auto-detection, leaving them
   * undefined at evaluation time and the graph silently broken.
   */
  function detectSliderVars(expr) {
    if (!expr) return [];
    const domain = parseDomainRestriction(expr);
    const scanTarget = domain
      ? `${domain.exprPart} ${expandImplicitMultiplication(domain.condition)}`
      : expr;
    const found = new Set();
    const matches = scanTarget.match(/\b([a-zA-Z][a-zA-Z0-9]*)\b(?!\s*\()/g) || [];
    matches.forEach(m => {
      if (!KNOWN_VARS.has(m) && !_userFunctions.has(m) && !_userConstants.has(m)) {
        found.add(m);
      }
    });
    return [...found].sort();
  }

  /**
   * Detect all variable names used in expression. A trailing
   * {condition} domain restriction is translated the same way
   * compile() would translate it before parsing, so its variables
   * (including symbolic ones like "m" in "mx") are included too.
   * An implicit equation (e.g. "x^2+y^2+z^2=r^2") is normalized the
   * same way compile() does before parsing — otherwise math.js's
   * assignment-operator parsing would throw and silently return [],
   * hiding a slider variable like "r" from detection.
   */
  function detectAllVars(expr) {
    if (!expr) return [];
    try {
      const domain = parseDomainRestriction(expr);
      const target = domain
        ? buildDomainExpression(domain.exprPart, domain.condition)
        : normalizeImplicitEquation(expr);
      const node = math.parse(target);
      const vars = new Set();
      node.traverse(n => {
        if (n.isSymbolNode) vars.add(n.name);
      });
      return [...vars];
    } catch {
      return [];
    }
  }

  // ══════════════════════════════════════════════════════
  // DOMAIN RESTRICTIONS — Desmos-style {condition} syntax
  // ══════════════════════════════════════════════════════
  //
  // Recognizes a trailing "{condition}" block immediately after an
  // expression (e.g. "sin(x){x>0}") and transforms it internally into
  // a lazy conditional: "(condition) ? (expression) : NaN". math.js's
  // ternary operator only evaluates the branch it needs, so points
  // outside the domain simply come back as NaN without the expression
  // ever being touched — exactly like Desmos.
  //
  // Comparison operators (<, >, <=, >=, ==, !=) are already valid
  // math.js syntax and pass through unchanged. Logical operators are
  // translated to math.js's word form: && -> and, || -> or, ! -> not
  // (but "!=" is left alone). A comma at the top level of a condition
  // is also treated as "and", matching Desmos's own "{x>0, y>0}" shorthand.
  //
  // Known limitation: chained comparisons like "-5 < x < 5" are not
  // expanded automatically (math.js would evaluate them left-to-right
  // as booleans, not as a range check) — write "x>-5 && x<5" instead.

  // Words that must never be split by implicit-multiplication expansion.
  const CONDITION_KEYWORDS = new Set(['and', 'or', 'not', 'xor', 'true', 'false', 'mod', 'to', 'in']);

  /**
   * Expands adjacent-letter implicit multiplication inside a condition,
   * e.g. "mx+c" -> "m*x+c". math.js itself can't do this (it reads
   * consecutive letters as one identifier), so this is a small
   * dedicated pass used ONLY for domain-restriction conditions — it
   * never touches the main expression or any other existing parsing
   * path in this file.
   *
   * A run of letters is left alone (not split) if it's length 1, is a
   * function call (immediately followed by "("), or is a recognized
   * built-in / user-defined function, constant, or keyword.
   */
  function expandImplicitMultiplication(str) {
    return str.replace(/[A-Za-z]+/g, (word, offset, full) => {
      if (word.length === 1) return word;
      if (full[offset + word.length] === '(') return word;        // function call
      if (KNOWN_VARS.has(word)) return word;                      // built-in fn/const/coord name
      if (CONDITION_KEYWORDS.has(word)) return word;               // and/or/not/true/false/...
      if (_userFunctions.has(word)) return word;                   // user-defined function
      if (_userConstants.has(word)) return word;                   // user-defined constant
      return word.split('').join('*');                             // mx -> m*x
    });
  }

  /**
   * Translates a raw Desmos-style condition string into valid math.js
   * boolean-expression syntax: expands implicit multiplication, turns
   * top-level commas into "and", and swaps &&/||/! for and/or/not.
   */
  function translateCondition(condition) {
    const parts = splitTopLevel(condition, [',']);
    const joined = parts.length > 1 ? parts.join(' and ') : condition;

    let out = expandImplicitMultiplication(joined);
    out = out.replace(/&&/g, ' and ');
    out = out.replace(/\|\|/g, ' or ');
    out = out.replace(/!(?!=)/g, ' not ');        // don't touch "!="
    return out.replace(/\s+/g, ' ').trim();
  }

  /**
   * Detects a single trailing "{condition}" block on `expr`. Returns
   * { exprPart, condition } if found, or null if `expr` has no domain
   * restriction (or it's malformed — unbalanced braces, more than one
   * top-level brace group, or text after the closing brace), in which
   * case the caller should fall back to normal parsing.
   */
  function parseDomainRestriction(expr) {
    if (typeof expr !== 'string') return null;
    const trimmed = expr.trim();
    if (!trimmed.endsWith('}')) return null;

    let depth = 0;
    let start = -1;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '{') {
        if (depth === 0) {
          if (start !== -1) return null;    // more than one top-level {} group
          start = i;
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth < 0) return null;          // unbalanced
        if (depth === 0 && i !== trimmed.length - 1) return null; // must end the string
      }
    }
    if (depth !== 0 || start === -1) return null;

    const exprPart = trimmed.slice(0, start).trim();
    const condition = trimmed.slice(start + 1, trimmed.length - 1).trim();
    if (!exprPart || !condition) return null;

    return { exprPart, condition };
  }

  /**
   * Builds the final math.js-compatible ternary string for a
   * domain-restricted expression: "(condition) ? (exprPart) : NaN".
   */
  function buildDomainExpression(exprPart, condition) {
    return `(${translateCondition(condition)}) ? (${normalizeImplicitEquation(exprPart)}) : NaN`;
  }

  /**
   * Compiles a domain-restricted expression into a single math.js
   * function. Outside the domain it evaluates to NaN (math.js's
   * ternary is lazy, so the expression branch is never touched there,
   * and no unbound variable inside it is ever evaluated).
   */
  function compileDomainRestricted(exprPart, condition) {
    return math.compile(buildDomainExpression(exprPart, condition));
  }

  /**
   * Compiles a BARE boolean condition string — no surrounding "{}" —
   * for callers like graph-builder.js's piecewise renderer, where a
   * piece is already a structured { condition, expr } object rather
   * than Desmos-style "{condition}" text. Applies the exact same
   * translateCondition() pass used for {..} domain restrictions, so
   * &&/||/!, top-level commas, and "mx"-style implicit multiplication
   * behave identically whether a condition lives inside a {..} block
   * or as a standalone piece. Tolerates an accidental "{...}" wrapper
   * on the input by stripping it first.
   *
   * NOTE: today, calling MathEngine.compile(p.condition) directly on
   * a bare condition like "x>0 && y<1" will throw, because math.js
   * doesn't understand "&&" — only compileCondition() (or a "{..}"
   * wrapped string) applies the translation. If your piecewise pieces
   * use && / || / ! or comma-as-AND, switch compilePieces() to call
   * this instead of MathEngine.compile() on the raw condition text.
   */
  function compileCondition(condition) {
    let raw = String(condition).trim();
    if (raw.startsWith('{') && raw.endsWith('}')) {
      raw = raw.slice(1, -1).trim();
    }
    return compile(translateCondition(raw));
  }

  // ══════════════════════════════════════════════════════
  // EXPRESSION UTILITIES
  // ══════════════════════════════════════════════════════

  /**
   * Pretty-print an expression using Math.js simplification
   */
  function prettify(expr) {
    try {
      return math.simplify(expr).toString();
    } catch {
      return expr;
    }
  }

  /**
   * Like prettify(), but returns structured info instead of a bare
   * string — built for a live "= simplified form" hint under the
   * input as the user types. `changed` tells the UI whether showing
   * a hint is even worth it (no point echoing "x" -> "x").
   *
   * A trailing {condition} domain restriction is preserved as-is;
   * only the expression part is simplified.
   *
   * @param {string} expr
   * @returns {{ ok: boolean, original: string, simplified: string|null, changed: boolean, error?: string }}
   */
  function getSimplifiedForm(expr) {
    if (!expr || !expr.trim()) {
      return { ok: false, original: expr, simplified: null, changed: false, error: 'Empty expression' };
    }
    const trimmed = expr.trim();
    const domain = parseDomainRestriction(trimmed);
    const target = domain ? domain.exprPart : trimmed;
    try {
      const simplifiedCore = math.simplify(target).toString();
      const simplified = domain ? `${simplifiedCore} {${domain.condition}}` : simplifiedCore;
      return {
        ok: true,
        original: trimmed,
        simplified,
        changed: simplifiedCore.replace(/\s+/g, '') !== target.replace(/\s+/g, ''),
        error: null,
      };
    } catch (e) {
      return { ok: false, original: trimmed, simplified: null, changed: false, error: friendlyError(e.message) };
    }
  }

  /**
   * Convert an expression to LaTeX
   */
  function toLatex(expr) {
    try {
      return math.parse(expr).toTex();
    } catch {
      return expr;
    }
  }

  /**
   * Evaluate expression to see if it's a constant. Complex-safe.
   */
  function isConstant(expr, knownVars = ['x','y','z']) {
    try {
      const fn = compile(expr);
      const scope = buildScope({});
      knownVars.forEach(v => { scope[v] = Math.random() * 10; });
      const v1 = fn.evaluate({ ...scope });
      knownVars.forEach(v => { scope[v] = Math.random() * 10; });
      const v2 = fn.evaluate({ ...scope });
      const diff = math.abs(math.subtract(v1, v2));
      return diff < 1e-8;
    } catch {
      return false;
    }
  }

  // ══════════════════════════════════════════════════════
  // EQUATION CLASSIFICATION & 2D LINE PARSING
  // ══════════════════════════════════════════════════════
  //
  // Classifies a raw equation string into one of four shapes the
  // graph-builder understands (explicit / implicit / parametric /
  // 2D line), and — for 2D lines specifically — extracts slope and
  // intercept metadata WITHOUT ever numerically evaluating unbound
  // symbols like m, c, a, b. They come back tagged
  // { symbolic: true, value: null } instead of being run through
  // compile()/evaluate() (which would throw and collapse to NaN).
  //
  // NOTE: math.js tokenizes adjacent letters ("mx") as a single
  // identifier, not m*x. So the 2D-line path intentionally does NOT
  // go through math.parse()/compile() — it uses a small dedicated
  // regex decomposer instead. This only affects line2d parsing;
  // every existing function above (compile, evaluate, integrate,
  // gradient, etc.) is untouched and behaves exactly as before.

  const EQUATION_TYPES = Object.freeze({
    EXPLICIT: 'explicit',
    IMPLICIT: 'implicit',
    PARAMETRIC: 'parametric',
    LINE_2D: 'line2d',
  });

  const PARAMETER_AXES = new Set(['t', 'u', 'v']);

  /**
   * Parses a single coefficient/constant token from a linear expression
   * (e.g. "m", "-3", "+c", "5"). Never evaluates symbolic names — a
   * bare identifier is returned as { symbolic: true, value: null, ... }
   * rather than being coerced into a number (and never NaN).
   * Returns null if the token is neither a valid number nor identifier.
   */
  function parseLinearToken(token, emptyValue) {
    if (token === undefined || token === '') {
      return { value: emptyValue, expr: String(emptyValue), symbolic: false };
    }
    let sign = 1;
    let body = token;
    if (body[0] === '+') {
      body = body.slice(1);
    } else if (body[0] === '-') {
      sign = -1;
      body = body.slice(1);
    }
    if (body === '') {
      const val = sign * emptyValue;
      return { value: val, expr: String(val), symbolic: false };
    }
    const num = Number(body);
    if (!Number.isNaN(num)) {
      const val = sign * num;
      return { value: val, expr: String(val), symbolic: false };
    }
    // Not a number — must be a bare symbolic identifier (m, c, a, b, k, ...)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(body)) return null;
    return {
      value: null,                             // never a numeric guess, never NaN
      expr: sign === -1 ? `-${body}` : body,
      symbolic: true,
      symbol: body,
      sign,
    };
  }

  /**
   * Tries to match rhsClean against "<coeff><varSymbol>[<sign><const>]",
   * e.g. "mx+c", "2x+5", "-3x-7", "x", "-x+3", "(1/2)x+3". Coefficient/
   * constant may each be numeric, a bare symbolic name, or (coefficient
   * only) a parenthesized simple fraction like "(1/2)" or "(-3/4)".
   * Handles both implicit ("mx") and explicit ("m*x") multiplication.
   */
  function tryParseAffine(rhsClean, varSymbol) {
    // Special-case a parenthesized fractional coefficient up front,
    // e.g. "(1/2)x+3" — the general character class below doesn't
    // include "(", "/", ")", so this needs its own small check.
    const fracMatch = rhsClean.match(/^\(([+-]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\)\*?/);
    if (fracMatch) {
      const num = Number(fracMatch[1]);
      const den = Number(fracMatch[2]);
      if (den !== 0) {
        const rest = rhsClean.slice(fracMatch[0].length);
        const re = new RegExp(`^${varSymbol}([+-][A-Za-z0-9.]+)?$`);
        const match = rest.match(re);
        if (match) {
          const coefficient = { value: num / den, expr: `(${fracMatch[1]}/${fracMatch[2]})`, symbolic: false };
          const constant = match[1] !== undefined
            ? parseLinearToken(match[1], 0)
            : { value: 0, expr: '0', symbolic: false };
          if (!constant) return null;
          return { coefficient, constant };
        }
      }
      // Malformed (e.g. divide-by-zero or junk after the fraction) — fall
      // through to the general path below, which will most likely also
      // fail to match and correctly report "not a line" to the caller.
    }

    const re = new RegExp(`^([+-]?[A-Za-z0-9.]*)\\*?${varSymbol}([+-][A-Za-z0-9.]+)?$`);
    const match = rhsClean.match(re);
    if (!match) return null;
    const coefficient = parseLinearToken(match[1], 1);
    const constant = match[2] !== undefined
      ? parseLinearToken(match[2], 0)
      : { value: 0, expr: '0', symbolic: false };
    if (!coefficient || !constant) return null;
    return { coefficient, constant };
  }

  /**
   * Tries to match rhsClean as a bare constant (numeric or symbolic)
   * that does not depend on any of forbiddenVars, e.g. "5", "-2", "c".
   */
  function tryParseConstantToken(rhsClean, forbiddenVars) {
    for (const v of forbiddenVars) {
      const re = new RegExp(`(^|[^A-Za-z0-9_])${v}([^A-Za-z0-9_]|$)`);
      if (re.test(rhsClean)) return null;
    }
    return parseLinearToken(rhsClean, 0);
  }

  /**
   * Dedicated 2D line parser. Supports:
   *   y = mx + c    y = 2x + 5    y = -3x - 7   (slope-intercept — symbolic or numeric)
   *   x = 5         x = -2                      (vertical lines)
   *   y = c         x = a                       (horizontal / vertical, symbolic constant)
   *   x = my + c                                (x written in terms of y — bonus symmetry)
   *
   * Returns null if `expr` isn't recognizable as one of these forms;
   * callers should fall back to explicit/implicit classification.
   */
  function parseLine2D(expr) {
    const eqParts = String(expr).split('=');
    if (eqParts.length !== 2) return null;

    const lhs = eqParts[0].replace(/\s+/g, '');
    const rhs = eqParts[1].replace(/\s+/g, '');
    if (!rhs) return null;

    if (lhs === 'y') {
      const affine = tryParseAffine(rhs, 'x');
      if (affine) {
        return {
          form: 'slope-intercept',
          dependentVar: 'y',
          independentVar: 'x',
          slope: affine.coefficient,
          intercept: affine.constant,
        };
      }
      const constant = tryParseConstantToken(rhs, ['x']);
      if (constant) {
        return { form: 'horizontal', axis: 'y', dependentVar: 'y', constant };
      }
      return null;
    }

    if (lhs === 'x') {
      const affine = tryParseAffine(rhs, 'y');
      if (affine) {
        return {
          form: 'x-in-terms-of-y',
          dependentVar: 'x',
          independentVar: 'y',
          slope: affine.coefficient,
          intercept: affine.constant,
        };
      }
      const constant = tryParseConstantToken(rhs, ['y']);
      if (constant) {
        return { form: 'vertical', axis: 'x', dependentVar: 'x', constant };
      }
      return null;
    }

    return null;
  }

  /**
   * Splits a string on top-level commas/semicolons (i.e. not inside
   * parentheses) — used to detect multi-component parametric equations
   * like "x=cos(t), y=sin(t), z=t".
   */
  function splitTopLevel(str, delimiters) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth === 0 && delimiters.includes(ch)) {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    parts.push(current);
    return parts.map(p => p.trim()).filter(Boolean);
  }

  /**
   * detectAllVars() wrapped so a parse failure during classification
   * never bubbles up as an exception (and is never treated as NaN).
   */
  function safeDetectVars(expr) {
    try {
      return detectAllVars(expr);
    } catch {
      return [];
    }
  }

  /**
   * Classifies a bare expression with no "=" sign at all, e.g.
   * "sin(x)*cos(y)". Preserves existing behavior: such expressions
   * have always been treated as an implicit "z = ..." / "y = ..."
   * explicit form by compile()/evaluate() — this just labels that.
   */
  function classifyBareExpression(expr) {
    const vars = safeDetectVars(expr);
    if (vars.length && vars.every(v => PARAMETER_AXES.has(v))) {
      return { type: EQUATION_TYPES.PARAMETRIC, component: null, parameter: vars[0], expr };
    }
    return { type: EQUATION_TYPES.EXPLICIT, dependent: null, independent: vars, expr };
  }

  /**
   * Classifies a comma/semicolon-separated set of component equations,
   * e.g. "x=cos(t), y=sin(t), z=t" -> parametric.
   */
  function classifyParametricComponents(components, raw) {
    const parsed = {};
    let parameter = null;
    components.forEach(comp => {
      const parts = comp.split('=');
      if (parts.length !== 2) return;
      const varName = parts[0].trim();
      const rhs = parts[1].trim();
      parsed[varName] = rhs;
      if (!parameter) {
        const vars = safeDetectVars(rhs);
        const found = vars.find(v => PARAMETER_AXES.has(v));
        if (found) parameter = found;
      }
    });
    return { type: EQUATION_TYPES.PARAMETRIC, components: parsed, parameter: parameter || 't', raw };
  }

  /**
   * Structurally classifies `expr` as one of EQUATION_TYPES. If `expr`
   * carries a trailing Desmos-style domain restriction (e.g.
   * "y = 2x+5{x>0}"), it's stripped off before classifying the
   * underlying equation shape and reattached as a `domain` field —
   * this keeps the '=' splitting below from tripping over a
   * comparison operator (>=, <=, ==, !=) that happens to live inside
   * the condition. See parseEquation() for the public, error-safe
   * wrapper, and parseDomainRestriction()/compile() for how domain
   * restrictions are actually evaluated.
   */
  function classifyEquation(expr) {
    if (typeof expr !== 'string' || !expr.trim()) {
      return { type: 'unknown', raw: expr, error: 'Empty or invalid expression' };
    }
    const rawTrimmed = expr.trim();
    const domain = parseDomainRestriction(rawTrimmed);
    const coreExpr = domain ? domain.exprPart : rawTrimmed;

    const result = classifyEquationCore(coreExpr);
    result.raw = rawTrimmed;
    if (domain) result.domain = domain.condition;
    return result;
  }

  function classifyEquationCore(trimmed) {
    const components = splitTopLevel(trimmed, [',', ';']);
    if (components.length > 1) {
      return classifyParametricComponents(components, trimmed);
    }

    const eqParts = trimmed.split('=');
    if (eqParts.length === 1) {
      return { ...classifyBareExpression(trimmed), raw: trimmed };
    }
    if (eqParts.length > 2) {
      return { type: EQUATION_TYPES.IMPLICIT, form: 'chained', raw: trimmed };
    }

    const lhsRaw = eqParts[0];
    const rhsRaw = eqParts[1];
    const lhs = lhsRaw.replace(/\s+/g, '');

    // 1) Dedicated 2D line detection (linear only, symbolic-safe)
    if (lhs === 'x' || lhs === 'y') {
      const line = parseLine2D(trimmed);
      if (line) {
        return { type: EQUATION_TYPES.LINE_2D, ...line, raw: trimmed };
      }
    }

    const isSingleCoordLHS = ['x', 'y', 'z'].includes(lhs);
    const rhsVars = safeDetectVars(rhsRaw);

    // 2) Parametric: single coordinate driven purely by t/u/v
    if (isSingleCoordLHS && rhsVars.length && rhsVars.every(v => PARAMETER_AXES.has(v))) {
      return {
        type: EQUATION_TYPES.PARAMETRIC,
        component: lhs,
        parameter: rhsVars[0],
        expr: rhsRaw.trim(),
        raw: trimmed,
      };
    }

    // 3) Explicit surface/curve: single coordinate solved in terms of the others
    if (isSingleCoordLHS) {
      return {
        type: EQUATION_TYPES.EXPLICIT,
        dependent: lhs,
        independent: rhsVars.filter(v => v !== lhs),
        expr: rhsRaw.trim(),
        raw: trimmed,
      };
    }

    // 4) Implicit surface: fallback — LHS isn't a single coordinate variable
    return {
      type: EQUATION_TYPES.IMPLICIT,
      lhs: lhsRaw.trim(),
      rhs: rhsRaw.trim(),
      expr: normalizeImplicitEquation(trimmed),
      raw: trimmed,
    };
  }

  /**
   * Public entry point: parses `expr` and returns metadata for the
   * graph-builder to consume. Never throws, and never silently
   * evaluates unbound symbols (m, c, a, b, ...) into NaN — they come
   * back tagged { symbolic: true, value: null } so the caller can
   * bind them via sliders/params instead.
   *
   * @param {string} expr
   * @returns {{ ok: boolean, type: string, raw: string, error?: string }}
   */
  function parseEquation(expr) {
    try {
      const result = classifyEquation(expr);
      if (result.type === 'unknown') {
        return { ok: false, ...result };
      }
      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, type: 'unknown', raw: expr, error: friendlyError(e.message) };
    }
  }

  // ══════════════════════════════════════════════════════
  // SYMBOLIC STEPS — for tutor-mode grounding, not prose
  // ══════════════════════════════════════════════════════
  //
  // getDerivativeSteps()/getIntegralSteps() walk the REAL math.js AST
  // (from math.parse) and apply calculus rules one at a time, emitting
  // { step, ruleName } for each. They never construct new math.js Node
  // objects — only ever read the well-documented duck-typed properties
  // of the ORIGINAL parsed nodes (isConstantNode/isSymbolNode/etc.,
  // .args, .fn, .op, .value, .name, .content) and build results as
  // plain strings. This keeps the logic simple to audit and impossible
  // to get subtly wrong by mis-constructing a Node by hand.
  //
  // Scope, stated honestly:
  //  - Differentiation covers: constant, variable, sum/difference,
  //    constant multiple, product, quotient, power rule (incl. chain
  //    rule when the base is an inner expression), a^f(x) exponentials,
  //    unary minus, and chain rule for sin/cos/tan/exp/log/sqrt/abs.
  //    Anything else falls back to math.js's own math.derivative() —
  //    which is CORRECT, just not decomposed into rule-by-rule steps.
  //    That fallback step is clearly labeled as such.
  //  - Integration has no such safe fallback (math.js has no symbolic
  //    integrator at all). It covers term-by-term sum/difference,
  //    constant multiple, the power rule in reverse, 1/x -> ln|x|, and
  //    sin/cos/exp of a bare variable. Anything outside that table
  //    returns { ok: false, error } instead of guessing — a wrong
  //    integral shown to a student is worse than no integral.

  /** True if `node` (or any descendant) is the symbol `varName`. */
  function containsVar(node, varName) {
    let found = false;
    node.traverse(n => { if (n.isSymbolNode && n.name === varName) found = true; });
    return found;
  }

  /**
   * Recognizes a node that is a numeric-literal constant, INCLUDING a
   * negative one. math.js's parser never produces a ConstantNode with a
   * negative .value — a literal like "-2" is always parsed as
   * unaryMinus(ConstantNode(2)), an OperatorNode. Code that checks
   * `node.isConstantNode` directly (as the pow-rule branches below used
   * to) therefore silently misses every negative-literal exponent —
   * "x^-2", "x^-1", "(x+1)^-3", etc. — and falls through to a less
   * specific path even though the exponent IS a plain constant.
   * Returns { isConst: true, value } or { isConst: false }.
   */
  function constNodeValue(node) {
    if (node.isConstantNode) return { isConst: true, value: node.value };
    if (node.isOperatorNode && node.fn === 'unaryMinus' && node.args[0].isConstantNode) {
      return { isConst: true, value: -node.args[0].value };
    }
    return { isConst: false, value: null };
  }

  /** Chain-rule outer derivatives for common single-argument functions. */
  const CHAIN_RULE_TABLE = {
    sin:  (u) => `cos(${u})`,
    cos:  (u) => `-sin(${u})`,
    tan:  (u) => `1/cos(${u})^2`,
    exp:  (u) => `exp(${u})`,
    log:  (u) => `1/(${u})`,
    sqrt: (u) => `1/(2*sqrt(${u}))`,
    abs:  (u) => `(${u})/abs(${u})`,
  };

  /**
   * Falls back to math.js's own (correct, but non-decomposed) symbolic
   * derivative for anything not covered by a specific rule above.
   */
  function fallbackDerivative(node, wrt, steps) {
    const result = math.derivative(node, wrt).toString();
    steps.push({ step: result, ruleName: 'Symbolic derivative (math.js) — rule not decomposed further' });
    return result;
  }

  /**
   * Differentiates `node` w.r.t. `wrt`, pushing a { step, ruleName }
   * entry for every rule applied, and returns the resulting derivative
   * as a string.
   */
  function diffNode(node, wrt, steps) {
    if (node.isConstantNode) {
      steps.push({ step: '0', ruleName: 'Constant Rule: d/d' + wrt + '[c] = 0' });
      return '0';
    }

    if (node.isSymbolNode) {
      if (node.name === wrt) {
        steps.push({ step: '1', ruleName: `Variable Rule: d/d${wrt}[${wrt}] = 1` });
        return '1';
      }
      steps.push({ step: '0', ruleName: `Constant Rule: "${node.name}" is treated as a constant w.r.t. ${wrt}` });
      return '0';
    }

    if (node.isParenthesisNode) {
      return diffNode(node.content, wrt, steps);
    }

    if (node.isOperatorNode) {
      const args = node.args;
      switch (node.fn) {
        case 'add':
        case 'subtract': {
          const dA = diffNode(args[0], wrt, steps);
          const dB = diffNode(args[1], wrt, steps);
          const op = node.fn === 'add' ? '+' : '-';
          const result = `(${dA}) ${op} (${dB})`;
          steps.push({ step: result, ruleName: node.fn === 'add' ? "Sum Rule: (f+g)' = f' + g'" : "Difference Rule: (f-g)' = f' - g'" });
          return result;
        }
        case 'multiply': {
          const [f, g] = args;
          const df = diffNode(f, wrt, steps);
          const dg = diffNode(g, wrt, steps);
          const result = `(${df})*(${g.toString()}) + (${f.toString()})*(${dg})`;
          steps.push({ step: result, ruleName: "Product Rule: (fg)' = f'g + fg'" });
          return result;
        }
        case 'divide': {
          const [f, g] = args;
          const df = diffNode(f, wrt, steps);
          const dg = diffNode(g, wrt, steps);
          const result = `((${df})*(${g.toString()}) - (${f.toString()})*(${dg})) / (${g.toString()})^2`;
          steps.push({ step: result, ruleName: "Quotient Rule: (f/g)' = (f'g - fg') / g^2" });
          return result;
        }
        case 'pow': {
          const [base, exp] = args;
          const baseHasVar = containsVar(base, wrt);
          const expHasVar = containsVar(exp, wrt);
          const expConst = constNodeValue(exp);
          if (expConst.isConst && baseHasVar) {
            const n = expConst.value;
            const du = diffNode(base, wrt, steps);
            const result = `${n}*(${base.toString()})^(${n - 1}) * (${du})`;
            steps.push({
              step: result,
              ruleName: base.isSymbolNode ? 'Power Rule: d/dx[x^n] = n*x^(n-1)' : 'Power Rule + Chain Rule',
            });
            return result;
          }
          if (!baseHasVar && expHasVar) {
            const du = diffNode(exp, wrt, steps);
            const result = `(${base.toString()})^(${exp.toString()}) * log(${base.toString()}) * (${du})`;
            steps.push({ step: result, ruleName: "Exponential Rule: d/dx[a^u] = a^u * ln(a) * u'" });
            return result;
          }
          return fallbackDerivative(node, wrt, steps);
        }
        case 'unaryMinus': {
          const d = diffNode(args[0], wrt, steps);
          const result = `-(${d})`;
          steps.push({ step: result, ruleName: "Constant Multiple Rule: (-f)' = -f'" });
          return result;
        }
        default:
          return fallbackDerivative(node, wrt, steps);
      }
    }

    if (node.isFunctionNode) {
      const name = node.fn && node.fn.name;
      if (CHAIN_RULE_TABLE[name] && node.args.length === 1) {
        const u = node.args[0];
        const du = diffNode(u, wrt, steps);
        const outer = CHAIN_RULE_TABLE[name](u.toString());
        const result = `(${outer}) * (${du})`;
        steps.push({ step: result, ruleName: `Chain Rule: d/du[${name}(u)] applied` });
        return result;
      }
      return fallbackDerivative(node, wrt, steps);
    }

    return fallbackDerivative(node, wrt, steps);
  }

  /**
   * Symbolic derivative with a verified, rule-by-rule step list.
   * Returns { step, ruleName } objects (no prose) so a caller like an
   * AI tutor can phrase its own explanation around verified math
   * rather than trusting the model's arithmetic.
   *
   * @param {string} expr
   * @param {string} wrt - variable to differentiate with respect to
   * @returns {{ ok: boolean, expr?: string, wrt?: string, steps: Array<{step:string, ruleName:string}>, result: string|null, error?: string }}
   */
  function getDerivativeSteps(expr, wrt = 'x') {
    if (!expr || !expr.trim()) {
      return { ok: false, error: 'Empty expression', steps: [], result: null };
    }
    try {
      const node = math.parse(expr.trim());
      const steps = [];
      const resultStr = diffNode(node, wrt, steps);
      let result = resultStr;
      try { result = math.simplify(resultStr).toString(); } catch { /* keep unsimplified form */ }
      return { ok: true, expr: expr.trim(), wrt, steps, result };
    } catch (e) {
      return { ok: false, error: friendlyError(e.message), steps: [], result: null };
    }
  }

  /**
   * Flattens a top-level chain of +/- into [{ node, sign }], sign
   * relative to the whole expression (used for term-by-term
   * integration — the sum rule is the only "structural" rule needed
   * before falling back to the per-term lookup table).
   */
  function flattenSumTerms(node) {
    if (node.isOperatorNode && (node.fn === 'add' || node.fn === 'subtract')) {
      const left = flattenSumTerms(node.args[0]);
      const right = flattenSumTerms(node.args[1]);
      const rightSign = node.fn === 'subtract' ? -1 : 1;
      return [...left, ...right.map(r => ({ node: r.node, sign: r.sign * rightSign }))];
    }
    if (node.isParenthesisNode) {
      return flattenSumTerms(node.content);
    }
    return [{ node, sign: 1 }];
  }

  /**
   * Integrates a SINGLE term (no top-level +/-) against a small table
   * of verified basic forms. Returns { ok: true, result, ruleName } on
   * a match, or { ok: false, reason } if the term isn't in the table —
   * callers must treat `ok: false` as "can't verify this," not as an
   * error to paper over.
   */
  function integrateTerm(node, wrt) {
    if (node.isConstantNode) {
      return { ok: true, result: `${node.toString()}*${wrt}`, ruleName: 'Constant Rule: ∫c d' + wrt + ' = c·' + wrt };
    }

    if (node.isSymbolNode && node.name === wrt) {
      return { ok: true, result: `${wrt}^2/2`, ruleName: `Power Rule: ∫${wrt} d${wrt} = ${wrt}^2/2` };
    }

    if (node.isSymbolNode) {
      return { ok: true, result: `${node.name}*${wrt}`, ruleName: `Constant Rule: "${node.name}" is constant w.r.t. ${wrt}` };
    }

    if (node.isParenthesisNode) {
      return integrateTerm(node.content, wrt);
    }

    if (node.isOperatorNode && node.fn === 'unaryMinus') {
      const inner = integrateTerm(node.args[0], wrt);
      if (!inner.ok) return inner;
      return { ok: true, result: `-(${inner.result})`, ruleName: 'Constant Multiple Rule' };
    }

    if (node.isOperatorNode && node.fn === 'multiply') {
      const [a, b] = node.args;
      if (!containsVar(a, wrt)) {
        const inner = integrateTerm(b, wrt);
        if (!inner.ok) return inner;
        return { ok: true, result: `(${a.toString()})*(${inner.result})`, ruleName: 'Constant Multiple Rule' };
      }
      if (!containsVar(b, wrt)) {
        const inner = integrateTerm(a, wrt);
        if (!inner.ok) return inner;
        return { ok: true, result: `(${b.toString()})*(${inner.result})`, ruleName: 'Constant Multiple Rule' };
      }
      return { ok: false, reason: 'Product of two non-constant factors needs integration by parts, which is not in the supported basic-forms table.' };
    }

    if (node.isOperatorNode && node.fn === 'pow') {
      const [base, exp] = node.args;
      const expConst = constNodeValue(exp);
      if (base.isSymbolNode && base.name === wrt && expConst.isConst) {
        const n = expConst.value;
        if (n === -1) {
          return { ok: true, result: `log(abs(${wrt}))`, ruleName: `Reciprocal Rule: ∫${wrt}^-1 d${wrt} = ln|${wrt}|` };
        }
        return { ok: true, result: `${wrt}^(${n + 1})/(${n + 1})`, ruleName: 'Power Rule: ∫x^n dx = x^(n+1)/(n+1)' };
      }
      return { ok: false, reason: 'General power form f(x)^g(x) is not in the supported basic-forms table.' };
    }

    if (node.isOperatorNode && node.fn === 'divide') {
      const [a, b] = node.args;
      // f(x) / constant  ==  (1/constant) * f(x) -> integrate the top, divide by the constant
      if (!containsVar(b, wrt)) {
        const inner = integrateTerm(a, wrt);
        if (!inner.ok) return inner;
        return { ok: true, result: `(${inner.result})/(${b.toString()})`, ruleName: 'Constant Multiple Rule (division by a constant)' };
      }
      // constant / x  ==  constant * x^-1 -> reciprocal rule
      if (!containsVar(a, wrt) && b.isSymbolNode && b.name === wrt) {
        return { ok: true, result: `(${a.toString()})*log(abs(${wrt}))`, ruleName: `Reciprocal Rule: ∫c/${wrt} d${wrt} = c·ln|${wrt}|` };
      }
      return { ok: false, reason: 'General quotient f(x)/g(x) is not in the supported basic-forms table (would need a substitution or reduction technique).' };
    }

    if (node.isFunctionNode) {
      const name = node.fn && node.fn.name;
      const u = node.args && node.args[0];
      const BASIC_INTEGRALS = { sin: (v) => `-cos(${v})`, cos: (v) => `sin(${v})`, exp: (v) => `exp(${v})` };
      if (BASIC_INTEGRALS[name] && node.args.length === 1 && u && u.isSymbolNode && u.name === wrt) {
        return { ok: true, result: BASIC_INTEGRALS[name](wrt), ruleName: `Standard Integral: ∫${name}(${wrt}) d${wrt}` };
      }
      return { ok: false, reason: `${name}(...) with a non-trivial inner expression would need substitution, which is not in the supported basic-forms table.` };
    }

    return { ok: false, reason: 'Expression form is not in the supported basic-forms table.' };
  }

  /**
   * Symbolic integral with a verified, term-by-term step list. Unlike
   * getDerivativeSteps(), there is no safe fallback for unsupported
   * forms (math.js has no symbolic integrator) — if any term isn't in
   * the basic-forms table, this returns { ok: false, error } naming
   * the offending term rather than guessing.
   *
   * @param {string} expr
   * @param {string} wrt - variable of integration
   * @returns {{ ok: boolean, expr?: string, wrt?: string, steps: Array<{step:string, ruleName:string}>, result: string|null, error?: string }}
   */
  function getIntegralSteps(expr, wrt = 'x') {
    if (!expr || !expr.trim()) {
      return { ok: false, error: 'Empty expression', steps: [], result: null };
    }
    try {
      const node = math.parse(expr.trim());
      const terms = flattenSumTerms(node);
      const steps = [];
      const resultParts = [];
      for (const { node: termNode, sign } of terms) {
        const r = integrateTerm(termNode, wrt);
        if (!r.ok) {
          return {
            ok: false,
            error: `Can't produce a verified step for "${termNode.toString()}": ${r.reason}`,
            steps,
            result: null,
          };
        }
        steps.push({ step: r.result, ruleName: r.ruleName });
        resultParts.push(sign === -1 ? `-(${r.result})` : `(${r.result})`);
      }
      const combined = resultParts.join(' + ').replace(/\+ -/g, '- ');
      let result = `${combined} + C`;
      try { result = `${math.simplify(combined).toString()} + C`; } catch { /* keep unsimplified combined form */ }
      return { ok: true, expr: expr.trim(), wrt, steps, result };
    } catch (e) {
      return { ok: false, error: friendlyError(e.message), steps: [], result: null };
    }
  }

  // ══════════════════════════════════════════════════════
  // SELF-REFERENTIAL VARIABLE DETECTION
  // ══════════════════════════════════════════════════════
  //
  // DETECTION only — deciding what to DO with the answer (switch an
  // equation to implicit type, show a message, etc.) is intentionally
  // left to the caller (e.g. mod-equations.js), which owns the type
  // switch itself. This just answers "does this expression contain
  // that variable," reliably, for both a bare expression and either
  // side of a full equation.

  /**
   * True if `varName` appears as a free variable anywhere in `expr`.
   * Handles a bare expression ("sin(x)+cos(z)"), an equation with a
   * bare x/y/z left-hand side ("z=sin(x)+cos(y)+sin(z)" — math.js
   * parses this natively as an assignment, so it's checked directly),
   * and an equation with a compound left-hand side ("x^2+y=sin(z)" —
   * math.js can't parse that as one assignment, so each side is
   * parsed and checked separately).
   *
   * Typical use: after stripping a "z=" style prefix from user input,
   * check whether z is STILL present in what's left — if so, there's
   * no closed-form explicit solution for z, and the equation should
   * be treated as implicit ("expr = 0") rather than explicit.
   */
  function hasFreeVariable(expr, varName) {
    const str = String(expr).trim();
    const tryParse = (s) => containsVar(math.parse(s), varName);
    try {
      return tryParse(str);
    } catch {
      const positions = findBareEquals(str);
      if (positions.length === 1) {
        try {
          return tryParse(str.slice(0, positions[0])) || tryParse(str.slice(positions[0] + 1));
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  // ══════════════════════════════════════════════════════
  // ERROR MESSAGES — friendly rewrites
  // ══════════════════════════════════════════════════════

  function friendlyError(msg) {
    if (!msg) return 'Unknown error';
    const m = msg.toLowerCase();
    if (m.includes('invalid left hand side') || m.includes('invalid left-hand side')) {
      return 'This looks like a chained or ambiguous equation (e.g. "x=y=5") — try writing it as one equation, or split it into two.';
    }
    if (m.includes('undefined symbol') || m.includes('undefined variable')) {
      // mathjs's own message isn't guaranteed to quote the name, so try
      // the specific "undefined symbol/variable <name>" shape first,
      // quoted or not, before falling back to any quoted substring.
      const specific = msg.match(/undefined (?:symbol|variable)\s+["']?([A-Za-z_][A-Za-z0-9_]*)["']?/i);
      const generic = msg.match(/["']([^"']+)["']/);
      const name = (specific && specific[1]) || (generic && generic[1]) || 'variable';
      return `Unknown variable "${name}" — add a slider for it`;
    }
    if (m.includes('unexpected end') || m.includes('syntax error')) {
      return 'Syntax error — check brackets and operators';
    }
    if (m.includes('parenthesis') || m.includes('bracket')) {
      return 'Mismatched brackets';
    }
    // math.js's own "wrong argument type" errors, e.g.:
    // "TypeError: Unexpected type of argument in function sqrt
    //  (expected: number, actual: string, index: 0)"
    // -> rephrased with a 1-based argument index and plain wording.
    const typeMatch = msg.match(/unexpected type of argument.*?\(expected:\s*([^,]+),\s*actual:\s*([^,]+),\s*index:\s*(\d+)\)/i);
    if (typeMatch) {
      const [, expected, actual, index] = typeMatch;
      return `Expected a ${expected.trim()} but got a ${actual.trim()} for argument ${Number(index) + 1}`;
    }
    // Our own color/repeat/regression functions already throw a
    // clearly-worded TypeError/RangeError (see COLOR FUNCTIONS /
    // LIST BUILDERS above) — pass those through as-is rather than
    // re-truncating or rewording an already-clear message.
    if (/expected a .+ for argument \d+, got/i.test(msg) || /expected a non-negative count/i.test(msg)) {
      return msg;
    }
    if (m.includes('cannot read') || m.includes('is not a function')) {
      return 'Invalid function call';
    }
    if (m.includes('division by zero') || m.includes('divide by zero')) {
      return 'Division by zero';
    }
    // Truncate long messages
    return msg.length > 80 ? msg.slice(0, 80) + '...' : msg;
  }

  // ══════════════════════════════════════════════════════
  // SERIALIZATION — save/restore user state
  // ══════════════════════════════════════════════════════

  function serialize() {
    const fns = {};
    // We can't easily serialize functions, store their source if available
    const consts = listConstants();
    return { constants: consts };
  }

  function deserialize(data) {
    if (!data) return;
    if (data.constants) {
      Object.entries(data.constants).forEach(([k, v]) => defineConstant(k, v));
    }
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    // Core
    compile,
    evaluate,
    evalExpr,
    validate,
    buildScope,

    // User definitions
    defineFunction,
    removeFunction,
    listFunctions,
    defineConstant,
    removeConstant,
    listConstants,

    // Cache
    clearCache,
    getCacheSize,

    // Numerical methods — calculus
    partialDerivative,
    partialX,
    partialY,
    gradient,
    gradient2D,
    derivative1D,
    integrate,
    findZeroCrossings,

    // Numerical methods — vector calculus / linear algebra
    jacobian,
    hessian,
    divergence,
    curl,
    curl2D,
    curl3D,

    // Complex numbers
    isComplexNum,
    makeComplex,
    real,
    imag,
    magnitude,
    argument,
    conjugate,
    complexOps,
    evalComplex,
    formatComplex,
    formatNumber,

    // Variable detection
    detectSliderVars,
    detectAllVars,

    // Equation classification & 2D line parsing
    EQUATION_TYPES,
    classifyEquation,
    parseEquation,
    parseLine2D,

    // Domain restrictions — Desmos-style {condition} syntax
    parseDomainRestriction,
    compileCondition,

    // Symbolic steps — for tutor-mode grounding
    getSimplifiedForm,
    getDerivativeSteps,
    getIntegralSteps,

    // Color functions — also usable directly from JS, not just inside
    // compiled expressions (they're registered in BUILTINS too)
    rgb: fnRgb,
    hsv: fnHsv,
    okhsv: fnOkhsv,
    oklab: fnOklab,
    oklch: fnOklch,
    rgbToOklab, // inverse, exposed for callers that need it (e.g. a color picker)

    // List builders
    repeat: fnRepeat,

    // GLSL-style utilities
    smoothstep: fnSmoothstep, clamp: fnClamp, fract: fnFract,
    mix: fnMix, lerp: fnMix, step: fnStep,
    remap: fnRemap, ping: fnPing,
    noise2: fnNoise2, noise3: fnNoise3,

    // Trig reciprocals & inverses
    sec: fnSec, csc: fnCsc, cot: fnCot,
    asec: fnAsec, acsc: fnAcsc, acot: fnAcot,

    // Signal / waveform
    heaviside: fnHeaviside, sawtooth: fnSawtooth,
    square: fnSquare, sinc: fnSinc,

    // Higher math
    erf: fnErf, erfc: fnErfc,
    gamma: fnGamma, logGamma: fnLogGamma, beta: fnBeta,

    // Regression
    linearRegression,
    polynomialRegression,

    // Self-referential variable detection
    hasFreeVariable,

    // Equation-string preprocessing helpers for mod-equations.js —
    // shared here rather than duplicated, since both explicit and
    // implicit input handling need the same treatment
    countEquals,
    stripAssignmentPrefix,
    stripTrailingZero,

    // Utilities
    prettify,
    toLatex,
    isConstant,
    friendlyError,

    // Serialization
    serialize,
    deserialize,
  };

})();

// Node/CommonJS export — no-op in the browser (typeof module is undefined
// there), needed so core/math-engine-line-parser.test.js and any other
// Node-based regression test can actually `require('./math-engine.js')`
// as their own docstrings already document.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MathEngine;
}
