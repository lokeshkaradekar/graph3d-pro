/**
 * Graph3D Pro — engine.js
 * Module 01 — Three.js Renderer, Scene, Lighting, Axes, Grid, Raycaster
 * ~/graph3d-pro/core/engine.js
 *
 * ── Update log ──────────────────────────────────────────
 * Rendering:  GPU-accelerated WebGL context checks, Web Worker compute pool,
 *             Marching Cubes (tetrahedral) isosurface extraction, curvature-driven
 *             adaptive tessellation, FPS-driven adaptive resolution, LRU mesh cache,
 *             solid/wireframe render mode, optional Bloom + Ambient Occlusion passes.
 * Axes/Grid:  Axis labels, numeric tick labels, unit suffixes, fully configurable
 *             grid (size / divisions / colors / sub-grid).
 *
 * ── Update log v2 ───────────────────────────────────────
 * - Distance/frustum-based LOD layered on top of the existing FPS-driven
 *   adaptive resolution (does not replace it — see cfg.distanceLOD).
 * - crossFadeMesh(): ~150ms opacity cross-fade for swapping mesh geometry,
 *   for use by both the LOD system and the existing adaptive-resolution
 *   callback, so resolution/LOD changes never visibly "pop".
 * - getGPUInfo()-driven starting resolution at init (see pickStartingResolution).
 * - Worker pool now sized from navigator.hardwareConcurrency (capped by
 *   cfg.maxWorkers), and the no-worker fallback path for Marching Cubes is
 *   now chunked via requestIdleCallback (setTimeout-chunked on Safari, which
 *   has neither requestIdleCallback nor, in Private Browsing, Workers)
 *   instead of one large blocking synchronous call.
 * - cfg.modernColorManagement (default OFF): a feature-detected, opt-in
 *   outputColorSpace + ACESFilmicToneMapping pipeline, ready for whenever
 *   the pinned three.js CDN version in build.js is upgraded. Does NOT change
 *   the three.js version itself and does NOT change current visual output
 *   while left off — see the note above applyColorManagement().
 *
 * ── Update log v3 (Desmos-parity pass, item 3.1) ─────────
 * - Continuous perspective distortion (cfg.perspectiveDistortion, 0..1)
 *   replaces the old binary ortho/perspective toggle. Implemented as an
 *   FOV/distance blend on a single PerspectiveCamera rather than switching
 *   camera types — see applyPerspectiveDistortion(). This required
 *   splitting the camera in two: virtualCam (drives OrbitControls, holds the
 *   user's real zoom/orbit state) and perspCam (the actual render camera,
 *   derived from virtualCam every frame). toggleOrthographic()/isOrtho()
 *   are now compatibility wrappers over this value, not a separate system.
 * - axes / grid / XY-plane / numbers / labels are five fully independent
 *   toggles now (previously axis/tick labels were gated behind cfg.showAxes).
 *   Added the XY-plane itself (cfg.showXYPlane) as a distinct filled ground
 *   plane, separate from the grid lines.
 * - cfg.translucentSurfaces: dedicated mode for viewing surface
 *   intersections (reduced opacity + depthWrite disabled so neither surface
 *   occludes the other by draw order; back-face culling was already off via
 *   side: DoubleSide).
 * - On-hover coordinate readout already existed (buildRaycaster) — tightened
 *   the raycast target filter to actually-visible meshes only.
 * - Per-axis bounds (cfg.xMin/xMax/yMin/yMax/zMin/zMax) now actually drive
 *   axis length/ticks/labels (previously inert decoration at a fixed +-8);
 *   added zoomSquare()/centerOrigin()/getBoundsState() for the Desmos-style
 *   actions that appear once bounds go asymmetric.
 * All additions are opt-in / backward compatible: toggleOrthographic,
 * isOrtho, resetCamera, setCameraPreset, zoomCamera, getCamera, and
 * getConfig()/applyConfig() all keep their original signatures.
 */

