/**
 * Graph3D Pro — graph-builder.js
 * Module 03 — All Surface Builders
 * Explicit, Parametric, Implicit, Space Curve,
 * Polar, Cylindrical, Spherical, Vector Field, Point Cloud,
 * Inequality Solid Region
 * ~/graph3d-pro/core/graph-builder.js
 *
 * ── Update log ──────────────────────────────────────────
 * - REVERTED: build() and buildImplicit()/buildInequalitySolid() were
 *   briefly made async (per implicit-surface-fix-spec.md, so buildImplicit
 *   could directly await Engine.buildIsosurfaceMesh). That broke
 *   production: the external caller of GraphBuilder.build() was never
 *   updated to await it, so scene.add() started receiving raw Promise
 *   objects for EVERY equation type (not just implicit ones), logged by
 *   three.js as "THREE.Object3D.add: object not an instance of
 *   THREE.Object3D. {}" (an unresolved Promise has no enumerable own
 *   properties, hence "{}") — this is what "graph displays too slow /
 *   sometimes doesn't display" turned out to be. build() is synchronous
 *   again; buildImplicit/buildInequalitySolid are back to: return an
 *   instant point-cloud preview, then improve themselves in the
 *   background via Engine.addMesh once the real mesh is ready — see
 *   "SCALAR FIELD ASYNC UPGRADE". The good part of that spec's approach
 *   (using Engine.buildIsosurfaceMesh directly for the verified fast
 *   path, relying on ITS built-in cache instead of duplicating one) is
 *   kept — only the "make build() itself async" part was reverted.
 * - buildExplicit(): uses Engine.buildAdaptiveSurfaceMesh() (curvature-
 *   driven subdivision) instead of a fixed uniform grid.
 * - Engine.onResolutionChange() is wired up: changing cfg.resolution
 *   regenerates every surface this module has ever built (see
 *   lastBuildByEquationId / regenerateAllVisibleSurfaces below) — this file
 *   has no other source of truth for "which equations are on screen", since
 *   that list lives outside graph-builder.js.
 * - Engine.buildIsosurfaceMesh()/buildAdaptiveSurfaceMesh() both hand back a
 *   vertexColors:true material with NO color attribute ever attached
 *   (colors:null in both of their internal cache-data objects) and neither
 *   sets mesh.userData. Both are patched on this side after the mesh
 *   returns (colorsFromHeight + explicit userData assignment) rather than
 *   changing engine.js's public API, per the "don't modify engine.js" rule.
 * - Coordinate-based color maps (PDF 3.2.1 — Desmos comparison: their
 *   newest 3D feature, added late 2025, and currently surfaces-only in
 *   their own product): eq.colorExpr, if it references x/y/z, is now
 *   evaluated per-vertex on every surface builder (see
 *   resolveVertexColors), and — going further than Desmos's own current
 *   scope — on buildPointCloud and buildSpaceCurve too. Tolerant of
 *   several possible return shapes from math-engine.js's forthcoming
 *   rgb()/hsv()/okhsv()/oklab()/oklch() (PDF 3.3.1 — not confirmed
 *   shipped as of this pass) since that contract isn't finalized yet.
 * - buildCylindrical()/buildSpherical() (PDF 3.2.2, cylindrical/spherical
 *   as first-class surface types) already existed as complete,
 *   dispatchable builders before this pass — verified, not rebuilt; they
 *   now also participate in the coordinate-based color map above.
 * - buildInequalitySolid() (PDF 3.2.3, new): inequality-defined solid
 *   regions (e.g. "x^2+y^2+z^2 < 4"), reusing the exact same isosurface
 *   pipeline as buildImplicit — see "SCALAR FIELD ASYNC UPGRADE", which
 *   both now share.
 * ══════════════════════════════════════════════════════
 */