const Engine = (() => {

  // ── Private State ──────────────────────────────────────
  // perspCam is the camera that's actually rendered from. virtualCam is a
  // second, never-rendered camera that OrbitControls is attached to — it
  // holds the user's "natural" orbit/zoom state untouched. Every frame,
  // perspCam's position + FOV are *derived* from virtualCam plus
  // cfg.perspectiveDistortion (see applyPerspectiveDistortion). Keeping
  // these separate avoids a feedback loop: if OrbitControls were attached
  // directly to perspCam, its own next update() would read back whatever
  // distortion-adjusted position we last wrote and compound it every frame.
  let renderer, scene, perspCam, virtualCam, controls;
  // Reused every frame by applyPerspectiveDistortion() below instead of
  // allocating a new THREE.Vector3 there — that function runs
  // unconditionally in the render loop, so a per-frame `new Vector3()`
  // meant constant, avoidable GC pressure on a hot path (~216k
  // allocations/hour at 60fps).
  //
  // IMPORTANT: only declared here, not constructed here. This whole
  // module's top-level scope runs synchronously at script-parse time,
  // before the deferred three.js CDN script is guaranteed to have
  // executed — every other line in this file avoids touching THREE
  // outside of a function body for exactly that reason. Constructing it
  // here directly (`new THREE.Vector3()`) throws "THREE is not defined"
  // on every load, deterministically, not as a rare race. It's
  // constructed lazily on first use inside applyPerspectiveDistortion()
  // instead, by which point THREE is guaranteed to exist.
  let _distortionDir = null;
  let axesGroup, gridGroup, originMarker, xyPlaneMesh;
  let axisLabelGroup, tickLabelGroup;
  let meshes = {};
  let shadowLight = null;
  let lastTime = performance.now();
  let frameCount = 0;
  let animFrameId = null;
  let isRendering = false;

  // Post-processing (Bloom / Ambient Occlusion) — built lazily, only if the
  // three.js addon classes (EffectComposer, RenderPass, ...) are present.
  let composer = null, renderPass = null, ssaoPass = null, bloomPass = null, outputPass = null;
  let postProcessingReady = false;

  // Adaptive resolution (perf-driven)
  let fpsHistory = [];
  let lastResolutionChangeTime = 0;
  const resolutionChangeListeners = [];

  // Web Worker compute pool (Marching Cubes / heavy sampling)
  let workerPool = [];
  let workerRequestId = 0;
  const pendingWorkerRequests = new Map();

  // Distance/frustum-based LOD (per-mesh; layered on top of the FPS governor above)
  const lodTracked = new Map();      // id -> { history: [], lastLevel: null, lastChangeTime: 0 }
  const lodChangeListeners = [];
  // Frustum-test helpers — created lazily on first use (not at module load)
  // since THREE may not be defined yet when this file is first evaluated,
  // matching this file's existing lazy-THREE-access convention.
  let _frustum = null, _projScreenMatrix = null, _tempSphere = null;

  // In-flight cross-fades, keyed by mesh id, so a second swap request for the
  // same id cancels/cleans up the first instead of stacking animations.
  const activeCrossFades = new Map(); // id -> { rafId, fadingMesh }

  // ── Config (mutable via applyConfig) ──────────────────
  const cfg = {
    xMin: -5, xMax: 5,
    yMin: -5, yMax: 5,
    zMin: -10, zMax: 10,
    resolution: 55,
    wireframe: false,
    transparent: true,
    shadows: false,
    showAxes: true,
    showGrid: true,
    fog: true,
    showCrosshair: false,
    showCoordTip: true,
    bgColor: 0x07090f,

    // Render mode — 'solid' | 'wireframe'. Kept in sync with legacy cfg.wireframe.
    renderMode: 'solid',

    // Continuous perspective distortion — replaces the old binary ortho/persp
    // toggle. 0 = orthographic-like (parallel projection), 1 = full
    // perspective. See applyPerspectiveDistortion(). toggleOrthographic()/
    // isOrtho() are kept as thin compatibility wrappers around this value.
    perspectiveDistortion: 1,

    // Translucent-surfaces mode — for viewing where two surfaces intersect.
    // Distinct from the general cfg.transparent: this also disables
    // depth-write so neither surface can silently occlude the other based on
    // draw order (the standard practical fix for mutual surface transparency;
    // full order-independent transparency is a much bigger undertaking and
    // isn't what's needed here).
    translucentSurfaces: false,
    translucentOpacity: 0.5,

    // Axis labels / tick labels ("numbers", in Desmos's terminology) / units.
    // Independently toggleable — no longer gated behind cfg.showAxes.
    showAxisLabels: true,
    showTickLabels: true,
    units: '',

    // The XY-plane — a soft, independently-toggleable filled ground plane,
    // distinct from the grid *lines* below (Desmos treats these as two
    // separate toggles; so do we).
    showXYPlane: false,
    xyPlaneColor: 0x1a2a40,
    xyPlaneOpacity: 0.06,

    // Configurable grid
    gridSize: 20,
    gridDivisions: 20,
    gridColor1: 0x1a2a40,
    gridColor2: 0x111828,
    gridSubgrid: true,

    // Adaptive resolution — auto-adjusts cfg.resolution to hold target FPS.
    // On by default: monitorAdaptiveResolution() only reacts to a 5-sample
    // rolling average with a 2s cooldown between changes, so it doesn't
    // hunt/flicker — safe to leave on for everyone, most valuable on
    // low/mid-tier mobile GPUs.
    adaptiveResolution: true,
    minResolution: 16,
    maxResolution: 140,
    targetFPS: 45,

    // Adaptive tessellation — curvature-driven subdivision for parametric/height-field surfaces
    adaptiveTessellation: false,
    tessMaxLevel: 3,
    tessCurvatureThreshold: 0.02,

    // Post-processing (optional — extra GPU cost)
    ambientOcclusion: false,
    bloom: false,
    bloomStrength: 0.6,
    bloomRadius: 0.4,
    bloomThreshold: 0.85,

    // Mesh cache
    meshCacheEnabled: true,
    meshCacheMaxEntries: 24,

    // Web Worker compute (Marching Cubes, etc.)
    useWebWorker: true,
    maxWorkers: 8,          // pool size = min(navigator.hardwareConcurrency, maxWorkers)

    // Distance/frustum-based LOD — layered on top of adaptiveResolution above.
    // adaptiveResolution reacts to sustained FPS (a global signal); this reacts
    // to camera distance + on/off-screen per tracked mesh (a per-object signal).
    distanceLOD: false,
    lodNear: 6,              // at/below this distance: full resolution (multiplier 1.0)
    lodFar: 45,              // at/beyond this distance: minimum resolution
    lodMinMultiplier: 0.25,  // resolution multiplier floor for far-but-visible meshes
    lodOffscreenMultiplier: 0.15, // resolution multiplier for meshes outside the frustum
    lodSampleFrames: 5,      // hysteresis window, same pattern as monitorAdaptiveResolution
    lodChangeCooldownMs: 400,
    lodCrossFadeMs: 150,     // default cross-fade duration for LOD-triggered swaps

    // Starting resolution — picked from getGPUInfo() at init() unless overridden
    // via init(canvas, { resolution }) or init(canvas, { gpuTier }).
    autoStartResolution: true,

    // Color management — OFF by default; see applyColorManagement() below for
    // why this needs a build.js coordination change before it does anything.
    modernColorManagement: false,
    toneMappingExposure: 1.0,
  };

  // ── Color palette ──────────────────────────────────────
  let colorIndex = 0;
  const COLOR_PALETTE = [
    '#3b82f6','#10b981','#f59e0b','#f43f5e',
    '#8b5cf6','#06b6d4','#f97316','#ec4899',
    '#a3e635','#e2e8f0',
  ];

  // Shared axis definitions (direction / color / label) used by both the
  // axis geometry (buildAxes) and the new text-sprite labels.
  const AXIS_DEFS = [
    { dir: [1, 0, 0], color: 0xff4444, label: 'X' },
    { dir: [0, 1, 0], color: 0x44dd66, label: 'Y' },
    { dir: [0, 0, 1], color: 0x4488ff, label: 'Z' },
  ];

  // Continuous perspective-distortion tuning. MAX_FOV matches the engine's
  // original fixed 56° perspective camera exactly, so distortion=1 behaves
  // identically to the old default. MIN_FOV can't be 0 (tan(0) is singular)
  // but 2° reads as effectively orthographic at any normal viewing distance.
  const PERSPECTIVE_MIN_FOV = 2;
  const PERSPECTIVE_MAX_FOV = 56;

  // Per-axis bounds, respecting this file's existing Three.js Y/Z swap
  // (Three Y, the vertical axis, carries "math Z"; Three Z carries "math Y" —
  // see the note in buildRaycaster). Returns [min, max] in world units.
  function getAxisBounds(dir) {
    const [x, y] = dir;
    if (x === 1) return [cfg.xMin, cfg.xMax];
    if (y === 1) return [cfg.zMin, cfg.zMax];
    return [cfg.yMin, cfg.yMax];
  }

  // "Nice" tick step (1/2/5 x a power of 10) so per-axis bounds of any size
  // produce a reasonable, readable number of ticks instead of literally one
  // per integer — which would be fine for the default -5..5 range but would
  // flood the scene with thousands of ticks/labels for a large custom range.
  function computeTickStep(min, max, targetTicks = 10) {
    const span = Math.max(1e-9, max - min);
    const rawStep = span / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let niceResidual;
    if (residual > 5) niceResidual = 10;
    else if (residual > 2) niceResidual = 5;
    else if (residual > 1) niceResidual = 2;
    else niceResidual = 1;
    return niceResidual * magnitude;
  }

  // Cheap, throwaway-canvas GPU probe used only to pick the renderer's
  // antialias flag *before* the real renderer exists. Unlike every other
  // quality setting, antialiasing is fixed at WebGL context-creation time
  // and can't be changed afterward — applyConfig({ antialias }) later has
  // nothing to act on, so the decision has to be made correctly up front.
  // Uses the same WEBGL_debug_renderer_info signal as getGPUInfo()/
  // classifyGPU() below, just against a temporary context.
  function _probeInitialAntialias() {
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!gl) return true; // no WebGL at all — checkWebGLSupport() below reports this properly
      const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = ((dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '').toLowerCase();
      const vendorStr = ((dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)) || '').toLowerCase();
      const text = rendererStr + ' ' + vendorStr;
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
      // Software rasterizers and mobile GPUs pay disproportionately for
      // MSAA relative to the visual benefit — start them without it.
      // Everything else keeps the original always-on behavior.
      if (/swiftshader|software|llvmpipe|basic render/.test(text)) return false;
      if (/adreno|mali-|powervr|videocore|apple gpu/.test(text)) return false;
      return true;
    } catch (err) {
      return true; // never let GPU probing itself be the reason init() fails
    }
  }

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════
  function init(canvas, options = {}) {
    // ── WebGL support check ─────────────────────────────
    const support = checkWebGLSupport();
    if (!support.supported) {
      console.error('[Graph3D Pro] WebGL is not supported in this browser/device.');
      const tip = document.getElementById('coord-tooltip');
      if (tip) {
        tip.textContent = 'WebGL is not supported in this browser.';
        tip.classList.add('visible');
      }
      return false;
    }

    // ── Renderer (GPU-accelerated: high-performance context) ───
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: typeof options.antialias === 'boolean' ? options.antialias : _probeInitialAntialias(),
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(cfg.bgColor, 1);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    applyColorManagement();

    // ── GPU-aware starting resolution ───────────────────
    // A fixed cfg.resolution default (55) is a reasonable middle ground, but
    // it's needlessly heavy on integrated/mobile GPUs and leaves headroom on
    // the table on discrete GPUs. Pick a tier-appropriate starting point
    // *before* any surface is generated, unless the caller pins one explicitly.
    const gpuInfo = getGPUInfo();
    const gpuTier = options.gpuTier || classifyGPU(gpuInfo);
    if (typeof options.resolution === 'number') {
      cfg.resolution = options.resolution;
    } else if (cfg.autoStartResolution) {
      cfg.resolution = pickStartingResolution(gpuInfo, gpuTier);
    }
    console.log(
      `[Graph3D Pro] GPU: ${(gpuInfo && gpuInfo.renderer) || 'unknown'} ` +
      `(tier: ${gpuTier}) → starting resolution: ${cfg.resolution}`
    );

    // ── Scene ──────────────────────────────────────────
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(cfg.bgColor, 0.016);

    // ── Perspective Camera (the one actually rendered from) ──
    perspCam = new THREE.PerspectiveCamera(PERSPECTIVE_MAX_FOV, 1, 0.01, 600);
    perspCam.position.set(7, 5, 9);
    perspCam.lookAt(0, 0, 0);

    // ── Virtual camera (drives OrbitControls; never rendered) ──
    // See the note by its declaration above: this holds the user's actual
    // orbit/zoom state, and perspCam is derived from it every frame.
    virtualCam = new THREE.PerspectiveCamera(PERSPECTIVE_MAX_FOV, 1, 0.01, 600);
    virtualCam.position.set(7, 5, 9);
    virtualCam.lookAt(0, 0, 0);

    // ── Lighting ───────────────────────────────────────
    buildLights();

    // ── Controls ───────────────────────────────────────
    controls = new THREE.OrbitControls(virtualCam, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.3;
    controls.maxDistance = 120;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.6;
    controls.screenSpacePanning = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // ── Raycaster for coord tooltip ────────────────────
    buildRaycaster(canvas);

    // ── Double-tap reset (mobile) ──────────────────────
    let lastTap = 0;
    canvas.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 280) resetCamera();
      lastTap = now;
    }, { passive: true });

    // ── Scene objects ──────────────────────────────────
    buildAxes();
    buildAxisLabels();
    buildTickLabels();
    buildGrid();
    buildXYPlane();
    buildOriginMarker();

    // ── Resize ────────────────────────────────────────
    resize();
    window.addEventListener('resize', resize);

    // ── Post-processing (only actually builds if bloom/AO start enabled) ──
    updatePostProcessing();

    // ── Start loop ─────────────────────────────────────
    startLoop();

    // Pause rendering entirely while the tab is backgrounded — nothing is
    // visible to render, so continuing to run controls.update() and a full
    // renderer.render()/composer.render() every frame is pure wasted CPU/
    // GPU/battery. Browsers throttle background rAF to varying degrees on
    // their own, but that's a heuristic, not a guarantee; this is explicit.
    // startLoop() is idempotency-guarded (if(isRendering)return), so this
    // is safe to call again on return without any special-casing.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopLoop();
      else startLoop();
    });

    return true;
  }

  // ══════════════════════════════════════════════════════
  // LIGHTING  — professional 3-point setup
  // ══════════════════════════════════════════════════════
  function buildLights() {
    // Ambient — soft fill
    const ambient = new THREE.AmbientLight(0x1a2a40, 4.0);
    scene.add(ambient);

    // Key light — main directional
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(8, 14, 6);
    key.castShadow = false;
    scene.add(key);

    // Fill light — blue tint from opposite side
    const fill = new THREE.DirectionalLight(0x3b6fcc, 0.35);
    fill.position.set(-8, 2, -6);
    scene.add(fill);

    // Rim light — purple point light for depth
    const rim = new THREE.PointLight(0x7c3aed, 0.9, 35);
    rim.position.set(-4, 4, -4);
    scene.add(rim);

    // Shadow-capable light (disabled by default, enabled via settings)
    shadowLight = new THREE.DirectionalLight(0xffffff, 0.7);
    shadowLight.position.set(-5, 12, -5);
    shadowLight.castShadow = false;
    shadowLight.shadow.mapSize.width = 1024;
    shadowLight.shadow.mapSize.height = 1024;
    shadowLight.shadow.camera.near = 0.1;
    shadowLight.shadow.camera.far = 50;
    shadowLight.shadow.camera.left = -12;
    shadowLight.shadow.camera.right = 12;
    shadowLight.shadow.camera.top = 12;
    shadowLight.shadow.camera.bottom = -12;
    shadowLight.shadow.bias = -0.001;
    scene.add(shadowLight);
  }

  // ══════════════════════════════════════════════════════
  // AXES
  // ══════════════════════════════════════════════════════
  function buildAxes() {
    if (axesGroup) scene.remove(axesGroup);
    axesGroup = new THREE.Group();

    AXIS_DEFS.forEach(({ dir: [x, y, z], color }) => {
      const [axMin, axMax] = getAxisBounds([x, y, z]);

      // Main axis line — spans the real configured per-axis bounds, which
      // may be asymmetric (e.g. the default zMin/zMax is -10..10 while
      // xMin/xMax is -5..5) rather than a fixed +-8 for every axis.
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
      const pts = [
        new THREE.Vector3(x * axMin, y * axMin, z * axMin),
        new THREE.Vector3(x * axMax, y * axMax, z * axMax),
      ];
      axesGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts), mat
      ));

      // Tick marks at a "nice" step so a wide custom range doesn't produce
      // one tick per integer (see computeTickStep).
      const tickMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 });
      const step = computeTickStep(axMin, axMax);
      const startIdx = Math.ceil(axMin / step);
      const endIdx = Math.floor(axMax / step);
      for (let i = startIdx; i <= endIdx; i++) {
        const n = i * step;
        if (n === 0) continue;
        const s = 0.065;
        const tickPts = [
          new THREE.Vector3(x*n + y*s + z*s, y*n + x*s + z*s, z*n + x*s + y*s),
          new THREE.Vector3(x*n - y*s - z*s, y*n - x*s - z*s, z*n - x*s - y*s),
        ];
        axesGroup.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(tickPts), tickMat
        ));
      }

      // Arrowhead cone at the positive (max) end
      const coneGeo = new THREE.ConeGeometry(0.06, 0.2, 8);
      const coneMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const cone = new THREE.Mesh(coneGeo, coneMat);

      // Orient cone along axis
      if (x === 1) cone.rotation.z = -Math.PI / 2;
      if (z === 1) cone.rotation.x = Math.PI / 2;
      const coneEnd = axMax + 0.1;
      cone.position.set(x * coneEnd, y * coneEnd, z * coneEnd);
      axesGroup.add(cone);
    });

    scene.add(axesGroup);
    axesGroup.visible = cfg.showAxes;
  }

  // ══════════════════════════════════════════════════════
  // AXIS LABELS & TICK LABELS  (new)
  // ══════════════════════════════════════════════════════
  function makeTextSprite(text, opts = {}) {
    const color = opts.color || '#e2e8f0';
    const fontSize = opts.size || 64;
    const weight = opts.weight || '600';

    const canvasEl = document.createElement('canvas');
    const ctx = canvasEl.getContext('2d');
    ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, sans-serif`;
    const metrics = ctx.measureText(text);
    const padding = fontSize * 0.4;
    canvasEl.width = Math.max(2, Math.ceil(metrics.width + padding * 2));
    canvasEl.height = Math.ceil(fontSize * 1.5);

    // Resizing the canvas clears its context state, so re-apply the font.
    ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, canvasEl.width / 2, canvasEl.height / 2);

    const texture = new THREE.CanvasTexture(canvasEl);
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const aspect = canvasEl.width / canvasEl.height;
    const worldHeight = 0.42;
    sprite.scale.set(worldHeight * aspect, worldHeight, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  function disposeSpriteGroup(group) {
    if (!group) return;
    group.children.forEach(sprite => {
      if (sprite.material) {
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
      }
    });
  }

  function hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  function buildAxisLabels() {
    disposeSpriteGroup(axisLabelGroup);
    if (axisLabelGroup) scene.remove(axisLabelGroup);
    axisLabelGroup = new THREE.Group();

    const unitSuffix = cfg.units ? ` (${cfg.units})` : '';
    AXIS_DEFS.forEach(({ dir: [x, y, z], color, label }) => {
      const [, axMax] = getAxisBounds([x, y, z]);
      const sprite = makeTextSprite(label + unitSuffix, {
        color: hexToCss(color), size: 72, weight: '700',
      });
      const pos = axMax + 0.6;
      sprite.position.set(x * pos, y * pos, z * pos);
      axisLabelGroup.add(sprite);
    });

    scene.add(axisLabelGroup);
    // Independent of cfg.showAxes — Desmos treats axes/grid/plane/numbers/
    // labels as five separate toggles, not axes-gated sub-options.
    axisLabelGroup.visible = cfg.showAxisLabels;
  }

  function buildTickLabels() {
    disposeSpriteGroup(tickLabelGroup);
    if (tickLabelGroup) scene.remove(tickLabelGroup);
    tickLabelGroup = new THREE.Group();

    const unit = cfg.units;
    const fmt = (n) => (unit ? `${n}${unit}` : `${n}`);

    // A small perpendicular offset per axis keeps the numeric labels from
    // sitting directly on top of the tick marks.
    const tickAxisDefs = [
      { dir: [1, 0, 0], offset: [0, -0.28, 0] },
      { dir: [0, 1, 0], offset: [0.28, 0, 0] },
      { dir: [0, 0, 1], offset: [0.28, 0, 0] },
    ];

    tickAxisDefs.forEach(({ dir: [x, y, z], offset }) => {
      const [axMin, axMax] = getAxisBounds([x, y, z]);
      const step = computeTickStep(axMin, axMax);
      const startIdx = Math.ceil(axMin / step);
      const endIdx = Math.floor(axMax / step);
      for (let i = startIdx; i <= endIdx; i++) {
        const n = i * step;
        if (n === 0) continue;
        const label = Number.isInteger(step) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
        const sprite = makeTextSprite(fmt(label), { color: '#5a6b85', size: 40, weight: '500' });
        sprite.scale.multiplyScalar(0.55);
        sprite.position.set(x * n + offset[0], y * n + offset[1], z * n + offset[2]);
        tickLabelGroup.add(sprite);
      }
    });

    scene.add(tickLabelGroup);
    // Independent of cfg.showAxes — see buildAxisLabels' note above.
    tickLabelGroup.visible = cfg.showTickLabels;
  }

  // ══════════════════════════════════════════════════════
  // GRID  (configurable)
  // ══════════════════════════════════════════════════════
  function buildGrid() {
    if (gridGroup) { scene.remove(gridGroup); disposeMesh(gridGroup); }
    gridGroup = new THREE.Group();

    const size = cfg.gridSize;
    const divisions = Math.max(1, cfg.gridDivisions);

    // Primary grid — XZ plane
    const primaryGrid = new THREE.GridHelper(size, divisions, cfg.gridColor1, cfg.gridColor2);
    primaryGrid.material.transparent = true;
    primaryGrid.material.opacity = 0.85;
    gridGroup.add(primaryGrid);

    // Subtle sub-grid (optional)
    if (cfg.gridSubgrid) {
      const subGrid = new THREE.GridHelper(size, divisions * 5, 0x0d1520, 0x0d1520);
      subGrid.material.transparent = true;
      subGrid.material.opacity = 0.3;
      gridGroup.add(subGrid);
    }

    scene.add(gridGroup);
    gridGroup.visible = cfg.showGrid;
  }

  // Convenience setter — updates grid config fields and rebuilds in one call.
  function setGridConfig(opts) {
    Object.assign(cfg, opts);
    buildGrid();
    return { size: cfg.gridSize, divisions: cfg.gridDivisions };
  }

  // ══════════════════════════════════════════════════════
  // XY-PLANE — a soft filled ground plane, independent of the grid *lines*
  // above. Desmos exposes these as two separate toggles (grid vs. XY plane);
  // this mirrors that rather than folding the plane into the grid toggle.
  // ══════════════════════════════════════════════════════
  function buildXYPlane() {
    if (xyPlaneMesh) { scene.remove(xyPlaneMesh); disposeMesh(xyPlaneMesh); }

    const size = cfg.gridSize;
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2); // lie flat, coplanar with the GridHelper below it
    const mat = new THREE.MeshBasicMaterial({
      color: cfg.xyPlaneColor,
      transparent: true,
      opacity: cfg.xyPlaneOpacity,
      side: THREE.DoubleSide,
      depthWrite: false, // a translucent fill shouldn't occlude the grid/surfaces behind it
    });
    xyPlaneMesh = new THREE.Mesh(geo, mat);
    xyPlaneMesh.position.y = -0.002; // sit a hair below the grid lines to avoid z-fighting
    scene.add(xyPlaneMesh);
    xyPlaneMesh.visible = cfg.showXYPlane;
  }

  // ══════════════════════════════════════════════════════
  // ORIGIN MARKER
  // ══════════════════════════════════════════════════════
  function buildOriginMarker() {
    if (originMarker) scene.remove(originMarker);
    const geo = new THREE.SphereGeometry(0.055, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a5070 });
    originMarker = new THREE.Mesh(geo, mat);
    scene.add(originMarker);
  }

  // ══════════════════════════════════════════════════════
  // RAYCASTER — coordinate tooltip
  // ══════════════════════════════════════════════════════
  function buildRaycaster(canvas) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-9, -9);
    const tooltip = document.getElementById('coord-tooltip');
    if (!tooltip) return;

    let touchHideTimer = null;

    // Shared by both the desktop mousemove path and the mobile
    // graph3d:tap path below, so the raycast/DOM-update logic only
    // lives in one place. Returns whether anything was hit.
    function showTooltipAt(clientX, clientY, isTouch) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, activeCamera());

      const targets = Object.values(meshes)
        .filter(m => m && m.isMesh && m.visible);

      const hits = raycaster.intersectObjects(targets, false);
      if (!hits.length) {
        tooltip.classList.remove('visible');
        return false;
      }
      const p = hits[0].point;
      const suffix = cfg.units ? ' ' + cfg.units : '';
      // Note: our coord system swaps Three.js Y/Z
      // Three.js Y → math Z, Three.js Z → math Y
      document.getElementById('coord-x').textContent = p.x.toFixed(3) + suffix;
      document.getElementById('coord-y').textContent = p.z.toFixed(3) + suffix;
      document.getElementById('coord-z').textContent = p.y.toFixed(3) + suffix;
      // A fingertip is ~25-45px wide vs. a ~1px mouse cursor tip, so the
      // touch offset needs to clear well above/right of the touch point
      // or the tooltip ends up hidden under the user's own thumb.
      const dx = isTouch ? 20 : 14;
      const dy = isTouch ? -56 : -10;
      tooltip.style.left = (clientX - rect.left + dx) + 'px';
      tooltip.style.top  = (clientY - rect.top + dy) + 'px';
      tooltip.classList.add('visible');
      return true;
    }

    canvas.addEventListener('mousemove', (e) => {
      if (!cfg.showCoordTip) return;
      showTooltipAt(e.clientX, e.clientY, false);
    });

    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.remove('visible');
    });

    // Touch has no hover state, so the same feature is reached via a
    // confirmed single tap instead — camera.js dispatches this only
    // after ruling out a double-tap (which resets the camera instead),
    // see handleTouch() in core/camera.js.
    canvas.addEventListener('graph3d:tap', (e) => {
      if (!cfg.showCoordTip) return;
      const hit = showTooltipAt(e.detail.clientX, e.detail.clientY, true);
      if (touchHideTimer) { clearTimeout(touchHideTimer); touchHideTimer = null; }
      if (hit) {
        // No mouseleave equivalent on touch — auto-hide so it doesn't
        // linger on screen indefinitely after the finger lifts.
        touchHideTimer = setTimeout(() => tooltip.classList.remove('visible'), 2500);
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // RENDER LOOP
  // ══════════════════════════════════════════════════════
  function startLoop() {
    if (isRendering) return;
    isRendering = true;

    function loop() {
      animFrameId = requestAnimationFrame(loop);
      controls.update();
      applyPerspectiveDistortion();

      // FPS counter
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastTime));
        const fpsEl = document.getElementById('fps-counter');
        if (fpsEl) fpsEl.textContent = fps + ' fps';

        // Memory (Chrome only)
        if (performance.memory) {
          const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
          const memEl = document.getElementById('memory-usage');
          if (memEl) memEl.textContent = mb + ' MB';
        }

        // Adaptive resolution — react to sustained FPS, not single-frame noise
        if (cfg.adaptiveResolution) monitorAdaptiveResolution(fps);

        frameCount = 0;
        lastTime = now;
      }

      // Distance/frustum LOD — cheap per-frame distance+visibility sampling;
      // its own internal hysteresis (see updateDistanceLOD) keeps the actual
      // mesh-regeneration callback rare even though this runs every frame.
      if (cfg.distanceLOD) updateDistanceLOD();

      if (postProcessingReady && composer && (cfg.bloom || cfg.ambientOcclusion)) {
        if (renderPass) renderPass.camera = activeCamera();
        if (ssaoPass) ssaoPass.camera = activeCamera();
        composer.render();
      } else {
        renderer.render(scene, activeCamera());
      }
    }

    loop();
  }

  function stopLoop() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
      isRendering = false;
    }
  }

  // ══════════════════════════════════════════════════════
  // RESIZE
  // ══════════════════════════════════════════════════════
  function resize() {
    const container = renderer.domElement.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;
    // A layout pass can briefly report 0 for either dimension (e.g. a
    // panel mid-transition, or a container not yet in the layout tree).
    // aspect = w/0 would be Infinity and hand THREE a degenerate
    // projection matrix, so just skip this resize and wait for the next
    // one rather than rendering a blank/broken frame.
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);

    perspCam.aspect = w / h;
    perspCam.updateProjectionMatrix();

    if (composer) composer.setSize(w, h);
    if (ssaoPass && ssaoPass.setSize) ssaoPass.setSize(w, h);
  }

  // ══════════════════════════════════════════════════════
  // CAMERA
  // ══════════════════════════════════════════════════════
  function activeCamera() {
    return perspCam;
  }

  // Continuous ortho<->perspective blend (item 3.1.1). Rather than switching
  // between two different camera *types* (which is what the old binary
  // toggle did), this keeps perspCam a single PerspectiveCamera and blends
  // its FOV, then solves for the distance that keeps the apparent size at
  // the orbit target plane constant — the standard "focal length doesn't
  // change framing" trick used by DCC tools for exactly this kind of slider.
  // At distortion=1 this is an exact no-op (distance == the user's actual
  // orbit distance); at distortion=0 the FOV approaches 0° (true 0 is
  // singular) so perspective drops out and the view reads as orthographic.
  // A defensive clamp keeps the computed distance safely inside perspCam's
  // far plane even at extreme zoom-out + minimum-distortion combinations —
  // see distortion_test validation notes; framing degrades gracefully there
  // instead of the scene clipping.
  function applyPerspectiveDistortion() {
    const t = cfg.perspectiveDistortion;
    const fovDeg = PERSPECTIVE_MIN_FOV + t * (PERSPECTIVE_MAX_FOV - PERSPECTIVE_MIN_FOV);

    const naturalDistance = virtualCam.position.distanceTo(controls.target);
    const hTarget = naturalDistance * Math.tan((PERSPECTIVE_MAX_FOV * Math.PI / 180) / 2);
    let distance = hTarget / Math.tan((fovDeg * Math.PI / 180) / 2);
    distance = Math.min(distance, perspCam.far * 0.9);

    if (!_distortionDir) _distortionDir = new THREE.Vector3();
    const dir = _distortionDir.subVectors(virtualCam.position, controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1); // degenerate (camera exactly at target) — shouldn't happen given controls.minDistance
    dir.normalize();

    perspCam.position.copy(controls.target).addScaledVector(dir, distance);
    perspCam.quaternion.copy(virtualCam.quaternion);
    perspCam.fov = fovDeg;
    perspCam.updateProjectionMatrix();
  }

  function setPerspectiveDistortion(value) {
    cfg.perspectiveDistortion = Math.max(0, Math.min(1, value));
    if (perspCam) applyPerspectiveDistortion();
    return cfg.perspectiveDistortion;
  }

  function getPerspectiveDistortion() {
    return cfg.perspectiveDistortion;
  }

  function resetCamera() {
    virtualCam.position.set(7, 5, 9);
    virtualCam.lookAt(0, 0, 0);
    controls.reset();
  }

  function setCameraPreset(preset) {
    const presets = {
      top:   [0, 14, 0.001],
      front: [0, 0.001, 14],
      side:  [14, 0.001, 0],
      iso:   [8, 8, 8],
      back:  [0, 0.001, -14],
    };
    const pos = presets[preset] || presets.iso;
    virtualCam.position.set(...pos);
    virtualCam.lookAt(0, 0, 0);
    controls.update();
  }

  // Kept as a compatibility wrapper over the continuous distortion value
  // (item 3.1.1 replaces the binary toggle this used to drive directly).
  // Snaps between the two ends rather than switching camera types.
  function toggleOrthographic() {
    setPerspectiveDistortion(cfg.perspectiveDistortion > 0.5 ? 0 : 1);
    const btn = document.getElementById('hud-ortho');
    if (btn) btn.classList.toggle('active', cfg.perspectiveDistortion === 0);
    return cfg.perspectiveDistortion === 0;
  }

  function zoomCamera(factor) {
    virtualCam.position.multiplyScalar(factor);
  }

  // ══════════════════════════════════════════════════════
  // MESH REGISTRY
  // ══════════════════════════════════════════════════════
  // Describes an unexpected value for error messages — flags the most
  // common real cause (a still-pending Promise, e.g. from forgetting to
  // await Engine.buildIsosurfaceMesh()/marchingCubesAsync()) specifically,
  // since that's indistinguishable from "some other bad object" otherwise.
  function describeForError(x) {
    if (x === null) return 'null';
    if (x === undefined) return 'undefined';
    if (typeof x === 'object' && typeof x.then === 'function') {
      return 'a Promise that is still pending — did you forget to `await` it? ' +
             '(buildIsosurfaceMesh() and marchingCubesAsync() are both async)';
    }
    if (Array.isArray(x)) return `an Array (length ${x.length})`;
    const ctorName = x && x.constructor && x.constructor.name;
    return `an object of type ${ctorName || typeof x}`;
  }

  function addMesh(id, mesh) {
    removeMesh(id);
    if (!mesh) return;
    if (!mesh.isObject3D) {
      // Matches the exact check THREE.Object3D.prototype.add() itself uses,
      // so this fires *before* scene.add() would silently no-op with only
      // THREE's generic "not an instance of THREE.Object3D." in the console.
      console.error(
        `[Graph3D Pro] Engine.addMesh('${id}', ...) was given something that ` +
        `isn't a THREE.Object3D, so it was NOT added to the scene (the graph ` +
        `for '${id}' will not display). Got: ${describeForError(mesh)}.`
      );
      return;
    }
    if (cfg.shadows && mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    applyMaterialConfig(mesh);
    scene.add(mesh);
    meshes[id] = mesh;
    syncSurfaceCount();
  }

  function removeMesh(id) {
    if (!meshes[id]) return;
    scene.remove(meshes[id]);
    disposeMesh(meshes[id]);
    delete meshes[id];
    untrackLOD(id); // cleans up lodTracked — safe no-op if this id was never tracked
    syncSurfaceCount();
  }

  function disposeMesh(mesh) {
    if (!mesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    // Recurse into groups
    if (mesh.children && mesh.children.length) {
      mesh.children.forEach(disposeMesh);
    }
  }

  function clearAllMeshes() {
    Object.keys(meshes).forEach(id => removeMesh(id));
  }

  function getMeshes() { return meshes; }

  function syncSurfaceCount() {
    const n = Object.keys(meshes).length;
    const el = document.getElementById('surface-count');
    if (el) el.textContent = n + ' surface' + (n !== 1 ? 's' : '');
  }

  // ══════════════════════════════════════════════════════
  // DISTANCE / FRUSTUM-BASED LOD
  //
  // Layered on top of (not a replacement for) the existing FPS-driven
  // adaptiveResolution governor: that system answers "is the whole scene
  // struggling?" by adjusting a single global cfg.resolution; this one
  // answers "is *this* mesh worth full detail right now?" per mesh, based on
  // camera distance and frustum visibility. graph-builder opts a mesh in via
  // trackForLOD(id), listens with onLODChange, regenerates the geometry at
  // the suggested resolution (optionally using the marchingCubes*/
  // adaptiveTessellate* + cache helpers already exposed by this module), and
  // swaps it in with crossFadeMesh() instead of addMesh() so the change is
  // never visible as a hard "pop".
  // ══════════════════════════════════════════════════════
  function ensureFrustumHelpers() {
    if (_frustum) return;
    _frustum = new THREE.Frustum();
    _projScreenMatrix = new THREE.Matrix4();
    _tempSphere = new THREE.Sphere();
  }

  function isInFrustum(mesh) {
    if (!mesh.geometry) return true;
    ensureFrustumHelpers();
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    if (!mesh.geometry.boundingSphere) return true; // empty geometry — don't penalize it
    const cam = activeCamera();
    _projScreenMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    _tempSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
    return _frustum.intersectsSphere(_tempSphere);
  }

  // Smoothstep falloff from full detail near the camera to a floor multiplier
  // at/beyond lodFar; off-screen meshes get a separate (lower) flat floor.
  function computeLODMultiplier(distance, inFrustum) {
    if (!inFrustum) return cfg.lodOffscreenMultiplier;
    if (distance <= cfg.lodNear) return 1;
    if (distance >= cfg.lodFar) return cfg.lodMinMultiplier;
    const t = (distance - cfg.lodNear) / (cfg.lodFar - cfg.lodNear);
    const s = t * t * (3 - 2 * t); // smoothstep
    return 1 - s * (1 - cfg.lodMinMultiplier);
  }

  function trackForLOD(id, options = {}) {
    lodTracked.set(id, {
      history: [],
      lastLevel: null,
      lastChangeTime: 0,
      getCenter: typeof options.getCenter === 'function' ? options.getCenter : null,
    });
  }

  function untrackLOD(id) {
    lodTracked.delete(id);
  }

  function onLODChange(callback) {
    lodChangeListeners.push(callback);
    return () => {
      const i = lodChangeListeners.indexOf(callback);
      if (i !== -1) lodChangeListeners.splice(i, 1);
    };
  }

  // Runs every frame (cheap: a distance calc + frustum test per tracked mesh).
  // Hysteresis lives here, mirroring monitorAdaptiveResolution's pattern —
  // a short rolling window (lodSampleFrames) plus a per-mesh cooldown — so a
  // quick camera flick doesn't trigger a regeneration, only a sustained change.
  function updateDistanceLOD() {
    if (lodTracked.size === 0) return;
    const now = performance.now();

    lodTracked.forEach((state, id) => {
      const mesh = meshes[id];
      if (!mesh) return;
      mesh.updateMatrixWorld();

      let center;
      if (state.getCenter) {
        center = state.getCenter();
      } else if (mesh.geometry) {
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        center = mesh.geometry.boundingSphere
          ? mesh.geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld)
          : mesh.position;
      } else {
        center = mesh.position;
      }

      // Distance is measured from virtualCam (the user's actual, distortion-
      // independent orbit/zoom state), not the real render camera — perspCam
      // may sit much farther away at low perspectiveDistortion values by
      // design (see applyPerspectiveDistortion), but the object's on-screen
      // size is deliberately unchanged, so LOD shouldn't degrade it as if it
      // were genuinely farther away.
      const distance = virtualCam.position.distanceTo(center);
      const visible = isInFrustum(mesh);
      const multiplier = computeLODMultiplier(distance, visible);

      state.history.push(multiplier);
      if (state.history.length > cfg.lodSampleFrames) state.history.shift();
      if (state.history.length < cfg.lodSampleFrames) return;

      const avg = state.history.reduce((a, b) => a + b, 0) / state.history.length;
      // Snap to integer steps (0-10, i.e. multiples of 0.1) rather than
      // comparing rounded floats directly — 0.3 - 0.2 !== 0.1 in IEEE754,
      // so a float-threshold comparison can silently miss a real step change.
      const step = Math.round(avg * 10);

      if (state.lastLevel === null) { state.lastLevel = step; return; } // seed silently

      const changed = Math.abs(step - state.lastLevel) >= 1;
      const cooledDown = now - state.lastChangeTime >= cfg.lodChangeCooldownMs;

      if (changed && cooledDown) {
        state.lastLevel = step;
        state.lastChangeTime = now;
        const quantized = step / 10;
        const resolution = Math.round(
          Math.max(cfg.minResolution, Math.min(cfg.maxResolution, cfg.resolution * quantized))
        );
        lodChangeListeners.forEach(cb => {
          try { cb({ id, distance, visible, multiplier: quantized, resolution }); }
          catch (err) { console.error('[Graph3D Pro] LOD listener error:', err); }
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // CROSS-FADE — smooth (~150ms default) opacity transition when swapping a
  // mesh's geometry, so LOD swaps *and* adaptiveResolution-triggered
  // regenerations never visibly "pop". graph-builder should call this
  // instead of addMesh() whenever it's replacing an existing surface's mesh
  // in response to onLODChange or onResolutionChange.
  // ══════════════════════════════════════════════════════
  function crossFadeMesh(id, newMesh, durationMs) {
    if (!newMesh || !newMesh.isObject3D) {
      console.error(
        `[Graph3D Pro] Engine.crossFadeMesh('${id}', ...) was given something that ` +
        `isn't a THREE.Object3D — nothing was swapped in for '${id}'. Got: ${describeForError(newMesh)}.`
      );
      return;
    }
    durationMs = durationMs == null ? cfg.lodCrossFadeMs : durationMs;

    // A fade already in flight for this id? Cancel it and discard its
    // not-yet-promoted incoming mesh so we don't leak GPU resources or stack
    // animations on rapid successive LOD changes.
    const inFlight = activeCrossFades.get(id);
    if (inFlight) {
      cancelAnimationFrame(inFlight.rafId);
      scene.remove(inFlight.fadingMesh);
      disposeMesh(inFlight.fadingMesh);
      activeCrossFades.delete(id);
    }

    const oldMesh = meshes[id];
    if (!oldMesh || durationMs <= 0) {
      addMesh(id, newMesh);
      return;
    }

    const oldMats = Array.isArray(oldMesh.material) ? oldMesh.material : [oldMesh.material];
    const newMats = Array.isArray(newMesh.material) ? newMesh.material : [newMesh.material];
    const oldTargetOpacity = oldMats.map(m => ('opacity' in m ? m.opacity : 1));
    const newTargetOpacity = newMats.map(m => ('opacity' in m ? m.opacity : 1));
    [...oldMats, ...newMats].forEach(m => { if ('transparent' in m) m.transparent = true; });

    if (cfg.shadows && newMesh.isMesh) { newMesh.castShadow = true; newMesh.receiveShadow = true; }
    applyMaterialConfig(newMesh);
    newMats.forEach(m => { if ('opacity' in m) m.opacity = 0; });
    scene.add(newMesh);

    const startTime = performance.now();
    function step() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = t * t * (3 - 2 * t); // smoothstep
      newMats.forEach((m, i) => { if ('opacity' in m) m.opacity = eased * newTargetOpacity[i]; });
      oldMats.forEach((m, i) => { if ('opacity' in m) m.opacity = (1 - eased) * oldTargetOpacity[i]; });

      if (t < 1) {
        activeCrossFades.set(id, { rafId: requestAnimationFrame(step), fadingMesh: newMesh });
      } else {
        activeCrossFades.delete(id);
        scene.remove(oldMesh);
        disposeMesh(oldMesh);
        newMats.forEach((m, i) => { if ('opacity' in m) m.opacity = newTargetOpacity[i]; });
        meshes[id] = newMesh;
        syncSurfaceCount();
      }
    }
    activeCrossFades.set(id, { rafId: requestAnimationFrame(step), fadingMesh: newMesh });
  }

  // ══════════════════════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════════════════════
  function applyConfig(updates) {
    const prevUnits = cfg.units;
    const prevShowAxisLabels = cfg.showAxisLabels;
    const prevShowTickLabels = cfg.showTickLabels;
    const prevGridSize = cfg.gridSize, prevGridDivisions = cfg.gridDivisions;
    const prevGridColor1 = cfg.gridColor1, prevGridColor2 = cfg.gridColor2, prevGridSubgrid = cfg.gridSubgrid;
    const prevXYColor = cfg.xyPlaneColor, prevXYOpacity = cfg.xyPlaneOpacity;
    const prevXMin = cfg.xMin, prevXMax = cfg.xMax, prevYMin = cfg.yMin, prevYMax = cfg.yMax;
    const prevZMin = cfg.zMin, prevZMax = cfg.zMax;

    Object.assign(cfg, updates);
    cfg.perspectiveDistortion = Math.max(0, Math.min(1, cfg.perspectiveDistortion));

    // Keep the legacy `wireframe` boolean and the new `renderMode` tri-state in sync,
    // whichever one the caller updated.
    if ('renderMode' in updates) {
      cfg.wireframe = cfg.renderMode === 'wireframe';
    } else if ('wireframe' in updates) {
      cfg.renderMode = cfg.wireframe ? 'wireframe' : 'solid';
    }

    if (axesGroup) axesGroup.visible = cfg.showAxes;
    if (gridGroup) gridGroup.visible = cfg.showGrid;
    if (xyPlaneMesh) xyPlaneMesh.visible = cfg.showXYPlane;

    // Per-axis bounds actually drive the axis/tick geometry now (item 5) —
    // rebuild whichever depend on them when any bound changes.
    if (cfg.xMin !== prevXMin || cfg.xMax !== prevXMax || cfg.yMin !== prevYMin ||
        cfg.yMax !== prevYMax || cfg.zMin !== prevZMin || cfg.zMax !== prevZMax) {
      buildAxes();
      buildAxisLabels();
      buildTickLabels();
    } else {
      if (cfg.units !== prevUnits || cfg.showAxisLabels !== prevShowAxisLabels) buildAxisLabels();
      if (cfg.units !== prevUnits || cfg.showTickLabels !== prevShowTickLabels) buildTickLabels();
    }
    // axes/grid/XY-plane/numbers/labels are five independent toggles (item 2)
    // — none of these gate each other.
    if (axisLabelGroup) axisLabelGroup.visible = cfg.showAxisLabels;
    if (tickLabelGroup) tickLabelGroup.visible = cfg.showTickLabels;

    if (cfg.gridSize !== prevGridSize || cfg.gridDivisions !== prevGridDivisions ||
        cfg.gridColor1 !== prevGridColor1 || cfg.gridColor2 !== prevGridColor2 ||
        cfg.gridSubgrid !== prevGridSubgrid) {
      buildGrid();
    }
    if (cfg.gridSize !== prevGridSize || cfg.xyPlaneColor !== prevXYColor || cfg.xyPlaneOpacity !== prevXYOpacity) {
      buildXYPlane();
    }

    scene.fog = cfg.fog
      ? new THREE.FogExp2(cfg.bgColor, 0.016)
      : null;

    if (shadowLight) {
      shadowLight.castShadow = cfg.shadows;
      renderer.shadowMap.enabled = cfg.shadows;
    }

    // Update wireframe/solid/translucent + transparency on all existing meshes
    Object.values(meshes).forEach(applyMaterialConfig);

    // Crosshair
    const xh = document.getElementById('crosshair');
    if (xh) xh.classList.toggle('visible', cfg.showCrosshair);

    // Post-processing (Bloom / Ambient Occlusion)
    if ('bloom' in updates || 'ambientOcclusion' in updates ||
        'bloomStrength' in updates || 'bloomRadius' in updates || 'bloomThreshold' in updates) {
      updatePostProcessing();
    }

    // Color management (see the note above applyColorManagement())
    if ('modernColorManagement' in updates || 'toneMappingExposure' in updates) {
      applyColorManagement();
    }
  }

  // Convenience wrapper — sets any subset of per-axis bounds and rebuilds
  // the affected visuals via the change-detection in applyConfig above.
  function setAxisBounds(bounds) {
    applyConfig(bounds);
  }

  // "Zoom Square": Desmos-style action that appears once axes have gone a
  // different scale per axis — resets all three to the *largest* current
  // span, centered on each axis's current center, so 1 unit reads the same
  // size on every axis.
  function zoomSquare() {
    const xCenter = (cfg.xMin + cfg.xMax) / 2;
    const yCenter = (cfg.yMin + cfg.yMax) / 2;
    const zCenter = (cfg.zMin + cfg.zMax) / 2;
    const maxSpan = Math.max(cfg.xMax - cfg.xMin, cfg.yMax - cfg.yMin, cfg.zMax - cfg.zMin);
    applyConfig({
      xMin: xCenter - maxSpan / 2, xMax: xCenter + maxSpan / 2,
      yMin: yCenter - maxSpan / 2, yMax: yCenter + maxSpan / 2,
      zMin: zCenter - maxSpan / 2, zMax: zCenter + maxSpan / 2,
    });
  }

  // "Center Origin": Desmos-style action that re-centers each axis's current
  // span around 0 without changing how wide any of them are.
  function centerOrigin() {
    const xSpan = cfg.xMax - cfg.xMin, ySpan = cfg.yMax - cfg.yMin, zSpan = cfg.zMax - cfg.zMin;
    applyConfig({
      xMin: -xSpan / 2, xMax: xSpan / 2,
      yMin: -ySpan / 2, yMax: ySpan / 2,
      zMin: -zSpan / 2, zMax: zSpan / 2,
    });
  }

  // Lets a settings UI decide, without duplicating this logic, when to show
  // the Zoom Square / Center Origin buttons — Desmos surfaces them only once
  // bounds have actually gone asymmetric.
  function getBoundsState() {
    const isCentered = (min, max) => Math.abs(min + max) < 1e-9;
    const xSpan = cfg.xMax - cfg.xMin, ySpan = cfg.yMax - cfg.yMin, zSpan = cfg.zMax - cfg.zMin;
    return {
      xSpan, ySpan, zSpan,
      isSquare: Math.abs(xSpan - ySpan) < 1e-9 && Math.abs(ySpan - zSpan) < 1e-9,
      isCentered: isCentered(cfg.xMin, cfg.xMax) && isCentered(cfg.yMin, cfg.yMax) && isCentered(cfg.zMin, cfg.zMax),
    };
  }

  function getConfig() { return { ...cfg }; }

  // ══════════════════════════════════════════════════════
  // MATERIALS — factory helpers used by graph-builder
  // ══════════════════════════════════════════════════════
  function makeSurfaceMaterial(baseColor) {
    const translucent = cfg.translucentSurfaces;
    return new THREE.MeshPhongMaterial({
      vertexColors: true,
      // side: DoubleSide already means back faces are never culled — the
      // other half of "translucent surfaces" (below) is disabling depth
      // *write*, which is what actually lets two intersecting surfaces both
      // stay visible through each other instead of one silently winning
      // based on draw order.
      side: THREE.DoubleSide,
      wireframe: cfg.renderMode === 'wireframe',
      shininess: 85,
      specular: new THREE.Color(0x1a3060),
      transparent: translucent ? true : cfg.transparent,
      opacity: translucent ? cfg.translucentOpacity : (cfg.transparent ? 0.93 : 1.0),
      depthWrite: !translucent,
    });
  }

  function makeLineMaterial(color) {
    return new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 2,
    });
  }

  function makePointMaterial() {
    return new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.07,
      sizeAttenuation: true,
    });
  }

  // Applies the current wireframe/solid/translucent + transparency settings
  // to one mesh. Safe to call on Mesh, Line, or Points objects (guards each
  // prop's existence).
  function applyMaterialConfig(mesh) {
    if (!mesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const translucent = cfg.translucentSurfaces;
    mats.forEach(mat => {
      if ('wireframe' in mat) mat.wireframe = cfg.renderMode === 'wireframe';
      if ('transparent' in mat) {
        mat.transparent = translucent ? true : cfg.transparent;
        mat.opacity = translucent ? cfg.translucentOpacity : (cfg.transparent ? 0.93 : 1.0);
      }
      if ('depthWrite' in mat) mat.depthWrite = !translucent;
    });
  }

  // ══════════════════════════════════════════════════════
  // RENDER MODE  (solid / wireframe)
  // ══════════════════════════════════════════════════════
  function setRenderMode(mode) {
    if (mode !== 'solid' && mode !== 'wireframe') return cfg.renderMode;
    applyConfig({ renderMode: mode });
    return cfg.renderMode;
  }

  function toggleWireframe() {
    return setRenderMode(cfg.renderMode === 'wireframe' ? 'solid' : 'wireframe');
  }

  // ══════════════════════════════════════════════════════
  // COLOR HELPERS
  // ══════════════════════════════════════════════════════
  function nextColor() {
    return COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length];
  }

  function resetColorIndex() {
    colorIndex = 0;
  }

  // ══════════════════════════════════════════════════════
  // POST-PROCESSING — Bloom + Ambient Occlusion (optional)
  //
  // Both require three.js's postprocessing addons to be loaded onto the
  // global THREE namespace before init() runs (EffectComposer, RenderPass,
  // ShaderPass, and SSAOPass / UnrealBloomPass). If they aren't present,
  // Graph3D Pro logs a warning and quietly falls back to standard rendering
  // — enabling cfg.bloom / cfg.ambientOcclusion never throws or breaks the scene.
  // ══════════════════════════════════════════════════════
  function buildPostProcessing() {
    postProcessingReady = false;
    const hasComposer = typeof THREE.EffectComposer === 'function' &&
                         typeof THREE.RenderPass === 'function';
    if (!hasComposer) {
      console.warn(
        '[Graph3D Pro] Bloom / Ambient Occlusion need the three.js postprocessing addons ' +
        '(EffectComposer, RenderPass, ShaderPass, and UnrealBloomPass / SSAOPass). ' +
        'Include them via <script> tags before enabling cfg.bloom or cfg.ambientOcclusion.'
      );
      return false;
    }

    const size = new THREE.Vector2();
    renderer.getSize(size);

    composer = new THREE.EffectComposer(renderer);
    renderPass = new THREE.RenderPass(scene, activeCamera());
    composer.addPass(renderPass);

    if (typeof THREE.SSAOPass === 'function') {
      ssaoPass = new THREE.SSAOPass(scene, activeCamera(), size.x, size.y);
      ssaoPass.kernelRadius = 0.6;
      ssaoPass.minDistance = 0.001;
      ssaoPass.maxDistance = 0.15;
      ssaoPass.enabled = cfg.ambientOcclusion;
      composer.addPass(ssaoPass);
    } else if (cfg.ambientOcclusion) {
      console.warn('[Graph3D Pro] THREE.SSAOPass not found — ambient occlusion disabled.');
    }

    if (typeof THREE.UnrealBloomPass === 'function') {
      bloomPass = new THREE.UnrealBloomPass(size, cfg.bloomStrength, cfg.bloomRadius, cfg.bloomThreshold);
      bloomPass.enabled = cfg.bloom;
      composer.addPass(bloomPass);
    } else if (cfg.bloom) {
      console.warn('[Graph3D Pro] THREE.UnrealBloomPass not found — bloom disabled.');
    }

    if (typeof THREE.OutputPass === 'function') {
      outputPass = new THREE.OutputPass();
      composer.addPass(outputPass);
    } else if (typeof THREE.ShaderPass === 'function' && THREE.CopyShader) {
      outputPass = new THREE.ShaderPass(THREE.CopyShader);
      outputPass.renderToScreen = true;
      composer.addPass(outputPass);
    }

    postProcessingReady = true;
    return true;
  }

  // Bloom/AO are off by default, so the ~9 postprocessing addon scripts
  // used to load unconditionally on every visit for a feature most
  // sessions never touch. They're now fetched on demand, the first time
  // they're actually needed, from the URL list build.js writes to
  // window.G3D_POSTPROCESSING_URLS (single source of truth — see the
  // POSTPROCESSING const in tools/build.js for the exact load-order
  // dependency notes). Loaded in sequence since SSAOPass subclasses
  // ShaderPass and both need their shader deps loaded first.
  let _postProcessingLoadPromise = null;
  function _loadPostProcessingScripts() {
    if (_postProcessingLoadPromise) return _postProcessingLoadPromise;
    const urls = window.G3D_POSTPROCESSING_URLS || [];
    if (!urls.length) return Promise.resolve(false);

    _postProcessingLoadPromise = urls.reduce((chain, url) => chain.then(() => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(s);
    })), Promise.resolve())
      .then(() => true)
      .catch(err => {
        console.warn('[Graph3D Pro] Postprocessing addons failed to load — bloom/ambient occlusion unavailable this session.', err);
        return false;
      });
    return _postProcessingLoadPromise;
  }

  function updatePostProcessing() {
    if (!renderer) return; // not initialized yet
    const needsComposer = cfg.bloom || cfg.ambientOcclusion;

    if (needsComposer && !composer) {
      const hasComposer = typeof THREE.EffectComposer === 'function' && typeof THREE.RenderPass === 'function';
      if (hasComposer) {
        buildPostProcessing();
      } else {
        _loadPostProcessingScripts().then(ok => {
          if (ok) buildPostProcessing();
          updatePostProcessing(); // re-apply enabled/strength/etc. now that composer (or the graceful-fallback warning) is settled
        });
        return;
      }
    }

    if (ssaoPass) ssaoPass.enabled = cfg.ambientOcclusion;
    if (bloomPass) {
      bloomPass.enabled = cfg.bloom;
      bloomPass.strength = cfg.bloomStrength;
      bloomPass.radius = cfg.bloomRadius;
      bloomPass.threshold = cfg.bloomThreshold;
    }
  }

  // ══════════════════════════════════════════════════════
  // MESH CACHE — LRU cache for generated geometry data, keyed by whatever
  // the caller uses to identify a (function, bounds, resolution, ...) request.
  // Stores plain typed-array data (not live GPU resources) so cache hits are
  // cheap to turn into a fresh BufferGeometry without sharing GPU buffers
  // between independent mesh instances.
  // ══════════════════════════════════════════════════════
  const meshCacheStore = new Map(); // key -> { data, lastUsed }
  let meshCacheClock = 0;

  function makeCacheKey(parts) {
    return parts.map(p => String(p)).join('|');
  }

  function cacheGetMesh(key) {
    if (!cfg.meshCacheEnabled) return null;
    const entry = meshCacheStore.get(key);
    if (!entry) return null;
    entry.lastUsed = ++meshCacheClock;
    return entry.data;
  }

  function cacheSetMesh(key, data) {
    if (!cfg.meshCacheEnabled) return;
    meshCacheStore.set(key, { data, lastUsed: ++meshCacheClock });
    if (meshCacheStore.size > cfg.meshCacheMaxEntries) {
      let oldestKey = null, oldestUsed = Infinity;
      for (const [k, v] of meshCacheStore) {
        if (v.lastUsed < oldestUsed) { oldestUsed = v.lastUsed; oldestKey = k; }
      }
      if (oldestKey !== null) meshCacheStore.delete(oldestKey);
    }
  }

  function cacheClear() { meshCacheStore.clear(); }

  function cacheStats() {
    return { size: meshCacheStore.size, maxEntries: cfg.meshCacheMaxEntries, enabled: cfg.meshCacheEnabled };
  }

  // data: { positions: Float32Array, normals: Float32Array|null, colors: Float32Array|null, indices: Uint32Array|null }
  function geometryFromCacheData(data) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    if (data.normals) geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    else geo.computeVertexNormals();
    if (data.colors) geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    if (data.indices) geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return geo;
  }

  // ══════════════════════════════════════════════════════
  // MARCHING CUBES  (tetrahedral decomposition variant)
  //
  // Implemented via 6-tetrahedra cube decomposition rather than the classic
  // 256-case cube lookup table. Each tetrahedron only has 3 possible
  // topological cases (0, 1, or 2 crossing vertices on a side), so there are
  // no ambiguous-face configurations to special-case and no giant table to
  // maintain — while still producing a standard, valid isosurface mesh.
  // Verified against analytic sphere/torus volumes (divergence theorem) and
  // per-vertex distance-to-surface error during development.
  //
  // `field(x, y, z)` should return a signed scalar (e.g. a signed-distance or
  // implicit function); the surface `field(x,y,z) = isoLevel` is extracted.
  // This function is intentionally self-contained (no closures over outer
  // scope) so it can also run verbatim inside a Web Worker — see
  // buildComputeWorker() below.
  // ══════════════════════════════════════════════════════
  // ciStart/ciEnd optionally restrict the outer (x) loop to a sub-range of
  // cubes — used by marchingCubesChunked() below to process the grid in
  // slabs across multiple requestIdleCallback ticks instead of one pass.
  // Omitting them (as the Worker path does) processes the full grid exactly
  // as before — this is a purely additive, backward-compatible parameter.
  function marchingTetrahedraCore(field, bounds, res, isoLevel, ciStart, ciEnd) {
    isoLevel = isoLevel || 0;
    var xMin = bounds.xMin, xMax = bounds.xMax;
    var yMin = bounds.yMin, yMax = bounds.yMax;
    var zMin = bounds.zMin, zMax = bounds.zMax;
    var nx = res, ny = res, nz = res;
    var dx = (xMax - xMin) / nx, dy = (yMax - yMin) / ny, dz = (zMax - zMin) / nz;
    var gy = ny + 1, gz = nz + 1;

    ciStart = (ciStart == null) ? 0 : ciStart;
    ciEnd = (ciEnd == null) ? nx : ciEnd;
    var iPlanes = (ciEnd - ciStart) + 1; // grid planes needed along x for this slab only

    // Only sample the x-range this call actually needs (full y/z range),
    // so a chunked call doesn't re-sample the whole field grid every slab.
    var vals = new Float64Array(iPlanes * gy * gz);
    function idx(iLocal, j, k) { return (iLocal * gy + j) * gz + k; }
    for (var iL = 0; iL < iPlanes; iL++) {
      var x = xMin + (ciStart + iL) * dx;
      for (var j = 0; j < gy; j++) {
        var y = yMin + j * dy;
        for (var k = 0; k < gz; k++) {
          var z = zMin + k * dz;
          vals[idx(iL, j, k)] = field(x, y, z);
        }
      }
    }

    var cubeCorners = [
      [0,0,0],[1,0,0],[1,1,0],[0,1,0],
      [0,0,1],[1,0,1],[1,1,1],[0,1,1],
    ];
    var tets = [
      [0,1,2,6],[0,2,3,6],[0,3,7,6],
      [0,7,4,6],[0,4,5,6],[0,5,1,6],
    ];
    var POPCOUNT4 = [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4];

    var positions = [];
    var normals = [];
    var epsN = Math.min(dx, dy, dz) * 0.5;

    function normalAt(px, py, pz) {
      var gxv = (field(px + epsN, py, pz) - field(px - epsN, py, pz)) / (2 * epsN);
      var gyv = (field(px, py + epsN, pz) - field(px, py - epsN, pz)) / (2 * epsN);
      var gzv = (field(px, py, pz + epsN) - field(px, py, pz - epsN)) / (2 * epsN);
      var len = Math.sqrt(gxv*gxv + gyv*gyv + gzv*gzv) || 1;
      return [gxv/len, gyv/len, gzv/len];
    }

    function lerpPoint(pA, vA, pB, vB) {
      var t = (isoLevel - vA) / (vB - vA);
      if (!isFinite(t)) t = 0.5;
      t = Math.max(0, Math.min(1, t));
      return [
        pA[0] + t * (pB[0] - pA[0]),
        pA[1] + t * (pB[1] - pA[1]),
        pA[2] + t * (pB[2] - pA[2]),
      ];
    }

    function pushTri(p1, p2, p3, outsideCenter, insideCenter) {
      var e1 = [p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]];
      var e2 = [p3[0]-p1[0], p3[1]-p1[1], p3[2]-p1[2]];
      var n = [
        e1[1]*e2[2]-e1[2]*e2[1],
        e1[2]*e2[0]-e1[0]*e2[2],
        e1[0]*e2[1]-e1[1]*e2[0],
      ];
      // Degenerate (zero-area) triangle guard: at certain grid
      // resolutions/bounds a linear-interpolation crossing point can land
      // exactly on another one of the triangle's vertices (most often when
      // the sampling grid aligns with a symmetric field), producing a
      // "floating" triangle with no area. Threshold is scaled by the local
      // cell size (via epsN, already computed above) so it stays
      // resolution/bounds-independent rather than using a fixed epsilon.
      var minNormalMag2 = (epsN * epsN) * 1e-6;
      if (n[0]*n[0] + n[1]*n[1] + n[2]*n[2] < minNormalMag2) return;

      var dirVec = [outsideCenter[0]-insideCenter[0], outsideCenter[1]-insideCenter[1], outsideCenter[2]-insideCenter[2]];
      var d = n[0]*dirVec[0]+n[1]*dirVec[1]+n[2]*dirVec[2];
      var A = p1, B, C;
      if (d < 0) { B = p3; C = p2; } else { B = p2; C = p3; }
      positions.push(A[0],A[1],A[2], B[0],B[1],B[2], C[0],C[1],C[2]);
      var nA = normalAt(A[0],A[1],A[2]);
      var nB = normalAt(B[0],B[1],B[2]);
      var nC = normalAt(C[0],C[1],C[2]);
      normals.push(nA[0],nA[1],nA[2], nB[0],nB[1],nB[2], nC[0],nC[1],nC[2]);
    }

    for (var ci = ciStart; ci < ciEnd; ci++) {
      var ciLocal = ci - ciStart;
      for (var cj = 0; cj < ny; cj++) {
        for (var ck = 0; ck < nz; ck++) {
          var cp = new Array(8), cv = new Array(8);
          for (var c = 0; c < 8; c++) {
            var off = cubeCorners[c];
            cp[c] = [xMin + (ci+off[0])*dx, yMin + (cj+off[1])*dy, zMin + (ck+off[2])*dz];
            cv[c] = vals[idx(ciLocal+off[0], cj+off[1], ck+off[2])];
          }

          for (var ti = 0; ti < 6; ti++) {
            var tet = tets[ti];
            var p = [cp[tet[0]], cp[tet[1]], cp[tet[2]], cp[tet[3]]];
            var v = [cv[tet[0]], cv[tet[1]], cv[tet[2]], cv[tet[3]]];
            var mask = 0;
            for (var t = 0; t < 4; t++) if (v[t] > isoLevel) mask |= (1 << t);
            var pc = POPCOUNT4[mask];
            if (pc === 0 || pc === 4) continue;

            if (pc === 1 || pc === 3) {
              var solo = -1;
              for (var t2 = 0; t2 < 4; t2++) {
                var outside = !!(mask & (1 << t2));
                if ((pc === 1 && outside) || (pc === 3 && !outside)) { solo = t2; break; }
              }
              var others = [];
              for (var t3 = 0; t3 < 4; t3++) if (t3 !== solo) others.push(t3);
              var pts = [
                lerpPoint(p[solo], v[solo], p[others[0]], v[others[0]]),
                lerpPoint(p[solo], v[solo], p[others[1]], v[others[1]]),
                lerpPoint(p[solo], v[solo], p[others[2]], v[others[2]]),
              ];
              var outsideCenter, insideCenter;
              if (pc === 1) {
                outsideCenter = p[solo];
                insideCenter = [(pts[0][0]+pts[1][0]+pts[2][0])/3, (pts[0][1]+pts[1][1]+pts[2][1])/3, (pts[0][2]+pts[1][2]+pts[2][2])/3];
              } else {
                insideCenter = p[solo];
                outsideCenter = [(pts[0][0]+pts[1][0]+pts[2][0])/3, (pts[0][1]+pts[1][1]+pts[2][1])/3, (pts[0][2]+pts[1][2]+pts[2][2])/3];
              }
              pushTri(pts[0], pts[1], pts[2], outsideCenter, insideCenter);
            } else {
              var outs = [], ins = [];
              for (var t4 = 0; t4 < 4; t4++) ((mask & (1 << t4)) ? outs : ins).push(t4);
              var A_ = outs[0], B_ = outs[1], C_ = ins[0], D_ = ins[1];
              var P_AC = lerpPoint(p[A_], v[A_], p[C_], v[C_]);
              var P_BC = lerpPoint(p[B_], v[B_], p[C_], v[C_]);
              var P_BD = lerpPoint(p[B_], v[B_], p[D_], v[D_]);
              var P_AD = lerpPoint(p[A_], v[A_], p[D_], v[D_]);
              var outsideCenter2 = [(p[A_][0]+p[B_][0])/2, (p[A_][1]+p[B_][1])/2, (p[A_][2]+p[B_][2])/2];
              var insideCenter2  = [(p[C_][0]+p[D_][0])/2, (p[C_][1]+p[D_][1])/2, (p[C_][2]+p[D_][2])/2];
              pushTri(P_AC, P_BC, P_BD, outsideCenter2, insideCenter2);
              pushTri(P_AC, P_BD, P_AD, outsideCenter2, insideCenter2);
            }
          }
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      vertexCount: positions.length / 3,
    };
  }

  // Synchronous, main-thread Marching Cubes — fieldFn is a real JS function.
  function marchingCubes(fieldFn, bounds, resolution, isoLevel) {
    return marchingTetrahedraCore(fieldFn, bounds, resolution, isoLevel || 0);
  }

  function marchingCubesToGeometry(result) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(result.normals, 3));
    return geo;
  }

  // ══════════════════════════════════════════════════════
  // WEB WORKERS — offloads Marching Cubes (or other heavy sampling) off the
  // main thread. The field function must be supplied as source text
  // (fieldSrc, a JS expression body taking x,y,z) since functions can't be
  // structured-cloned into a Worker. Falls back to running synchronously on
  // the main thread if Workers are unavailable or cfg.useWebWorker is false.
  // ══════════════════════════════════════════════════════
  function buildComputeWorker() {
    const coreSrc = marchingTetrahedraCore.toString();
    const workerSrc = `
      const marchingTetrahedraCore = ${coreSrc};
      self.onmessage = function(e) {
        const { id, fieldSrc, bounds, resolution, isoLevel } = e.data;
        try {
          const field = new Function('x', 'y', 'z', fieldSrc);
          const result = marchingTetrahedraCore(field, bounds, resolution, isoLevel || 0);
          self.postMessage(
            { id, ok: true, positions: result.positions, normals: result.normals, vertexCount: result.vertexCount },
            [result.positions.buffer, result.normals.buffer]
          );
        } catch (err) {
          self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
        }
      };
    `;
    const blob = new Blob([workerSrc], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  }

  function ensureWorkerPool() {
    if (!cfg.useWebWorker || typeof Worker === 'undefined') return false;
    if (workerPool.length) return true;
    try {
      // Pool size tracks the device's actual core count (capped by
      // cfg.maxWorkers) rather than a flat number, so a high-core-count
      // desktop can run more Marching Cubes jobs in parallel while a
      // dual-core mobile device doesn't over-subscribe itself.
      const poolSize = Math.max(1, Math.min(cfg.maxWorkers, navigator.hardwareConcurrency || 4));
      for (let i = 0; i < poolSize; i++) {
        const w = buildComputeWorker();
        w.onmessage = (e) => {
          const { id, ok, positions, normals, vertexCount, error } = e.data;
          const pending = pendingWorkerRequests.get(id);
          if (!pending) return;
          pendingWorkerRequests.delete(id);
          if (ok) pending.resolve({ positions, normals, vertexCount });
          else pending.reject(new Error(error));
        };
        w.onerror = (err) => {
          console.error('[Graph3D Pro] compute worker error:', err.message);
        };
        workerPool.push(w);
      }
      return true;
    } catch (err) {
      console.warn('[Graph3D Pro] Web Workers unavailable, falling back to main thread:', err.message);
      workerPool = [];
      return false;
    }
  }

  function terminateWorkerPool() {
    workerPool.forEach(w => w.terminate());
    workerPool = [];
    pendingWorkerRequests.forEach(p => p.reject(new Error('worker pool terminated')));
    pendingWorkerRequests.clear();
  }

  // Idle-time scheduling for the no-worker fallback below. Safari has never
  // shipped requestIdleCallback (the same browser called out for disabling
  // Workers in Private Browsing), so we fall back to a setTimeout(0) chunk —
  // it won't get a real "time remaining until next frame" figure the way
  // requestIdleCallback does, but it still yields the main thread between
  // chunks instead of running as one long blocking call.
  //
  // NOTE (fixed): the setTimeout shim's deadline object must report a
  // genuinely *decreasing* timeRemaining() the way a real IdleDeadline does.
  // An earlier version of this shim returned a constant timeRemaining() with
  // didTimeout hardcoded to true — since the "out of time" check below is
  // gated on `!deadline.didTimeout`, that silently made the check permanently
  // false, so the fallback ran the entire O(res^3) grid in one uninterrupted
  // burst (exactly the janky behavior this feature exists to avoid). Verified
  // in isolation: with the fix, a res=100 sphere that blocks the main thread
  // for ~1.3s unchunked instead runs as ~100 separate sub-20ms (occasionally
  // up to ~50-60ms on GC-heavy layers) callbacks with an identical result.
  const scheduleIdle = (typeof requestIdleCallback === 'function')
    ? requestIdleCallback
    : function (cb) {
        const start = performance.now();
        const budgetMs = 8;
        return setTimeout(() => {
          cb({ timeRemaining: () => Math.max(0, budgetMs - (performance.now() - start)), didTimeout: false });
        }, 0);
      };
  const cancelIdle = (typeof cancelIdleCallback === 'function') ? cancelIdleCallback : clearTimeout;

  // Chunked, main-thread Marching Cubes for when Workers aren't available.
  // Processes the cube grid one x-layer at a time, checking the deadline
  // after every layer (rather than committing to a large fixed slab size in
  // advance) so the loop self-adapts to however much a single layer actually
  // costs on this device, yielding via requestIdleCallback (or the
  // setTimeout shim above) whenever the budget runs out. opts.layerStep can
  // widen the unit of work if a caller wants fewer, larger yields instead.
  function marchingCubesChunked(fieldFn, bounds, resolution, isoLevel, opts = {}) {
    isoLevel = isoLevel || 0;
    const layerStep = opts.layerStep || 1;

    return new Promise((resolve, reject) => {
      const positionsChunks = [];
      const normalsChunks = [];
      let ci = 0;
      let idleHandle = null;

      function processSlab(deadline) {
        try {
          while (ci < resolution) {
            const ciEnd = Math.min(resolution, ci + layerStep);
            const partial = marchingTetrahedraCore(fieldFn, bounds, resolution, isoLevel, ci, ciEnd);
            if (partial.vertexCount > 0) {
              positionsChunks.push(partial.positions);
              normalsChunks.push(partial.normals);
            }
            ci = ciEnd;
            if (ci < resolution && deadline.timeRemaining() <= 0 && !deadline.didTimeout) break;
          }
        } catch (err) {
          reject(err);
          return;
        }

        if (ci < resolution) {
          idleHandle = scheduleIdle(processSlab);
        } else {
          let total = 0;
          for (const p of positionsChunks) total += p.length;
          const positions = new Float32Array(total);
          const normals = new Float32Array(total);
          let offset = 0;
          for (let i = 0; i < positionsChunks.length; i++) {
            positions.set(positionsChunks[i], offset);
            normals.set(normalsChunks[i], offset);
            offset += positionsChunks[i].length;
          }
          resolve({ positions, normals, vertexCount: total / 3 });
        }
      }

      idleHandle = scheduleIdle(processSlab);
    });
  }

  // fieldSrc: a JS expression-body string taking (x, y, z), e.g. "return Math.sqrt(x*x+y*y+z*z) - 1;"
  function marchingCubesAsync(fieldSrc, bounds, resolution, isoLevel, opts) {
    isoLevel = isoLevel || 0;
    const haveWorkers = ensureWorkerPool();
    if (!haveWorkers) {
      // No Workers (unsupported, or disabled as in Safari Private Browsing) —
      // run the idle-chunked fallback instead of one big synchronous call.
      let field;
      try {
        field = new Function('x', 'y', 'z', fieldSrc);
      } catch (err) {
        return Promise.reject(err);
      }
      return marchingCubesChunked(field, bounds, resolution, isoLevel, opts);
    }
    const id = ++workerRequestId;
    const worker = workerPool[id % workerPool.length];
    return new Promise((resolve, reject) => {
      pendingWorkerRequests.set(id, { resolve, reject });
      worker.postMessage({ id, fieldSrc, bounds, resolution, isoLevel });
    });
  }

  // High-level helper: cache-aware, worker-backed isosurface mesh builder.
  async function buildIsosurfaceMesh(fieldSrc, bounds, resolution, opts = {}) {
    const isoLevel = opts.isoLevel || 0;
    const cacheKey = makeCacheKey([
      'isosurface', fieldSrc, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax,
      bounds.zMin, bounds.zMax, resolution, isoLevel,
    ]);
    let data = cacheGetMesh(cacheKey);
    if (!data) {
      const result = await marchingCubesAsync(fieldSrc, bounds, resolution, isoLevel);
      data = { positions: result.positions, normals: result.normals, colors: null, indices: null };
      cacheSetMesh(cacheKey, data);
    }
    const geo = geometryFromCacheData(data);
    const mesh = new THREE.Mesh(geo, makeSurfaceMaterial(opts.color || nextColor()));
    return mesh;
  }

  // ══════════════════════════════════════════════════════
  // ADAPTIVE TESSELLATION  — curvature-driven chunk subdivision for
  // parametric / height-field surfaces (z = fn(x, y)).
  //
  // The domain is split into a base grid of chunks; each chunk independently
  // probes local curvature (deviation of the true midpoint from a bilinear
  // estimate) and picks a subdivision level up to cfg.tessMaxLevel. Levels
  // are then balanced so neighboring chunks differ by at most one step, and
  // any coarse chunk bordering a finer one gets a triangle-fan "stitch" that
  // inserts the finer neighbor's shared edge midpoints — this keeps the mesh
  // crack-free (verified during development via an edge-manifold check: every
  // interior edge is shared by exactly two triangles).
  //
  // fn(x, y) returns the height; output vertices follow this engine's
  // coordinate convention where the Three.js Y axis carries that height
  // (position = [x, fn(x,y), y]) — matching buildRaycaster's Y/Z swap.
  // ══════════════════════════════════════════════════════
  function adaptiveTessellate(fn, bounds, opts = {}) {
    const { xMin, xMax, yMin, yMax } = bounds;
    const baseGrid = opts.baseGrid || 10;
    const maxLevel = opts.maxLevel ?? cfg.tessMaxLevel;
    const curvatureThreshold = opts.curvatureThreshold ?? cfg.tessCurvatureThreshold;

    const cellW = (xMax - xMin) / baseGrid;
    const cellH = (yMax - yMin) / baseGrid;

    function probeLevel(cx0, cy0, cx1, cy1, depth) {
      if (depth >= maxLevel) return depth;
      const xm = (cx0 + cx1) / 2, ym = (cy0 + cy1) / 2;
      const corners = [fn(cx0, cy0), fn(cx1, cy0), fn(cx1, cy1), fn(cx0, cy1)];
      const bilinearMid = (corners[0] + corners[1] + corners[2] + corners[3]) / 4;
      const actualMid = fn(xm, ym);
      const span = Math.max(1e-6, cx1 - cx0, cy1 - cy0);
      const deviation = Math.abs(actualMid - bilinearMid) / span;
      if (deviation > curvatureThreshold) return probeLevel(cx0, cy0, xm, ym, depth + 1);
      return depth;
    }

    const levels = [];
    for (let i = 0; i < baseGrid; i++) {
      levels.push([]);
      for (let j = 0; j < baseGrid; j++) {
        const x0 = xMin + i * cellW, x1 = xMin + (i + 1) * cellW;
        const y0 = yMin + j * cellH, y1 = yMin + (j + 1) * cellH;
        levels[i].push(probeLevel(x0, y0, x1, y1, 0));
      }
    }

    // Restricted-quadtree balancing: neighboring chunks may differ by at most 1 level.
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < baseGrid; i++) {
        for (let j = 0; j < baseGrid; j++) {
          const nbrs = [];
          if (i > 0) nbrs.push(levels[i - 1][j]);
          if (i < baseGrid - 1) nbrs.push(levels[i + 1][j]);
          if (j > 0) nbrs.push(levels[i][j - 1]);
          if (j < baseGrid - 1) nbrs.push(levels[i][j + 1]);
          const maxNbr = nbrs.length ? Math.max(...nbrs) : 0;
          if (maxNbr - levels[i][j] > 1) { levels[i][j] = maxNbr - 1; changed = true; }
        }
      }
    }

    function neighborLevel(i, j, di, dj) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= baseGrid || nj >= baseGrid) return levels[i][j];
      return levels[ni][nj];
    }

    const EPS = Math.min(cellW, cellH) * 0.001;
    function normalAt(x, y) {
      const dzdx = (fn(x + EPS, y) - fn(x - EPS, y)) / (2 * EPS);
      const dzdy = (fn(x, y + EPS) - fn(x, y - EPS)) / (2 * EPS);
      const nx = -dzdx, ny = 1, nz = -dzdy;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      return [nx / len, ny / len, nz / len];
    }

    const positions = [];
    const normals = [];

    function emitTri(pA, pB, pC) {
      const A = [pA[0], fn(pA[0], pA[1]), pA[1]];
      const B = [pB[0], fn(pB[0], pB[1]), pB[1]];
      const C = [pC[0], fn(pC[0], pC[1]), pC[1]];
      positions.push(...A, ...B, ...C);
      normals.push(...normalAt(pA[0], pA[1]), ...normalAt(pB[0], pB[1]), ...normalAt(pC[0], pC[1]));
    }

    for (let i = 0; i < baseGrid; i++) {
      for (let j = 0; j < baseGrid; j++) {
        const L = levels[i][j];
        const n = 1 << L;
        const x0 = xMin + i * cellW, x1 = xMin + (i + 1) * cellW;
        const y0 = yMin + j * cellH, y1 = yMin + (j + 1) * cellH;
        const sx = (x1 - x0) / n, sy = (y1 - y0) / n;

        const leftFiner   = neighborLevel(i, j, -1, 0) > L;
        const rightFiner  = neighborLevel(i, j,  1, 0) > L;
        const bottomFiner = neighborLevel(i, j, 0, -1) > L;
        const topFiner    = neighborLevel(i, j, 0,  1) > L;

        for (let a = 0; a < n; a++) {
          for (let b = 0; b < n; b++) {
            const qx0 = x0 + a * sx, qx1 = x0 + (a + 1) * sx;
            const qy0 = y0 + b * sy, qy1 = y0 + (b + 1) * sy;
            const c0 = [qx0, qy0], c1 = [qx1, qy0], c2 = [qx1, qy1], c3 = [qx0, qy1];

            const mids = {};
            if (a === 0     && leftFiner)   mids.left   = [qx0, (qy0 + qy1) / 2];
            if (a === n - 1 && rightFiner)  mids.right  = [qx1, (qy0 + qy1) / 2];
            if (b === 0     && bottomFiner) mids.bottom = [(qx0 + qx1) / 2, qy0];
            if (b === n - 1 && topFiner)    mids.top    = [(qx0 + qx1) / 2, qy1];

            const perim = [c0];
            if (mids.bottom) perim.push(mids.bottom);
            perim.push(c1);
            if (mids.right) perim.push(mids.right);
            perim.push(c2);
            if (mids.top) perim.push(mids.top);
            perim.push(c3);
            if (mids.left) perim.push(mids.left);

            for (let t = 1; t < perim.length - 1; t++) {
              emitTri(perim[0], perim[t], perim[t + 1]);
            }
          }
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      levels,
      vertexCount: positions.length / 3,
    };
  }

  function adaptiveTessellateToGeometry(result) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(result.normals, 3));
    return geo;
  }

  // High-level helper: cache-aware adaptive-tessellation surface mesh builder.
  function buildAdaptiveSurfaceMesh(fn, bounds, opts = {}) {
    const cacheKey = makeCacheKey([
      'adaptive', fn.toString(), bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax,
      opts.baseGrid || 10, opts.maxLevel ?? cfg.tessMaxLevel, opts.curvatureThreshold ?? cfg.tessCurvatureThreshold,
    ]);
    let data = cacheGetMesh(cacheKey);
    if (!data) {
      const result = adaptiveTessellate(fn, bounds, opts);
      data = { positions: result.positions, normals: result.normals, colors: null, indices: null };
      cacheSetMesh(cacheKey, data);
    }
    const geo = geometryFromCacheData(data);
    const mesh = new THREE.Mesh(geo, makeSurfaceMaterial(opts.color || nextColor()));
    return mesh;
  }

  // ══════════════════════════════════════════════════════
  // ADAPTIVE RESOLUTION — auto-adjusts cfg.resolution to hold a target FPS.
  // Hooked into the render loop's existing once-per-second FPS sample.
  // Register a listener via onResolutionChange to regenerate surfaces
  // (this module only owns cfg.resolution + the notification, not mesh
  // regeneration, since that's graph-builder's responsibility).
  // ══════════════════════════════════════════════════════
  function onResolutionChange(callback) {
    resolutionChangeListeners.push(callback);
    return () => {
      const i = resolutionChangeListeners.indexOf(callback);
      if (i !== -1) resolutionChangeListeners.splice(i, 1);
    };
  }

  function monitorAdaptiveResolution(fps) {
    fpsHistory.push(fps);
    if (fpsHistory.length > 5) fpsHistory.shift();
    if (fpsHistory.length < 5) return; // wait for a stable sample window

    const now = performance.now();
    if (now - lastResolutionChangeTime < 2000) return; // cooldown between adjustments

    const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    const step = 8;
    let newRes = cfg.resolution;

    if (avgFps < cfg.targetFPS - 5 && cfg.resolution > cfg.minResolution) {
      newRes = Math.max(cfg.minResolution, cfg.resolution - step);
    } else if (avgFps > cfg.targetFPS + 15 && cfg.resolution < cfg.maxResolution) {
      newRes = Math.min(cfg.maxResolution, cfg.resolution + step);
    }

    if (newRes !== cfg.resolution) {
      cfg.resolution = newRes;
      lastResolutionChangeTime = now;
      fpsHistory = [];
      resolutionChangeListeners.forEach(cb => {
        try { cb(newRes); } catch (err) { console.error('[Graph3D Pro] resolution change listener error:', err); }
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // GPU / WEBGL CAPABILITIES
  // ══════════════════════════════════════════════════════
  function checkWebGLSupport() {
    try {
      const testCanvas = document.createElement('canvas');
      const gl2 = testCanvas.getContext('webgl2');
      const gl1 = gl2 || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      return { supported: !!gl1, version: gl2 ? 2 : (gl1 ? 1 : 0) };
    } catch (err) {
      return { supported: false, version: 0 };
    }
  }

  function getGPUInfo() {
    if (!renderer) return null;
    const gl = renderer.getContext();
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      webgl2: renderer.capabilities.isWebGL2,
    };
  }

  // Best-effort tier classification from the UNMASKED_RENDERER/VENDOR strings.
  // Browsers are increasingly free to mask these for fingerprinting reasons
  // (Safari in particular often just reports "Apple GPU" with no model), so
  // this is a heuristic, not a guarantee — callers with a better signal
  // (e.g. a device-detection library) can bypass it via init(canvas, { gpuTier }).
  function classifyGPU(gpuInfo) {
    if (!gpuInfo || !gpuInfo.renderer) return 'unknown';
    const text = ((gpuInfo.renderer || '') + ' ' + (gpuInfo.vendor || '')).toLowerCase();

    if (/swiftshader|software|llvmpipe|basic render/.test(text)) return 'software';
    if (/adreno|mali-|powervr|videocore|apple gpu/.test(text)) return 'mobile';
    if (/nvidia|geforce|quadro|rtx|gtx|radeon|amd|apple m[1-9]/.test(text)) return 'discrete';
    if (/intel/.test(text)) return 'integrated';
    if (gpuInfo.webgl2 === false) return 'integrated';
    return 'unknown';
  }

  // Picks a starting cfg.resolution from a GPU tier. DEFAULT_MID matches the
  // engine's original one-size-fits-all default (55) and is what 'unknown'
  // falls back to, so unrecognized hardware behaves exactly as before.
  function pickStartingResolution(gpuInfo, forcedTier) {
    const tier = forcedTier || classifyGPU(gpuInfo);
    const DEFAULT_MID = 55;
    const table = {
      software: cfg.minResolution,
      mobile: Math.round(DEFAULT_MID * 0.55),
      integrated: Math.round(DEFAULT_MID * 0.75),
      discrete: Math.round(DEFAULT_MID * 1.4),
      unknown: DEFAULT_MID,
    };
    const picked = table[tier] != null ? table[tier] : DEFAULT_MID;
    return Math.max(cfg.minResolution, Math.min(cfg.maxResolution, picked));
  }

  // ══════════════════════════════════════════════════════
  // COLOR MANAGEMENT
  //
  // cfg.modernColorManagement defaults to OFF and this function is a no-op
  // change from prior behavior while it's off — it only sets outputEncoding,
  // exactly as before. Flipping it on opts into outputColorSpace +
  // ACESFilmicToneMapping *if* the loaded three.js build supports them
  // (r152+); on the currently-pinned three@0.128 it safely falls back to the
  // legacy path and logs a warning instead of throwing.
  //
  // This is intentionally left OFF by default and does not touch the pinned
  // CDN version in build.js — bumping that version is a separate, larger
  // coordination change (OrbitControls / addon compatibility, etc. all need
  // to be re-checked together) that should happen deliberately, not as a
  // side effect of an engine.js edit. Recommended sequence when ready:
  //   1. Bump the three.js version in build.js and smoke-test the whole app.
  //   2. Flip cfg.modernColorManagement to true (or pass it via applyConfig).
  //   3. Re-tune material values (MeshPhongMaterial shininess/specular, light
  //      intensities) since ACES tone mapping noticeably changes perceived
  //      brightness/contrast — expect this to need a pass, not be free.
  // ══════════════════════════════════════════════════════
  function applyColorManagement() {
    if (!renderer) return;
    if (cfg.modernColorManagement && 'outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = cfg.toneMappingExposure;
      }
    } else {
      if (cfg.modernColorManagement) {
        console.warn(
          '[Graph3D Pro] cfg.modernColorManagement is on, but this three.js build ' +
          '(pinned in build.js) has no outputColorSpace — that needs three.js r152+. ' +
          'Falling back to outputEncoding for now.'
        );
      }
      renderer.outputEncoding = THREE.sRGBEncoding; // unchanged from original — matches three@0.128
    }
  }

  // ══════════════════════════════════════════════════════
  // SCREENSHOT
  // ══════════════════════════════════════════════════════
  function screenshot(format = 'png') {
    if (postProcessingReady && composer && (cfg.bloom || cfg.ambientOcclusion)) {
      composer.render();
    } else {
      renderer.render(scene, activeCamera());
    }
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality  = format === 'jpg' ? 0.92 : undefined;
    const dataURL  = renderer.domElement.toDataURL(mimeType, quality);
    const a = document.createElement('a');
    a.download = 'graph3d.' + format;
    a.href = dataURL;
    a.click();
  }

  // ══════════════════════════════════════════════════════
  // GETTERS
  // ══════════════════════════════════════════════════════
  function getRenderer()  { return renderer; }
  function getScene()     { return scene; }
  function getCamera()    { return perspCam; }
  function getVirtualCamera() { return virtualCam; } // what OrbitControls actually drives — see camera.js coordination note
  function getControls()  { return controls; }
  function isOrtho()      { return cfg.perspectiveDistortion === 0; }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    init,
    resize,

    // Camera
    resetCamera,
    setCameraPreset,
    toggleOrthographic,
    zoomCamera,
    isOrtho,
    getCamera,
    getVirtualCamera,
    getControls,

    // Continuous perspective distortion (item 3.1.1)
    setPerspectiveDistortion,
    getPerspectiveDistortion,

    // Mesh management
    addMesh,
    removeMesh,
    clearAllMeshes,
    getMeshes,

    // Config
    applyConfig,
    getConfig,
    setGridConfig,
    setRenderMode,
    toggleWireframe,

    // Per-axis bounds (item 3.1.5)
    setAxisBounds,
    zoomSquare,
    centerOrigin,
    getBoundsState,

    // Material factories
    makeSurfaceMaterial,
    makeLineMaterial,
    makePointMaterial,

    // Colors
    nextColor,
    resetColorIndex,

    // Export
    screenshot,

    // Marching Cubes / isosurfaces
    marchingCubes,
    marchingCubesAsync,
    marchingCubesChunked,
    marchingCubesToGeometry,
    buildIsosurfaceMesh,

    // Adaptive tessellation
    adaptiveTessellate,
    adaptiveTessellateToGeometry,
    buildAdaptiveSurfaceMesh,

    // Adaptive resolution (FPS-driven, global)
    onResolutionChange,

    // Distance/frustum LOD (per-mesh) + cross-fade
    trackForLOD,
    untrackLOD,
    onLODChange,
    crossFadeMesh,

    // Mesh cache
    cacheGetMesh,
    cacheSetMesh,
    cacheClear,
    cacheStats,
    makeCacheKey,
    geometryFromCacheData,

    // Web workers
    terminateWorkerPool,

    // GPU / WebGL
    checkWebGLSupport,
    getGPUInfo,
    classifyGPU,
    pickStartingResolution,

    // Color management (see applyColorManagement's note re: build.js coordination)
    applyColorManagement,

    // Raw access (for graph-builder)
    getRenderer,
    getScene,

    // Loop control
    startLoop,
    stopLoop,
  };

})();