const GraphBuilder = (() => {

  // ── Coordinate system note ─────────────────────────────
  // Three.js Y is up. Our math uses Z as up.
  // Mapping: math(x,y,z) → Three.js(x, z, y)
  // So all builders push positions as (x, z, y)

  // ══════════════════════════════════════════════════════
  // MAIN DISPATCH
  // ══════════════════════════════════════════════════════

  // Remembers the most recent (eq, sliders) build() was called with, per
  // equation id. This is graph-builder.js's own bookkeeping — nothing
  // outside this file hands it a list of "currently visible equations",
  // so this is how regenerateAllVisibleSurfaces() (below, wired to
  // Engine.onResolutionChange) knows what to rebuild. It's a bounded,
  // address-book-style map (one entry per distinct equation id ever
  // built), not a per-frame growth — see forgetEquation() in the public
  // API for opt-in cleanup if the caller wants to prune deleted equations.
  const lastBuildByEquationId = new Map();

  // build() is SYNCHRONOUS on purpose — do not make this async again
  // without also confirming (not assuming) that every external caller
  // awaits it. It briefly was async (so buildImplicit could directly
  // await Engine.buildIsosurfaceMesh) but that broke production: the
  // caller outside this file was never updated to await build()'s
  // result, so scene.add() started receiving raw Promise objects for
  // EVERY equation type — not just implicit ones — which three.js logs
  // as "THREE.Object3D.add: object not an instance of THREE.Object3D. {}"
  // (an unresolved Promise has no enumerable own properties, so it
  // serializes as "{}"), and silently never adds the mesh. That's what
  // "graph displays too slow / sometimes doesn't display" turned out to
  // be. buildImplicit/buildInequalitySolid are back to: return an instant
  // synchronous preview, then improve themselves in the background via
  // Engine.addMesh once the real mesh is ready — see "SCALAR FIELD ASYNC
  // UPGRADE" below.
  function build(eq, sliders = {}) {
    if (!eq || !eq.expr || !eq.expr.trim()) return null;
    if (eq.id) lastBuildByEquationId.set(eq.id, { eq, sliders });

    const builders = {
      explicit:    buildExplicit,
      parametric:  buildParametric,
      implicit:    buildImplicit,
      curve:       buildSpaceCurve,
      polarCurve:  buildPolarCurve2D,
      polar:       buildPolar,
      cylindrical: buildCylindrical,
      spherical:   buildSpherical,
      vector:      buildVectorField,
      points:      buildPointCloud,
    };
    // Inequality solid regions (PDF 3.2.3): registered under a few likely
    // spellings since this file can't see mod-equations.js/the UI and
    // doesn't know which single key it'll assign — same defensive
    // approach used for other cross-file-boundary type names.
    ['inequality', 'solid', 'region'].forEach(k => { builders[k] = buildInequalitySolid; });

    const fn = builders[eq.type] || buildExplicit;

    try {
      return fn(eq, sliders);
    } catch (e) {
      throw new Error(e.message);
    }
  }

  // ══════════════════════════════════════════════════════
  // RESOLUTION-CHANGE REGENERATION
  // Engine.onResolutionChange existed with no consumer calling it. Wired
  // up here so an FPS-driven (or manual) cfg.resolution change actually
  // regenerates every surface, not just ones rebuilt for some other
  // reason afterward.
  // ══════════════════════════════════════════════════════
  function regenerateAllVisibleSurfaces(newResolution) {
    lastBuildByEquationId.forEach(({ eq, sliders }, id) => {
      try {
        const mesh = build(eq, sliders); // re-reads cfg.resolution via getCfg() inside each builder
        if (mesh) Engine.addMesh(id, mesh);
      } catch (e) {
        console.error('[Graph3D Pro] failed to regenerate surface on resolution change:', id, e.message);
      }
    });
  }
  Engine.onResolutionChange(regenerateAllVisibleSurfaces);

  function forgetEquation(id) {
    lastBuildByEquationId.delete(id);
    scalarFieldGeneration.delete(id);
    scalarFieldGeneration.delete('solid:' + id);
  }

  // ══════════════════════════════════════════════════════
  // SHARED HELPERS
  // ══════════════════════════════════════════════════════

  function getCfg() {
    return Engine.getConfig();
  }

  /**
   * Build vertex color array from height (z value) gradient
   * baseColor: hex string like '#3b82f6'
   * t: normalized 0..1 height
   */
  function heightColor(base, t) {
    const c = new THREE.Color(base);
    const hsl = {};
    c.getHSL(hsl);
    const out = new THREE.Color();
    out.setHSL(
      (hsl.h + t * 0.16) % 1,
      0.80,
      0.26 + t * 0.44
    );
    return out;
  }

  function paramColor(base, t) {
    const c = new THREE.Color(base);
    const hsl = {};
    c.getHSL(hsl);
    const out = new THREE.Color();
    out.setHSL((hsl.h + t * 0.28) % 1, 0.75, 0.38);
    return out;
  }

  function clampZ(z, zMin, zMax) {
    if (!isFinite(z)) return NaN;
    if (z < zMin || z > zMax) return NaN;
    return z;
  }

  /**
   * Build a THREE.BufferGeometry from position + color arrays + index
   * and compute smooth normals.
   * precomputedNormals (optional): when supplied (e.g. Marching Cubes'
   * finite-difference gradient normals), skips computeVertexNormals() so
   * we don't overwrite better normals with a flat, topology-only guess.
   * Omitted by all pre-existing callers, so behavior for them is unchanged.
   */
  function makeGeo(positions, colors, indices, precomputedNormals) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    if (indices && indices.length) geo.setIndex(indices);
    if (precomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(precomputedNormals, 3));
    } else {
      geo.computeVertexNormals();
    }
    return geo;
  }

  /**
   * Height-based vertex coloring for meshes that arrive from engine.js
   * with no color attribute (buildIsosurfaceMesh / buildAdaptiveSurfaceMesh
   * both always set colors:null internally — see header note). Mirrors
   * this file's existing heightColor() gradient so these surfaces match
   * every hand-built one visually. Assumes position[i*3+1] carries height
   * (Three.js Y), matching this file's math(x,y,z)->Three.js(x,z,y) convention.
   */
  function colorsFromHeight(positionsArrayLike, baseColor) {
    const count = positionsArrayLike.length / 3;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < count; i++) {
      const h = positionsArrayLike[i * 3 + 1];
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
    const range = (hi - lo) || 1;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (positionsArrayLike[i * 3 + 1] - lo) / range;
      const c = heightColor(baseColor, t);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return colors;
  }

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }

  /**
   * Coordinate-based color maps (Desmos: added late 2025 as their newest
   * 3D feature — currently only works on surfaces in their own product,
   * not points or curves; several callers below extend it to those too).
   *
   * If eq.colorExpr (aliases: eq.colorFn, eq.colorFormula — this file
   * can't see mod-equations.js/the UI, so a few plausible field names are
   * accepted) is present AND references x, y, or z as a free variable,
   * it's compiled ONCE and evaluated PER VERTEX (not once globally) using
   * that vertex's own math-space (x,y,z), producing a real heatmap/
   * topography gradient instead of a flat or height-only tint. If it's
   * absent, or present but doesn't actually reference x/y/z (a constant
   * expression), every existing builder's coloring is 100% unchanged —
   * this function just hands back defaultColors as-is.
   *
   * Contract for math-engine.js's forthcoming rgb()/hsv()/okhsv()/oklab()/
   * oklch() (PDF 3.3.1 — not confirmed shipped as of this pass, so this
   * tolerates several plausible return shapes rather than assuming one):
   *   {r,g,b} object   -> used directly (each clamped to 0..1)
   *   {h,s,l} object   -> converted via THREE.Color's own HSL support
   *   [r,g,b] array    -> used directly
   *   plain number     -> treated as a SCALAR, normalized across every
   *                       vertex and mapped through the existing
   *                       heightColor() gradient — this generalizes
   *                       today's height-only gradient to an ARBITRARY
   *                       per-vertex scalar (e.g. colorExpr:"sqrt(x^2+y^2)"
   *                       for a radial gradient), and works today even
   *                       before math-engine.js ships real color functions
   *   anything else / throw -> that one vertex falls back to
   *                       defaultColors so a single bad vertex can't take
   *                       down the whole surface's coloring
   *
   * positionsArrayLike is expected in this file's Three.js(x, z, y) order
   * (i.e. index*3+1 is "height" = math z); it's un-swapped back to math
   * (x,y,z) here before evaluating, so colorExpr is written in the same
   * natural x/y/z terms as every other expression in this file.
   */
  function resolveVertexColors(eq, positionsArrayLike, sliders, defaultColors) {
    const colorExpr = eq.colorExpr || eq.colorFn || eq.colorFormula;
    if (!colorExpr || !colorExpr.trim() || !/\b[xyz]\b/.test(colorExpr)) return defaultColors;

    let compiled;
    try { compiled = MathEngine.compile(colorExpr); }
    catch { return defaultColors; } // bad colorExpr — don't discard the surface over its color

    const count = positionsArrayLike.length / 3;
    const raw = new Array(count);
    let lo = Infinity, hi = -Infinity;

    for (let i = 0; i < count; i++) {
      const mx = positionsArrayLike[i * 3];
      const mz = positionsArrayLike[i * 3 + 1]; // Three.js "height" -> math z
      const my = positionsArrayLike[i * 3 + 2]; // math y
      let v;
      try { v = compiled.evaluate(MathEngine.buildScope({ x: mx, y: my, z: mz, t: sliders.t || 0, ...sliders })); }
      catch { v = undefined; }
      raw[i] = v;
      if (typeof v === 'number' && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    const scalarRange = (hi - lo) || 1;

    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = raw[i];
      let c = null;

      if (v && typeof v === 'object') {
        if (typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number') {
          c = { r: clamp01(v.r), g: clamp01(v.g), b: clamp01(v.b) };
        } else if (typeof v.h === 'number' && typeof v.s === 'number' && typeof v.l === 'number') {
          const tc = new THREE.Color(); tc.setHSL(((v.h % 1) + 1) % 1, clamp01(v.s), clamp01(v.l));
          c = { r: tc.r, g: tc.g, b: tc.b };
        } else if (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(n => typeof n === 'number')) {
          c = { r: clamp01(v[0]), g: clamp01(v[1]), b: clamp01(v[2]) };
        }
      } else if (typeof v === 'number' && isFinite(v)) {
        c = heightColor(eq.color, (v - lo) / scalarRange);
      }

      if (!c) { colors[i * 3] = defaultColors[i * 3]; colors[i * 3 + 1] = defaultColors[i * 3 + 1]; colors[i * 3 + 2] = defaultColors[i * 3 + 2]; continue; }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return colors;
  }

  function makeMesh(geo, eq, materialOverrides) {
    const cfg = getCfg();
    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: cfg.wireframe,
      shininess: 85,
      specular: new THREE.Color(0x1a3060),
      transparent: cfg.transparent,
      opacity: cfg.transparent ? 0.93 : 1.0,
      ...materialOverrides,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { equationId: eq.id, type: eq.type };
    return mesh;
  }

  // ══════════════════════════════════════════════════════
  // 01 — EXPLICIT  z = f(x, y)
  // Uses Engine.buildAdaptiveSurfaceMesh() — curvature-driven subdivision —
  // instead of a fixed uniform grid, so flat regions stay cheap while
  // curvy ones get more triangles automatically.
  // ══════════════════════════════════════════════════════

  function buildExplicit(eq, sliders) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax } = cfg;

    let compiled;
    try {
      compiled = MathEngine.compile(eq.expr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    // adaptiveTessellate has no per-vertex "hole" concept (unlike the old
    // uniform-grid path, which could drop a vertex by leaving it NaN) —
    // every (x,y) in the domain gets a real triangle. So out-of-domain /
    // non-finite evaluations are clamped to 0 rather than left as NaN,
    // which would otherwise poison the whole mesh (NaN position/normal
    // breaks bounding-sphere computation and can blank the entire
    // surface, not just the undefined region). One behavior change from
    // the old builder: it can no longer punch a visual "hole" for values
    // outside cfg.zMin/zMax — see the chat summary for why.
    const fn = (x, y) => {
      let z;
      try { z = compiled.evaluate(MathEngine.buildScope({ x, y, t: sliders.t || 0, ...sliders })); }
      catch { z = NaN; }
      return (typeof z === 'number' && isFinite(z)) ? z : 0;
    };

    // Engine.buildAdaptiveSurfaceMesh's cache key includes fn.toString().
    // A plain closure's toString() is static regardless of what `sliders`
    // actually holds, which would silently serve a stale cached mesh from
    // an earlier slider value while animating. Folding eq.expr + the
    // current slider snapshot into toString() makes the cache key change
    // exactly when the rendered surface should.
    fn.toString = () => `explicit:${eq.expr}:${JSON.stringify(sliders)}`;

    const bounds = { xMin, xMax, yMin, yMax };
    // baseGrid scales with cfg.resolution (so the resolution slider still
    // visibly changes this surface) but stays well under the old flat
    // grid's N, since each base cell can itself subdivide up to
    // 2^cfg.tessMaxLevel further.
    const baseGrid = Math.max(4, Math.round(cfg.resolution / 6));

    const mesh = Engine.buildAdaptiveSurfaceMesh(fn, bounds, { baseGrid, color: eq.color });

    // buildAdaptiveSurfaceMesh always returns colors:null internally and
    // never sets userData — patch both here rather than in engine.js.
    const posAttr = mesh.geometry.getAttribute('position');
    let colorArr = colorsFromHeight(posAttr.array, eq.color);
    colorArr = resolveVertexColors(eq, posAttr.array, sliders, colorArr); // coordinate-based color map, if eq.colorExpr is set
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 3));
    mesh.userData = { equationId: eq.id, type: eq.type };
    return mesh;
  }

  // ══════════════════════════════════════════════════════
  // 02 — PARAMETRIC  x(u,v), y(u,v), z(u,v)
  // ══════════════════════════════════════════════════════

  function buildParametric(eq, sliders) {
    const cfg = getCfg();
    const parts = eq.expr.split(',');
    if (parts.length < 3) throw new Error('Parametric needs 3 expressions: x(u,v), y(u,v), z(u,v)');

    let cX, cY, cZ;
    try {
      cX = MathEngine.compile(parts[0].trim());
      cY = MathEngine.compile(parts[1].trim());
      cZ = MathEngine.compile(parts[2].trim());
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const uMin = eq.uMin ?? 0;
    const uMax = eq.uMax ?? (Math.PI * 2);
    const vMin = eq.vMin ?? 0;
    const vMax = eq.vMax ?? Math.PI;
    const N = Math.round(cfg.resolution * 0.75);

    const positions = [];
    const colors    = [];
    const indices   = [];
    const base = new THREE.Color(eq.color);

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const u = uMin + (uMax - uMin) * i / N;
        const v = vMin + (vMax - vMin) * j / N;
        const scope = MathEngine.buildScope({ u, v, t: sliders.t || 0, ...sliders });

        let px = 0, py = 0, pz = 0;
        try {
          px = cX.evaluate({ ...scope }) || 0;
          py = cY.evaluate({ ...scope }) || 0;
          pz = cZ.evaluate({ ...scope }) || 0;
        } catch {}

        if (!isFinite(px)) px = 0;
        if (!isFinite(py)) py = 0;
        if (!isFinite(pz)) pz = 0;

        // math(px, py, pz) → Three.js(px, pz, py)
        positions.push(px, pz, py);

        const c = paramColor(eq.color, i / N);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j;
        const b = a + 1;
        const c = a + (N + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const finalColors = resolveVertexColors(eq, positions, sliders, colors); // coordinate-based color map, if eq.colorExpr is set
    return makeMesh(makeGeo(positions, finalColors, indices), eq);
  }

  // ══════════════════════════════════════════════════════
  // 03 — IMPLICIT  f(x,y,z) = 0
  //
  // Returns an instant, coarse point-cloud PREVIEW synchronously (build()
  // must stay synchronous), then kicks off a real Marching Cubes mesh in
  // the background via engine.js and swaps it in via Engine.addMesh()
  // once ready — see "SCALAR FIELD ASYNC UPGRADE" below (shared with
  // buildInequalitySolid, which reuses this same isosurface machinery
  // fed a sign-adjusted field instead of eq.expr directly).
  // ══════════════════════════════════════════════════════

  function buildImplicit(eq, sliders) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax } = cfg;
    const zSampleMin = -6, zSampleMax = 6;
    const mathBounds = { xMin, xMax, yMin, yMax, zSampleMin, zSampleMax };

    const preview = buildScalarFieldPreview(eq, sliders, eq.expr, mathBounds);

    if (eq.id) {
      scheduleScalarFieldUpgrade(eq, sliders, bumpFieldGeneration(eq.id), mathBounds, {
        fieldExpr: eq.expr,
        cacheKeyPrefix: 'isosurface',
        generationKey: eq.id,
      });
    }

    return preview;
  }

  // ══════════════════════════════════════════════════════
  // 11 — INEQUALITY SOLID REGION   e.g.  x^2 + y^2 + z^2 < 4
  //
  // Desmos supports inequalities as native 3D input, rendered as a filled
  // solid region. There's no volumetric/ray-marched renderer anywhere in
  // this stack (that's a materially different, much bigger rendering
  // technique — a per-pixel-shaded signed-distance-field raymarch — not
  // something to invent unasked inside a triangle-mesh pipeline), so this
  // takes the standard, correct approach every polygon-mesh 3D grapher
  // uses: extract the inequality's BOUNDARY as an isosurface (identical
  // math to buildImplicit above) and render it as a closed, front-face-
  // only shell, which is what reads visually as "solid" rather than
  // "open surface". See inequalityFieldExpr for the sign convention that
  // keeps this correct for both "<" and ">" without extra winding logic.
  // ══════════════════════════════════════════════════════

  const INEQUALITY_OPERATORS = ['<=', '>=', '<', '>']; // 2-char forms checked first

  function parseInequality(expr) {
    for (const op of INEQUALITY_OPERATORS) {
      const idx = expr.indexOf(op);
      if (idx === -1) continue;
      const lhs = expr.slice(0, idx).trim();
      const rhs = expr.slice(idx + op.length).trim();
      if (!lhs || !rhs) continue;
      return { lhs, rhs, op };
    }
    return null;
  }

  /**
   * Marching Cubes' gradient-based normals point from the low-field side
   * toward the high-field side. Negating the field for ">"/">=" means the
   * solid interior is ALWAYS the low-field side regardless of the
   * original operator's direction, so this can reuse the implicit-surface
   * pipeline's outward-normal convention completely unchanged — no
   * separate triangle-winding flip needed for the ">" case.
   */
  function inequalityFieldExpr(lhs, rhs, op) {
    const diff = `(${lhs}) - (${rhs})`;
    return (op === '>' || op === '>=') ? `-(${diff})` : diff;
  }

  function buildInequalitySolid(eq, sliders) {
    const parsed = parseInequality(eq.expr);
    if (!parsed) throw new Error('Solid region needs an inequality like "x^2 + y^2 + z^2 < 4"');
    const fieldExpr = inequalityFieldExpr(parsed.lhs, parsed.rhs, parsed.op);

    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax } = cfg;
    const zSampleMin = -6, zSampleMax = 6;
    const mathBounds = { xMin, xMax, yMin, yMax, zSampleMin, zSampleMax };

    const preview = buildScalarFieldPreview(eq, sliders, fieldExpr, mathBounds);

    if (eq.id) {
      scheduleScalarFieldUpgrade(eq, sliders, bumpFieldGeneration('solid:' + eq.id), mathBounds, {
        fieldExpr,
        cacheKeyPrefix: 'solid',
        generationKey: 'solid:' + eq.id,
        // A correctly-oriented closed boundary only needs front faces —
        // this (not a distinct "fill" mode, which nothing here provides)
        // is what visually reads as solid rather than a hollow shell.
        materialOverrides: { side: THREE.FrontSide },
      });
    }

    return preview;
  }

  // ══════════════════════════════════════════════════════
  // SCALAR FIELD ASYNC UPGRADE — real Marching Cubes via engine.js
  // Shared by buildImplicit (f(x,y,z)=0) and buildInequalitySolid
  // (a sign-adjusted field derived from an inequality) — both are the
  // same isosurface-extraction problem, differing only in which
  // expression is fed in and how the resulting mesh is materialed.
  //
  // engine.js's marchingCubesAsync()/buildIsosurfaceMesh() need the field
  // as JS SOURCE TEXT (new Function('x','y','z', fieldSrc)) so it can be
  // posted into a Worker — a MathEngine-compiled expression can't be
  // structured-cloned into a Worker, so this file can't just hand over
  // `compiled.evaluate`.
  //
  // A prior pass considered loading mathjs inside the worker itself
  // (`importScripts(...)` + `fieldSrc = "return math.evaluate(...)"`) for
  // guaranteed-identical semantics. That's not done here: it requires
  // adding that importScripts line inside engine.js's buildComputeWorker()
  // — confirmed by reading the actual function, which has no such loading
  // and no hook for graph-builder.js to inject one from outside — and
  // editing engine.js is out of scope for this file. It's also not
  // confirmed that MathEngine is backed by mathjs specifically (this file
  // has no visibility into math-engine.js's implementation), so assuming
  // that contract without being able to verify it risks silently wrong
  // surfaces for any syntax that differs between the two. Instead:
  //   1. Attempts a conservative text conversion (tryBuildJsFieldSrc).
  //   2. Verifies it against the TRUSTED MathEngine evaluator at random
  //      sample points (verifyFieldSrc) before ever using it.
  //   3. Only if that verification passes does it use the fast worker
  //      path (Engine.buildIsosurfaceMesh, which already caches by
  //      fieldSrc+bounds+resolution+isoLevel — a repeat render of an
  //      unchanged surface is a cache hit, no re-sampling). Otherwise it
  //      falls back to Engine.marchingCubesChunked() with a real closure
  //      over compiled.evaluate — still async/non-blocking
  //      (requestIdleCallback chunked), just not worker-parallel, cached
  //      here manually since that path bypasses buildIsosurfaceMesh.
  // Equations using this app's {condition} domain-restriction syntax are
  // routed straight to the fallback, since that syntax isn't something
  // this narrow text conversion attempts to handle.
  //
  // buildImplicit/buildInequalitySolid return an instant synchronous
  // preview and improve themselves in the BACKGROUND via Engine.addMesh
  // once the real mesh is ready (build() itself must stay synchronous —
  // see the comment on build() above for why this isn't "await it
  // directly" anymore). A generation counter per equation id/purpose
  // guards against a slow, superseded result (from a resolution change,
  // slider drag, or equation edit that happened while the old one was
  // still computing) clobbering a newer, more current preview or mesh.
  // ══════════════════════════════════════════════════════

  // generationKey ('eq.id' for implicit, 'solid:'+eq.id for inequality
  // solids) -> integer, bumped on every buildImplicit()/buildInequality-
  // Solid() call. Lets a slow async result that resolves after a NEWER
  // rebuild detect it's stale and drop itself instead of clobbering the
  // scene with an outdated mesh.
  const scalarFieldGeneration = new Map();

  function bumpFieldGeneration(key) {
    const g = (scalarFieldGeneration.get(key) || 0) + 1;
    scalarFieldGeneration.set(key, g);
    return g;
  }

  // Bare math names a graphing-calculator expression is likely to use but
  // which don't exist in a bare `new Function` scope.
  const JS_FIELD_PRELUDE =
    'const {sin,cos,tan,asin,acos,atan,atan2,sqrt,abs,pow,exp,log,log2,log10,' +
    'floor,ceil,round,sign,min,max,hypot,cbrt,sinh,cosh,tanh} = Math; ' +
    'const pi = Math.PI, e = Math.E; ';

  function sliderConstantsSrc(sliders) {
    return Object.keys(sliders || {})
      .filter(k => typeof sliders[k] === 'number' && isFinite(sliders[k]) && /^[A-Za-z_]\w*$/.test(k))
      .map(k => `const ${k} = ${sliders[k]};`)
      .join(' ');
  }

  /**
   * Best-effort MathEngine-expression -> JS-source-text conversion.
   * Returns null (meaning: don't attempt the fast path) for anything this
   * narrow conversion isn't confident about, rather than guessing.
   * Slider values are baked in as literal numeric constants (there's no
   * separate scope channel across the Worker boundary — the postMessage
   * payload is just fieldSrc+bounds+resolution+isoLevel) — this also
   * means the fieldSrc text itself changes whenever a referenced slider
   * changes, so Engine's own fieldSrc-keyed cache naturally busts on
   * slider movement instead of serving a stale surface.
   */
  function tryBuildJsFieldSrc(expr, sliders) {
    if (!expr || /[{}]/.test(expr)) return null; // domain-restriction syntax etc. — use the verified fallback
    const body = expr.replace(/\^/g, '**'); // this app's power operator vs. JS's bitwise XOR
    return JS_FIELD_PRELUDE + sliderConstantsSrc(sliders) + ' return (' + body + ');';
  }

  /**
   * Numerically checks a generated fieldSrc against the trusted
   * MathEngine evaluator at random sample points within the sampling
   * box. Only a pass here makes tryBuildJsFieldSrc's output trustworthy.
   */
  function verifyFieldSrc(fieldSrc, compiled, mathBounds, sliders) {
    let fn;
    try { fn = new Function('x', 'y', 'z', fieldSrc); }
    catch { return false; }

    const trials = 24;
    for (let i = 0; i < trials; i++) {
      const x = mathBounds.xMin + Math.random() * (mathBounds.xMax - mathBounds.xMin);
      const y = mathBounds.yMin + Math.random() * (mathBounds.yMax - mathBounds.yMin);
      const z = mathBounds.zSampleMin + Math.random() * (mathBounds.zSampleMax - mathBounds.zSampleMin);

      let jsVal, meVal;
      try { jsVal = fn(x, y, z); } catch { jsVal = NaN; }
      try { meVal = compiled.evaluate(MathEngine.buildScope({ x, y, z, t: sliders.t || 0, ...sliders })); }
      catch { meVal = NaN; }

      const jsOk = typeof jsVal === 'number' && isFinite(jsVal);
      const meOk = typeof meVal === 'number' && isFinite(meVal);
      if (jsOk !== meOk) return false; // disagree on whether the field is even defined here
      if (jsOk && meOk) {
        const scale = Math.max(1, Math.abs(meVal));
        if (Math.abs(jsVal - meVal) > 1e-6 * scale + 1e-6) return false;
      }
    }
    return true;
  }

  // Re-labels bounds so engine.js's own (x,y,z) sampling order comes out
  // pre-swapped into this file's math(x,y,z)->Three.js(x,z,y) convention —
  // avoids a separate post-pass over every vertex to swap Y/Z afterward.
  function swapYZBounds(mathBounds) {
    return {
      xMin: mathBounds.xMin, xMax: mathBounds.xMax,
      yMin: mathBounds.zSampleMin, yMax: mathBounds.zSampleMax, // engine's Y carries math Z
      zMin: mathBounds.yMin, zMax: mathBounds.yMax,              // engine's Z carries math Y
    };
  }

  // Wraps an already-verified fieldSrc (written in terms of natural math
  // x,y,z) so it un-swaps engine.js's relabeled (x,y,z) call args back to
  // math order before evaluating the trusted body.
  function wrapFieldSrcForSwappedBounds(fieldSrc) {
    return `
      var __mx = x, __my = z, __mz = y; // un-swap engine(x,y,z) -> math(x,y,z)
      return (function(x, y, z) { ${fieldSrc} })(__mx, __my, __mz);
    `;
  }

  /**
   * Instant, coarse point-cloud preview of a scalar field's zero-level-
   * set. Shared by buildImplicit and buildInequalitySolid — fieldExpr is
   * whatever each of them wants rendered (buildInequalitySolid passes an
   * already sign-adjusted field, not eq.expr directly). The real surface
   * for both arrives later via scheduleScalarFieldUpgrade + Engine.addMesh.
   */
  function buildScalarFieldPreview(eq, sliders, fieldExpr, mathBounds) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax, zSampleMin, zSampleMax } = mathBounds;

    let compiled;
    try {
      compiled = MathEngine.compile(fieldExpr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    // Deliberately coarse: this is ONLY a placeholder shown for the
    // split-second before the real mesh arrives, not the final
    // representation. Threshold is nudged up slightly from a plain
    // isosurface threshold to compensate for the coarse grid, so thin
    // surfaces are still reasonably likely to show *something*.
    const N = Math.min(16, Math.round(cfg.resolution * 0.28));
    const threshold = 0.32;

    const positions = [];
    const colors    = [];
    const base = new THREE.Color(eq.color);

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        for (let k = 0; k <= N; k++) {
          const x = xMin + (xMax - xMin) * j / N;
          const y = yMin + (yMax - yMin) * i / N;
          const z = zSampleMin + (zSampleMax - zSampleMin) * k / N;

          const scope = MathEngine.buildScope({ x, y, z, t: sliders.t || 0, ...sliders });
          let val;
          try { val = compiled.evaluate(scope); }
          catch { continue; }

          if (typeof val !== 'number' || !isFinite(val)) continue;
          if (Math.abs(val) < threshold) {
            // math(x,y,z) → Three.js(x, z, y)
            positions.push(x, z, y);

            const t = (z - zSampleMin) / (zSampleMax - zSampleMin);
            const hsl = {};
            base.getHSL(hsl);
            const c = new THREE.Color();
            c.setHSL((hsl.h + t * 0.12) % 1, 0.82, 0.4 + t * 0.2);
            colors.push(c.r, c.g, c.b);
          }
        }
      }
    }

    if (positions.length === 0) {
      throw new Error('No surface found — try wider X/Y range or check equation');
    }

    const colorArr = resolveVertexColors(eq, positions, sliders, colors); // coordinate-based color map, if eq.colorExpr is set

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colorArr, 3));

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.09,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.userData = { equationId: eq.id, type: eq.type };
    return points;
  }

  /**
   * opts: { fieldExpr, cacheKeyPrefix, generationKey, materialOverrides }
   * See buildImplicit/buildInequalitySolid for how each fills these in.
   */
  function scheduleScalarFieldUpgrade(eq, sliders, myGen, mathBounds, opts) {
    const { fieldExpr, cacheKeyPrefix, generationKey, materialOverrides } = opts;
    const cfg = getCfg();
    // Grid cost is inherently O(N^3) regardless of main-thread vs. worker
    // execution, so a sanity ceiling is still worth keeping — this is the
    // same ceiling flagged in the resolution audit for a future tuning pass.
    const resolution = Math.min(96, Math.max(24, cfg.resolution));
    const isoLevel = 0;

    let compiled;
    try { compiled = MathEngine.compile(fieldExpr); } catch { return; } // preview's own compile already surfaced this error

    const finish = (positions, normals) => {
      if (scalarFieldGeneration.get(generationKey) !== myGen) return; // superseded — drop silently
      if (!positions || positions.length === 0) return;                // nothing found; leave the preview in place
      const heightColors = colorsFromHeight(positions, eq.color);
      const colorArr = resolveVertexColors(eq, positions, sliders, heightColors); // coordinate-based color map, if eq.colorExpr is set
      const geo = makeGeo(positions, colorArr, null, normals);
      const mesh = makeMesh(geo, eq, materialOverrides);
      Engine.addMesh(eq.id, mesh);
    };

    const attempt = tryBuildJsFieldSrc(fieldExpr, sliders);
    const verified = attempt && verifyFieldSrc(attempt, compiled, mathBounds, sliders);

    if (verified) {
      // Engine.buildIsosurfaceMesh already caches internally by
      // fieldSrc+bounds+resolution+isoLevel — no need to duplicate that
      // bookkeeping here. Its returned mesh/material are discarded in
      // favor of this file's own makeGeo/makeMesh above, purely to keep
      // material behavior (wireframe/transparency via cfg.wireframe)
      // identical between this path and the fallback path below — the
      // cache benefit is unaffected, since Engine's cache stores geometry
      // data, not the material object.
      const engineFieldSrc = wrapFieldSrcForSwappedBounds(attempt);
      const engineBounds = swapYZBounds(mathBounds);
      Engine.buildIsosurfaceMesh(engineFieldSrc, engineBounds, resolution, { isoLevel, color: eq.color })
        .then(engineMesh => {
          const posAttr = engineMesh.geometry.getAttribute('position');
          const normAttr = engineMesh.geometry.getAttribute('normal');
          finish(posAttr.array, normAttr ? normAttr.array : undefined);
        })
        .catch(err => console.warn(`[Graph3D Pro] ${cacheKeyPrefix} (worker path) failed, preview left in place:`, err.message));
    } else {
      // Couldn't safely translate this expression to JS source text (or
      // it didn't match MathEngine closely enough to trust) — fall back
      // to the known-correct MathEngine evaluator via a real closure.
      // Bypasses buildIsosurfaceMesh's built-in cache (keyed on fieldSrc
      // text, which this path doesn't have), so it's cached manually here.
      const fieldFn = (mx, my, mz) => {
        try {
          const v = compiled.evaluate(MathEngine.buildScope({ x: mx, y: my, z: mz, t: sliders.t || 0, ...sliders }));
          return (typeof v === 'number' && isFinite(v)) ? v : NaN;
        } catch { return NaN; }
      };
      const engineBounds = swapYZBounds(mathBounds);
      const wrappedFieldFn = (ex, ey, ez) => fieldFn(ex, ez, ey); // un-swap back to math order
      const cacheKey = Engine.makeCacheKey([cacheKeyPrefix + '-fallback', fieldExpr, JSON.stringify(sliders), engineBounds.xMin, engineBounds.xMax, engineBounds.yMin, engineBounds.yMax, engineBounds.zMin, engineBounds.zMax, resolution, isoLevel]);
      const cached = Engine.cacheGetMesh(cacheKey);
      if (cached) {
        finish(cached.positions, cached.normals);
        return;
      }
      Engine.marchingCubesChunked(wrappedFieldFn, engineBounds, resolution, isoLevel)
        .then(result => {
          Engine.cacheSetMesh(cacheKey, { positions: result.positions, normals: result.normals, colors: null, indices: null });
          finish(result.positions, result.normals);
        })
        .catch(err => console.warn(`[Graph3D Pro] ${cacheKeyPrefix} (chunked fallback) failed, preview left in place:`, err.message));
    }
  }

  // ══════════════════════════════════════════════════════
  // 04 — SPACE CURVE  x(t), y(t), z(t)
  // ══════════════════════════════════════════════════════

  function buildSpaceCurve(eq, sliders) {
    const parts = eq.expr.split(',');
    if (parts.length < 3) throw new Error('Space curve needs 3 expressions: x(t), y(t), z(t)');

    let cX, cY, cZ;
    try {
      cX = MathEngine.compile(parts[0].trim());
      cY = MathEngine.compile(parts[1].trim());
      cZ = MathEngine.compile(parts[2].trim());
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const tMin = eq.tMin ?? (-Math.PI * 3);
    const tMax = eq.tMax ?? (Math.PI * 3);
    const N = 600;

    const points  = [];
    const colors  = [];
    const base = new THREE.Color(eq.color);

    for (let i = 0; i <= N; i++) {
      const t = tMin + (tMax - tMin) * i / N;
      const scope = MathEngine.buildScope({ t, ...sliders });

      let px = 0, py = 0, pz = 0;
      try {
        px = cX.evaluate({ ...scope }) || 0;
        py = cY.evaluate({ ...scope }) || 0;
        pz = cZ.evaluate({ ...scope }) || 0;
      } catch {}

      if (!isFinite(px)) px = 0;
      if (!isFinite(py)) py = 0;
      if (!isFinite(pz)) pz = 0;

      // math(px, py, pz) → Three.js(px, pz, py)
      points.push(new THREE.Vector3(px, pz, py));

      const c = new THREE.Color();
      const hsl = {};
      base.getHSL(hsl);
      c.setHSL((hsl.h + (i / N) * 0.32) % 1, 0.85, 0.55);
      colors.push(c.r, c.g, c.b);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    // resolveVertexColors expects a flat [x,y,z,x,y,z,...] array (this
    // file's Three.js-order convention); points here is Vector3 objects,
    // so flatten once for the lookup. Stretch goal from PDF 3.2.1: Desmos
    // itself doesn't support coordinate-based color maps on curves yet.
    const flatPositions = [];
    points.forEach(p => flatPositions.push(p.x, p.y, p.z));
    const finalColors = resolveVertexColors(eq, flatPositions, sliders, colors);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(finalColors, 3));

    const mat = new THREE.LineBasicMaterial({ vertexColors: true });
    const line = new THREE.Line(geo, mat);
    line.userData = { equationId: eq.id, type: eq.type };
    return line;
  }

  // ══════════════════════════════════════════════════════
  // 04b — POLAR CURVE (2D)   r = f(theta)
  //
  // A genuine 2D polar curve — cardioids, roses, spirals, limaçons —
  // as distinct from the EXISTING "polar" type above (05), which is a
  // completely different mathematical object: a 3D height SURFACE
  // z = f(r, theta) sampled over a disc, where r is an independent grid
  // coordinate. Here, r is the DEPENDENT value r(theta), and the curve
  // is traced flat in the math z=0 plane (Three.js Y=0, matching the
  // "math(px,py,pz) -> Three.js(px,pz,py)" convention used throughout
  // this file) via the standard x=r*cos(theta), y=r*sin(theta).
  // ══════════════════════════════════════════════════════

  /**
   * Evaluate r(theta) via a plain numeric callback, returning a point
   * {theta, r, x, y} or null if r is undefined/non-finite there (NaN,
   * ±Infinity, or a complex result — none of which have a meaningful
   * position on a 2D polar curve). No Math.abs() on r: a negative r is
   * plugged straight into cos/sin, which is exactly what correctly
   * reflects the point through the origin per the standard convention
   * (same reasoning as the buildSpherical signed-r fix elsewhere in
   * this file).
   */
  function _evalPolarPoint(rFn, theta) {
    let r;
    try { r = rFn(theta); } catch { r = NaN; }
    if (typeof r !== 'number' || !isFinite(r)) return null;
    return { theta, r, x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }

  /** Perpendicular distance from point P to line segment A-B. */
  function _pointSegDist(P, A, B) {
    const abx = B.x - A.x, aby = B.y - A.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-12) return Math.hypot(P.x - A.x, P.y - A.y);
    const cross = Math.abs((P.x - A.x) * aby - (P.y - A.y) * abx);
    return cross / Math.sqrt(len2);
  }

  /**
   * Adaptive curvature-based sampler for a 2D polar curve r=f(theta).
   * Pure function — no THREE.js/DOM/MathEngine dependency, so it can be
   * (and is, in test/) unit-tested directly in Node.
   *
   * Strategy: sample a coarse uniform base grid first (also used to
   * establish a scale estimate, so the flatness tolerance is relative
   * to the curve's own size rather than an arbitrary absolute number).
   * Then recursively bisect each base segment while the midpoint's
   * perpendicular deviation from the straight chord exceeds tolerance —
   * this naturally puts MORE samples on sharp turns (rose-curve petal
   * tips, cardioid cusps) and FEWER on flat/slowly-curving stretches,
   * exactly the "increase where curvature is high, reduce where low"
   * requirement, without any per-shape special-casing.
   *
   * Undefined regions (NaN/Infinity/complex r — e.g. sqrt(theta) for
   * theta<0, or a {condition} domain restriction) split the output into
   * separate disconnected "runs" rather than papering over the gap by
   * snapping to some fallback value, which would draw a mathematically
   * false connecting line.
   *
   * Returns an array of runs; each run is an array of {theta,r,x,y}
   * points forming one continuous polyline.
   */
  function adaptivePolarSample(rFn, thetaMin, thetaMax, opts = {}) {
    const baseSteps   = opts.baseSteps   ?? 160;
    const maxDepth     = opts.maxDepth    ?? 8;
    const flatTolFrac  = opts.flatTolFrac ?? 0.001; // fraction of curve scale
    const pointBudget  = opts.pointBudget ?? 15000; // hard safety cap

    if (!isFinite(thetaMin) || !isFinite(thetaMax) || thetaMax <= thetaMin) return [];

    const basePts = [];
    let scale = 0;
    for (let i = 0; i <= baseSteps; i++) {
      const theta = thetaMin + (thetaMax - thetaMin) * i / baseSteps;
      const p = _evalPolarPoint(rFn, theta);
      basePts.push(p);
      if (p) scale = Math.max(scale, Math.abs(p.x), Math.abs(p.y));
    }
    if (scale === 0) scale = 1; // degenerate all-zero curve — avoid a zero tolerance
    const flatTol = flatTolFrac * scale;

    let budgetLeft = pointBudget;

    function refine(pA, pB, thA, thB, depth, out) {
      if (budgetLeft <= 0 || depth >= maxDepth) { out.push(pB); return; }
      const thMid = (thA + thB) / 2;
      const pMid = _evalPolarPoint(rFn, thMid);
      if (!pMid) { out.push(pB); return; } // undefined right at the midpoint — don't bisect into a discontinuity forever
      const dev = _pointSegDist(pMid, pA, pB);
      if (dev > flatTol) {
        budgetLeft -= 1;
        refine(pA, pMid, thA, thMid, depth + 1, out);
        refine(pMid, pB, thMid, thB, depth + 1, out);
      } else {
        out.push(pB);
      }
    }

    const runs = [];
    let currentRun = [];
    for (let i = 0; i < basePts.length; i++) {
      const p = basePts[i];
      if (!p) {
        if (currentRun.length > 1) runs.push(currentRun);
        currentRun = [];
        continue;
      }
      if (currentRun.length === 0) {
        currentRun.push(p);
      } else {
        const thA = thetaMin + (thetaMax - thetaMin) * (i - 1) / baseSteps;
        const thB = thetaMin + (thetaMax - thetaMin) * i / baseSteps;
        refine(basePts[i - 1], p, thA, thB, 0, currentRun);
      }
    }
    if (currentRun.length > 1) runs.push(currentRun);
    return runs;
  }

  function buildPolarCurve2D(eq, sliders) {
    // Accept "r = ..." (any whitespace) or just the bare RHS — either
    // way, compile() must never see the "r=" prefix itself, since only
    // x/y/z are special-cased as valid assignment targets inside
    // normalizeImplicitEquation(); "r=..." would otherwise be
    // (mis)treated as an IMPLICIT relation "(r) - (...)" between an
    // externally-supplied r and theta, not an assignment r(theta).
    // Also accept the Unicode θ as an alias for "theta".
    let rawExpr = MathEngine.stripAssignmentPrefix(eq.expr.trim(), 'r').replace(/θ/g, 'theta');

    let compiled;
    try {
      compiled = MathEngine.compile(rawExpr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const thetaMin = eq.tMin ?? (-Math.PI * 3);
    const thetaMax = eq.tMax ?? (Math.PI * 3);

    const rFn = (theta) => {
      const scope = MathEngine.buildScope({ theta, t: theta, ...sliders });
      return compiled.evaluate(scope);
    };

    const runs = adaptivePolarSample(rFn, thetaMin, thetaMax);
    if (runs.length === 0) throw new Error('Polar curve has no visible points in this domain');

    const base = new THREE.Color(eq.color);
    // Global point count across all runs, used only to keep the color
    // gradient continuous across a gap rather than restarting per-run.
    const totalPts = runs.reduce((s, r) => s + r.length, 0) || 1;
    let seen = 0;

    function buildOneLine(run) {
      const points = run.map(p => new THREE.Vector3(p.x, 0, p.y)); // math(x,0,y) -> Three.js, flat in the ground plane
      const geo = new THREE.BufferGeometry().setFromPoints(points);

      const colors = [];
      const hsl = {};
      base.getHSL(hsl);
      run.forEach(() => {
        const c = new THREE.Color();
        c.setHSL((hsl.h + (seen / totalPts) * 0.32) % 1, 0.85, 0.55);
        colors.push(c.r, c.g, c.b);
        seen++;
      });

      const flatPositions = [];
      points.forEach(p => flatPositions.push(p.x, p.y, p.z));
      const finalColors = resolveVertexColors(eq, flatPositions, sliders, colors);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(finalColors, 3));

      const mat = new THREE.LineBasicMaterial({ vertexColors: true });
      const line = new THREE.Line(geo, mat);
      line.userData = { equationId: eq.id, type: eq.type };
      return line;
    }

    if (runs.length === 1) return buildOneLine(runs[0]);

    // Multiple disconnected runs (the curve has a gap somewhere in its
    // domain) — a Group of Lines. disposeMesh() in engine.js already
    // recurses into .children, so this is safely disposed like any
    // other multi-part mesh.
    const group = new THREE.Group();
    group.userData = { equationId: eq.id, type: eq.type };
    runs.forEach(run => group.add(buildOneLine(run)));
    return group;
  }

  // ══════════════════════════════════════════════════════
  // 05 — POLAR  z = f(r, theta)
  // ══════════════════════════════════════════════════════

  function buildPolar(eq, sliders) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax, zMin, zMax, resolution } = cfg;
    const N = resolution;

    let compiled;
    try {
      compiled = MathEngine.compile(eq.expr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const rMax = Math.min(
      Math.abs(xMin), Math.abs(xMax),
      Math.abs(yMin), Math.abs(yMax)
    );

    const positions = [];
    const colors    = [];
    const indices   = [];
    const zGrid     = [];

    let zlo = Infinity, zhi = -Infinity;

    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let j = 0; j <= N; j++) {
        const r     = rMax * i / N;
        const theta = (Math.PI * 2) * j / N;
        const scope = MathEngine.buildScope({
          r, theta,
          t: sliders.t || 0,
          ...sliders,
        });

        let z;
        try { z = compiled.evaluate(scope); }
        catch { z = NaN; }

        z = clampZ(z, zMin, zMax);
        if (!isNaN(z)) { zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
        row.push({ r, theta, z });
      }
      zGrid.push(row);
    }

    const zRange = (zhi - zlo) || 1;

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const { r, theta, z } = zGrid[i][j];
        const px = r * Math.cos(theta);
        const py = r * Math.sin(theta);
        const pz = isNaN(z) ? 0 : z;

        positions.push(px, pz, py);

        const t = isNaN(z) ? 0 : (z - zlo) / zRange;
        const c = heightColor(eq.color, t);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j;
        const b = a + 1;
        const c = a + (N + 1);
        const d = c + 1;
        const za = zGrid[i][j].z;
        const zb = zGrid[i][j + 1].z;
        const zc = zGrid[i + 1][j].z;
        const zd = zGrid[i + 1][j + 1].z;
        if (!isNaN(za) && !isNaN(zb) && !isNaN(zc)) indices.push(a, c, b);
        if (!isNaN(zb) && !isNaN(zc) && !isNaN(zd)) indices.push(b, c, d);
      }
    }

    if (indices.length === 0) throw new Error('Polar surface has no visible points');
    const finalColors = resolveVertexColors(eq, positions, sliders, colors); // coordinate-based color map, if eq.colorExpr is set
    return makeMesh(makeGeo(positions, finalColors, indices), eq);
  }

  // ══════════════════════════════════════════════════════
  // 06 — CYLINDRICAL  z = f(r, theta) mapped to (r, theta, z)
  // Same as polar but returned as cylindrical surface
  // ══════════════════════════════════════════════════════

  function buildCylindrical(eq, sliders) {
    const cfg = getCfg();
    const N = cfg.resolution;

    const parts = eq.expr.split(',');
    if (parts.length < 1) throw new Error('Cylindrical needs: r(theta, z) or z(r, theta)');

    // If single expr: z = f(r, theta)
    // If 3 exprs: x(r,theta), y(r,theta), z(r,theta)
    if (parts.length === 1) {
      // Reuse polar
      return buildPolar(eq, sliders);
    }

    // 3-component cylindrical parametric
    let cX, cY, cZ;
    try {
      cX = MathEngine.compile(parts[0].trim());
      cY = MathEngine.compile(parts[1].trim());
      cZ = MathEngine.compile(parts[2].trim());
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const positions = [];
    const colors    = [];
    const indices   = [];

    const rMin = 0, rMax = 5;
    const thetaMin = 0, thetaMax = Math.PI * 2;

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const r     = rMin + (rMax - rMin) * i / N;
        const theta = thetaMin + (thetaMax - thetaMin) * j / N;
        const scope = MathEngine.buildScope({ r, theta, t: sliders.t || 0, ...sliders });

        let px = 0, py = 0, pz = 0;
        try {
          px = cX.evaluate({ ...scope }) || 0;
          py = cY.evaluate({ ...scope }) || 0;
          pz = cZ.evaluate({ ...scope }) || 0;
        } catch {}

        positions.push(px, pz, py);
        const c = paramColor(eq.color, i / N);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j;
        const b = a + 1;
        const c = a + (N + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const finalColors = resolveVertexColors(eq, positions, sliders, colors); // coordinate-based color map, if eq.colorExpr is set
    return makeMesh(makeGeo(positions, finalColors, indices), eq);
  }

  // ══════════════════════════════════════════════════════
  // 07 — SPHERICAL  r = f(theta, phi)
  // theta: azimuthal 0..2pi, phi: polar 0..pi
  // ══════════════════════════════════════════════════════

  function buildSpherical(eq, sliders) {
    const cfg = getCfg();
    const N = cfg.resolution;

    let compiled;
    try {
      compiled = MathEngine.compile(eq.expr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const positions = [];
    const colors    = [];
    const indices   = [];

    let rlo = Infinity, rhi = -Infinity;
    const rGrid = [];

    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let j = 0; j <= N; j++) {
        const theta = (Math.PI * 2) * i / N;
        const phi   = Math.PI * j / N;
        const scope = MathEngine.buildScope({ theta, phi, t: sliders.t || 0, ...sliders });

        let r;
        try { r = compiled.evaluate(scope); }
        catch { r = NaN; }

        if (!isFinite(r)) r = NaN;
        if (!isNaN(r)) { rlo = Math.min(rlo, r); rhi = Math.max(rhi, r); }
        row.push({ theta, phi, r });
      }
      rGrid.push(row);
    }

    const rRange = (rhi - rlo) || 1;

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const { theta, phi, r } = rGrid[i][j];
        // Use the SIGNED r directly, not Math.abs(r). Plugging a negative r
        // straight into the standard spherical->Cartesian formulas naturally
        // reflects the point through the origin to the antipodal direction —
        // the same convention used for negative r in 2D polar plots. Forcing
        // Math.abs(r) instead silently folded every negative-r lobe onto the
        // wrong (positive-r) side, distorting the shape for any equation
        // that legitimately goes negative (e.g. r = cos(2*theta) type
        // spherical roses). It was also inconsistent with rlo/rhi just above,
        // which are already tracked from the signed r.
        const rv = isNaN(r) ? 0 : r;

        // Spherical to Cartesian
        const px = rv * Math.sin(phi) * Math.cos(theta);
        const py = rv * Math.sin(phi) * Math.sin(theta);
        const pz = rv * Math.cos(phi);

        // math(px, py, pz) → Three.js(px, pz, py)
        positions.push(px, pz, py);

        const t = isNaN(r) ? 0 : (r - rlo) / rRange;
        const c = heightColor(eq.color, t);
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j;
        const b = a + 1;
        const c = a + (N + 1);
        const d = c + 1;
        const ra = rGrid[i][j].r;
        const rb = rGrid[i][j + 1].r;
        const rc = rGrid[i + 1][j].r;
        const rd = rGrid[i + 1][j + 1].r;
        if (!isNaN(ra) && !isNaN(rb) && !isNaN(rc)) indices.push(a, c, b);
        if (!isNaN(rb) && !isNaN(rc) && !isNaN(rd)) indices.push(b, c, d);
      }
    }

    if (indices.length === 0) throw new Error('Spherical surface has no visible points');
    const finalColors = resolveVertexColors(eq, positions, sliders, colors); // coordinate-based color map, if eq.colorExpr is set
    return makeMesh(makeGeo(positions, finalColors, indices), eq);
  }

  // ══════════════════════════════════════════════════════
  // 08 — VECTOR FIELD  Fx(x,y,z), Fy(x,y,z), Fz(x,y,z)
  // ══════════════════════════════════════════════════════

  function buildVectorField(eq, sliders) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax } = cfg;

    const parts = eq.expr.split(',');
    if (parts.length < 3) throw new Error('Vector field needs 3 expressions: Fx, Fy, Fz');

    let cX, cY, cZ;
    try {
      cX = MathEngine.compile(parts[0].trim());
      cY = MathEngine.compile(parts[1].trim());
      cZ = MathEngine.compile(parts[2].trim());
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const group = new THREE.Group();
    group.userData = { equationId: eq.id, type: eq.type };

    const N  = 8;   // grid density
    const zLevels = [-2, 0, 2];
    const base = new THREE.Color(eq.color);

    // Sample magnitude across grid for normalization
    let maxMag = 0;
    const samples = [];

    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        for (const z of zLevels) {
          const x = xMin + (xMax - xMin) * i / N;
          const y = yMin + (yMax - yMin) * j / N;
          const scope = MathEngine.buildScope({ x, y, z, t: sliders.t || 0, ...sliders });
          let fx = 0, fy = 0, fz = 0;
          try {
            fx = cX.evaluate({ ...scope }) || 0;
            fy = cY.evaluate({ ...scope }) || 0;
            fz = cZ.evaluate({ ...scope }) || 0;
          } catch {}
          if (!isFinite(fx)) fx = 0;
          if (!isFinite(fy)) fy = 0;
          if (!isFinite(fz)) fz = 0;
          const mag = Math.sqrt(fx * fx + fy * fy + fz * fz);
          if (mag > maxMag) maxMag = mag;
          samples.push({ x, y, z, fx, fy, fz, mag });
        }
      }
    }

    if (maxMag === 0) maxMag = 1;

    // Default (unchanged) behavior: color by magnitude. Bonus wiring for
    // PDF 3.2.1 — if eq.colorExpr is set, it overrides this per-arrow,
    // evaluated at each arrow's own origin, same as every surface builder.
    const flatOrigins = [];
    const defaultColors = [];
    samples.forEach(({ x, y, z, mag }) => {
      flatOrigins.push(x, z, y); // math(x,y,z) -> Three.js(x,z,y), matching every other builder
      const normMag = mag / maxMag;
      const hsl = {};
      base.getHSL(hsl);
      const c = new THREE.Color();
      c.setHSL((hsl.h + normMag * 0.2) % 1, 0.85, 0.45 + normMag * 0.2);
      defaultColors.push(c.r, c.g, c.b);
    });
    const finalColors = resolveVertexColors(eq, flatOrigins, sliders, defaultColors);

    samples.forEach(({ x, y, z, fx, fy, fz, mag }, idx) => {
      const normMag = mag / maxMag;
      if (normMag < 0.001) return;

      // Arrow length proportional to normalized magnitude
      const arrowLen = 0.45 * normMag + 0.05;
      const headLen  = arrowLen * 0.28;
      const headW    = arrowLen * 0.14;

      // Direction in Three.js coords
      const dir = new THREE.Vector3(fx, fz, fy).normalize();
      const origin = new THREE.Vector3(x, z, y);

      const arrowColor = new THREE.Color(finalColors[idx * 3], finalColors[idx * 3 + 1], finalColors[idx * 3 + 2]);

      const arrow = new THREE.ArrowHelper(dir, origin, arrowLen, arrowColor.getHex(), headLen, headW);
      group.add(arrow);
    });

    return group;
  }

  // ══════════════════════════════════════════════════════
  // 09 — POINT CLOUD  (x, y, z) list or random sampling
  // expr: f(x,y) — plot as colored dots, or "x,y,z" literal
  // ══════════════════════════════════════════════════════

  function buildPointCloud(eq, sliders) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax, resolution } = cfg;

    let compiled;
    try {
      compiled = MathEngine.compile(eq.expr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const N = resolution;
    const positions = [];
    const colors    = [];
    let zlo = Infinity, zhi = -Infinity;
    const zVals = [];

    // Sample random points in XY domain
    const count = N * N;
    for (let i = 0; i < count; i++) {
      const x = xMin + Math.random() * (xMax - xMin);
      const y = yMin + Math.random() * (yMax - yMin);
      const scope = MathEngine.buildScope({ x, y, t: sliders.t || 0, ...sliders });
      let z;
      try { z = compiled.evaluate(scope); }
      catch { z = NaN; }
      if (!isFinite(z)) z = NaN;
      if (!isNaN(z)) { zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
      zVals.push({ x, y, z });
    }

    const zRange = (zhi - zlo) || 1;
    zVals.forEach(({ x, y, z }) => {
      if (isNaN(z)) return;
      positions.push(x, z, y);
      const t = (z - zlo) / zRange;
      const c = heightColor(eq.color, t);
      colors.push(c.r, c.g, c.b);
    });

    if (positions.length === 0) throw new Error('No points to display');

    // Stretch goal from PDF 3.2.1: Desmos itself doesn't support
    // coordinate-based color maps on points yet.
    const finalColors = resolveVertexColors(eq, positions, sliders, colors);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(finalColors, 3));

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.05,
      sizeAttenuation: true,
    });

    const pts = new THREE.Points(geo, mat);
    pts.userData = { equationId: eq.id, type: eq.type };
    return pts;
  }

  // ══════════════════════════════════════════════════════
  // 10 — LEVEL SET / CONTOUR LINES  f(x,y) = c
  // ══════════════════════════════════════════════════════

  function buildLevelSet(eq, sliders, level = 0) {
    const cfg = getCfg();
    const { xMin, xMax, yMin, yMax, resolution } = cfg;
    const N = resolution;

    let compiled;
    try {
      compiled = MathEngine.compile(eq.expr);
    } catch (e) {
      throw new Error(MathEngine.friendlyError(e.message));
    }

    const group = new THREE.Group();
    group.userData = { equationId: eq.id, type: 'levelset' };

    // Sample grid and find sign changes (marching squares)
    const grid = [];
    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let j = 0; j <= N; j++) {
        const x = xMin + (xMax - xMin) * j / N;
        const y = yMin + (yMax - yMin) * i / N;
        const scope = MathEngine.buildScope({ x, y, t: sliders.t || 0, ...sliders });
        let v;
        try { v = compiled.evaluate(scope) - level; }
        catch { v = NaN; }
        row.push({ x, y, v });
      }
      grid.push(row);
    }

    const lineColor = new THREE.Color(eq.color);
    const pts = [];

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = grid[i][j];
        const b = grid[i][j + 1];
        const c = grid[i + 1][j];
        const d = grid[i + 1][j + 1];

        // Check each edge for zero crossing and interpolate
        const interp = (p1, p2) => {
          if (!isFinite(p1.v) || !isFinite(p2.v)) return null;
          if (Math.sign(p1.v) === Math.sign(p2.v)) return null;
          const t = p1.v / (p1.v - p2.v);
          return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
          };
        };

        const edges = [
          [a, b], [b, d], [d, c], [c, a],
        ];
        const crossings = edges.map(([p, q]) => interp(p, q)).filter(Boolean);

        for (let k = 0; k < crossings.length - 1; k += 2) {
          const p1 = crossings[k];
          const p2 = crossings[k + 1] || crossings[0];
          pts.push(new THREE.Vector3(p1.x, 0, p1.y));
          pts.push(new THREE.Vector3(p2.x, 0, p2.y));
        }
      }
    }

    if (pts.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: lineColor });
      group.add(new THREE.LineSegments(geo, mat));
    }

    return group;
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    build,
    buildExplicit,
    buildParametric,
    buildImplicit,
    buildSpaceCurve,
    buildPolarCurve2D,
    adaptivePolarSample, // pure, dependency-free — exported for unit testing
    buildPolar,
    buildCylindrical,
    buildSpherical,
    buildVectorField,
    buildPointCloud,
    buildLevelSet,
    buildInequalitySolid,

    // Opt-in cleanup: if the equation list ever supports delete/hide,
    // calling this on that id stops it from being regenerated on future
    // resolution changes. Nothing calls this today — this file has no
    // delete/visibility hook.
    forgetEquation,
  };

})();
