/**
 * Graph3D Pro — camera.js
 * Module 04 — Camera, Controls, Presets, Transitions, Touch, Keyboard,
 *              Auto-Frame, Cursor-Anchored Zoom, Showcase, Gyroscope,
 *              Drag-Rotate Momentum, Perspective-Distortion Blend
 * ~/graph3d-pro/core/camera.js
 */

const Camera = (() => {

  // ── State ──────────────────────────────────────────────
  let _perspCam   = null;
  let _orthoCam   = null;
  let _controls   = null;
  let _renderer   = null;
  let _useOrtho   = false;
  let _animating  = false;
  let _animFrame  = null;

  let _raycaster = null;
  function _getRaycaster() {
    if (!_raycaster) _raycaster = new THREE.Raycaster();
    return _raycaster;
  }
  let _lastInteractionTime = 0;

  // Transition state. The four Vector3 fields are deliberately NOT
  // constructed here (`new THREE.Vector3()` at module-parse time) — this
  // file's top-level scope runs synchronously before the deferred
  // three.js CDN script is guaranteed to have executed, so touching
  // THREE outside of a function body throws "THREE is not defined" on
  // every load. _getRaycaster() right above already uses the correct
  // lazy pattern; this object literal just missed it. They're created
  // lazily on first real use in _transitionTo() below instead, then
  // reused (via .copy()/.set()) on every subsequent transition.
  const _transition = {
    active:   false,
    startPos: null,
    endPos:   null,
    startTarget: null,
    endTarget:   null,
    progress: 0,
    duration: 420, // ms
    startTime: 0,
  };

  // Smooth zoom animation state
  let _zoomAnimFrame = null;

  // Camera presets — positions and targets
  const PRESETS = {
    default:    { pos: [7, 5, 9],       target: [0, 0, 0] },
    top:        { pos: [0, 14, 0.001],  target: [0, 0, 0] },
    front:      { pos: [0, 0.001, 14],  target: [0, 0, 0] },
    back:       { pos: [0, 0.001, -14], target: [0, 0, 0] },
    side:       { pos: [14, 0.001, 0],  target: [0, 0, 0] },
    sideLeft:   { pos: [-14, 0.001, 0], target: [0, 0, 0] },
    iso:        { pos: [8, 8, 8],       target: [0, 0, 0] },
    isoNW:      { pos: [-8, 8, 8],      target: [0, 0, 0] },
    isoSE:      { pos: [8, 8, -8],      target: [0, 0, 0] },
    bottom:     { pos: [0, -14, 0.001], target: [0, 0, 0] },
  };
  // Friendly aliases
  PRESETS.left  = PRESETS.sideLeft;
  PRESETS.right = PRESETS.side;
  PRESETS.home  = PRESETS.default;
  // Desmos-matching names for the flat/tilted pair (see setXYOrientation
  // / setDefaultOrientation below) — same presets, names users coming
  // from Desmos will actually look for.
  PRESETS.xyOrientation = PRESETS.top;
  PRESETS.defaultOrientation = PRESETS.default;

  // Ordered list used for numeric (1-0) keyboard shortcuts
  const PRESET_HOTKEY_ORDER = [
    'default', 'top', 'front', 'back', 'side',
    'sideLeft', 'iso', 'isoNW', 'isoSE', 'bottom',
  ];

  // ── Touch gesture state (single-finger tap / double-tap) ──
  const _touch = {
    startX: 0,
    startY: 0,
    startTime: 0,
    wasMultiTouch: false,
    lastTapTime: 0,
    handlersBound: false,
    doubleTapEnabled: true,
  };
  const TAP_MOVE_THRESHOLD = 10;   // px — max movement to still count as a tap
  const TAP_TIME_THRESHOLD = 250;  // ms — max duration to still count as a tap
  const DOUBLE_TAP_WINDOW  = 300;  // ms — max gap between two taps

  let _touchStartHandler = null;
  let _touchEndHandler   = null;
  let _pendingTapTimer   = null; // disambiguates single tap (show coords) from the first half of a double-tap (reset)

  // ── Cursor/pinch-anchored zoom state ──────────────────
  let _cursorZoomEnabled = true;
  const ZOOM_WHEEL_SENSITIVITY = 0.0018;
  const ZOOM_WHEEL_MIN_FACTOR  = 0.75;
  const ZOOM_WHEEL_MAX_FACTOR  = 1.30;
  const PINCH_MIN_FACTOR       = 0.85;
  const PINCH_MAX_FACTOR       = 1.18;

  const _pinch = { active: false, prevDist: 0, prevMidX: 0, prevMidY: 0 };

  // ── Drag-rotate momentum state ─────────────────────────
  let _rotateMomentumEnabled = true;
  const _rotateDrag = { pointerId: null, lastTheta: 0, lastPhi: 0, lastTime: 0, velTheta: 0, velPhi: 0 };
  const _activePointerIds = new Set();
  const _momentum = { frame: null, velTheta: 0, velPhi: 0, lastTime: 0 };
  const ROTATE_VELOCITY_SMOOTHING   = 0.35; // weight given to each new velocity sample
  const MOMENTUM_MIN_LAUNCH_VELOCITY = 0.02; // rad/sec — below this, don't bother launching
  const MOMENTUM_DECAY_PER_SECOND    = 0.10; // fraction of speed remaining after 1 full second
  const MOMENTUM_STOP_VELOCITY       = 0.0008; // rad/sec — momentum loop stops below this

  // ── Perspective-distortion blend state ────────────────
  const _perspBlend = { value: 1, baseFOV: null, minFOV: 1.5, animFrame: null };

  // ── Showcase (eased auto-rotate) state ────────────────
  const _showcase = {
    active: false,
    frame: null,
    direction: 1,
    minSpeed: 0.06,
    maxSpeed: 0.22,
    oscillationPeriod: 9,
    resumeDelayMs: 3500,
    lastFrameTime: 0,
    phaseTime: 0,
  };

  // ── Gyroscope (device orientation) state ──────────────
  const _gyro = {
    active: false,
    handler: null,
    baseline: null,
    baseSpherical: null,
    sensitivity: 1.4,
  };

  // ── Named-orientation tracking (for toggleXYOrientation) ──
  let _lastNamedOrientation = null; // 'xy' | 'default' | null

  // ── Keyboard shortcut state ───────────────────────────
  let _keydownHandler = null;

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init(perspCam, orthoCam, controls, renderer) {
    _perspCam  = perspCam;
    _orthoCam  = orthoCam;
    _controls  = controls;
    _renderer  = renderer;

    _lastInteractionTime = Date.now();

    _setupControlListeners();
    _setupTouchGestures();
    _setupCursorZoom();
    _setupRotateMomentum();
    _syncOrthoToPersp();
  }

  // ══════════════════════════════════════════════════════
  // ACTIVE CAMERA
  // ══════════════════════════════════════════════════════

  function active() {
    return _perspCam; // ortho is a continuous FOV/distance blend on this same camera, handled by Engine — see isOrtho()/toggleOrtho() below
  }

  function isOrtho() {
    // Delegates to Engine's continuous perspective-distortion blend (see
    // toggleOrtho() below) instead of the local _useOrtho flag, which is
    // intentionally left permanently false — see that note for why.
    return (typeof Engine !== 'undefined' && typeof Engine.isOrtho === 'function') ? Engine.isOrtho() : _useOrtho;
  }

  // ══════════════════════════════════════════════════════
  // ORTHOGRAPHIC TOGGLE
  // Originally a binary swap onto a second THREE.OrthographicCamera
  // (_orthoCam) — but Engine.init() never actually constructs one
  // (Camera.init's 2nd argument is always null; Engine's render loop only
  // ever renders its own perspCam), so every _orthoCam write below threw
  // the instant it ran. Engine already has a working, fully-integrated
  // equivalent — a continuous perspective-distortion blend that collapses
  // FOV toward 0 on the SAME rendered camera — so this now delegates to
  // that. _useOrtho is deliberately left false always: it still gates a
  // few other _orthoCam branches further down in this file (zoom,
  // smoothZoom) written for the old dual-camera design, so leaving it
  // false keeps those inert too rather than needing the same treatment
  // individually. isOrtho() above reports the real state via Engine
  // directly, so external callers (mod-share.js, the settings panel)
  // still see the correct on/off value regardless.
  // ══════════════════════════════════════════════════════

  function toggleOrtho() {
    const nowOrtho = (typeof Engine !== 'undefined' && typeof Engine.toggleOrthographic === 'function')
      ? Engine.toggleOrthographic()
      : _useOrtho;

    const btn = document.getElementById('hud-ortho');
    if (btn) btn.classList.toggle('active', nowOrtho);

    return nowOrtho;
  }

  function setOrtho(val) {
    if (!!val !== isOrtho()) toggleOrtho();
  }

  function setPerspective(val) {
    setOrtho(!val);
  }

  // ══════════════════════════════════════════════════════
  // RESIZE — keep camera in sync with viewport
  // ══════════════════════════════════════════════════════

  function onResize(width, height) {
    _perspCam.aspect = width / height;
    _perspCam.updateProjectionMatrix();
    // No separate _orthoCam to keep in sync — see the ORTHOGRAPHIC TOGGLE note above.
  }

  function _getOrthoSize() {
    const dist = _perspCam.position.length();
    return Math.max(4, dist * Math.tan(THREE.MathUtils.degToRad(_perspCam.fov / 2)));
  }

  // ══════════════════════════════════════════════════════
  // ANIMATED TRANSITION TO POSITION
  // ══════════════════════════════════════════════════════

  function _transitionTo(targetPos, targetLook, duration = 420) {
    if (_animating) {
      cancelAnimationFrame(_animFrame);
      _animating = false;
    }

    const cam = _perspCam;
    if (!_transition.startPos) {
      _transition.startPos = new THREE.Vector3();
      _transition.endPos = new THREE.Vector3();
      _transition.startTarget = new THREE.Vector3();
      _transition.endTarget = new THREE.Vector3();
    }
    _transition.startPos.copy(cam.position);
    _transition.endPos.set(...targetPos);
    _transition.startTarget.copy(_controls.target);
    _transition.endTarget.set(...targetLook);
    _transition.duration = duration;
    _transition.startTime = performance.now();
    _transition.active = true;
    _animating = true;

    _animateTransition();
  }

  function _animateTransition() {
    if (!_transition.active) return;

    const elapsed = performance.now() - _transition.startTime;
    const raw = Math.min(elapsed / _transition.duration, 1);

    const t = raw < 0.5
      ? 4 * raw * raw * raw
      : 1 - Math.pow(-2 * raw + 2, 3) / 2;

    _perspCam.position.lerpVectors(_transition.startPos, _transition.endPos, t);
    _controls.target.lerpVectors(_transition.startTarget, _transition.endTarget, t);
    _controls.update();

    if (_useOrtho) _syncOrthoToPersp();

    if (raw < 1) {
      _animFrame = requestAnimationFrame(_animateTransition);
    } else {
      _transition.active = false;
      _animating = false;
      _perspCam.position.copy(_transition.endPos);
      _controls.target.copy(_transition.endTarget);
      _controls.update();
    }
  }

  // ══════════════════════════════════════════════════════
  // CAMERA PRESETS
  // ══════════════════════════════════════════════════════

  function setPreset(name, animate = true) {
    const preset = PRESETS[name] || PRESETS.default;
    if (animate) {
      _transitionTo(preset.pos, preset.target);
    } else {
      _perspCam.position.set(...preset.pos);
      _controls.target.set(...preset.target);
      _controls.update();
      _syncOrthoToPersp();
    }
  }

  function reset(animate = true) {
    setPreset('default', animate);
  }

  function addPreset(name, pos, target = [0, 0, 0]) {
    if (!name || !Array.isArray(pos)) return false;
    PRESETS[name] = { pos: [...pos], target: [...target] };
    return true;
  }

  function removePreset(name) {
    if (['default', 'top', 'front', 'back', 'side', 'sideLeft', 'iso',
         'isoNW', 'isoSE', 'bottom', 'left', 'right', 'home',
         'xyOrientation', 'defaultOrientation'].includes(name)) {
      return false; // don't allow removing built-ins
    }
    return delete PRESETS[name];
  }

  function getPresetNames() {
    return Object.keys(PRESETS);
  }

  // ══════════════════════════════════════════════════════
  // XY ORIENTATION ⇄ DEFAULT ORIENTATION
  //
  // Desmos's cube has a one-click snap between "XY Orientation" (flat,
  // straight down onto the X-Y plane — what a 2D calculator would show)
  // and "Default Orientation" (the tilted 3D view). Those views already
  // existed here as the 'top' and 'default' presets; this just gives
  // them the names Desmos users will actually look for, plus a
  // dedicated toggle matching the "one-click snap" framing.
  // ══════════════════════════════════════════════════════

  function setXYOrientation(animate = true) {
    _lastNamedOrientation = 'xy';
    setPreset('xyOrientation', animate);
  }

  function setDefaultOrientation(animate = true) {
    _lastNamedOrientation = 'default';
    setPreset('defaultOrientation', animate);
  }

  function toggleXYOrientation(animate = true) {
    if (_lastNamedOrientation === 'xy') setDefaultOrientation(animate);
    else setXYOrientation(animate);
  }

  function isXYOrientation() {
    return _lastNamedOrientation === 'xy';
  }

  // ══════════════════════════════════════════════════════
  // ZOOM (centered — used by keyboard, ortho fallback, and
  // whenever cursor-anchored zoom can't resolve a focus point)
  // ══════════════════════════════════════════════════════

  function zoom(factor) {
    // Target-relative (previously scaled from the world origin, which
    // only looked right when the target happened to be at (0,0,0)).
    const offset = _perspCam.position.clone().sub(_controls.target);
    _perspCam.position.copy(_controls.target).addScaledVector(offset, factor);

    if (_useOrtho) {
      _orthoCam.zoom = Math.max(0.1, _orthoCam.zoom * (1 / factor));
      _orthoCam.updateProjectionMatrix();
    }

    _controls.update();
  }

  function zoomIn()  { zoom(0.82); }
  function zoomOut() { zoom(1.22); }

  function smoothZoom(factor, duration = 260) {
    if (_zoomAnimFrame) cancelAnimationFrame(_zoomAnimFrame);

    const startDist = getDistance();
    const endDist = Math.max(0.5, startDist * factor);
    const startOrthoZoom = _orthoCam ? _orthoCam.zoom : 1;
    const endOrthoZoom = _orthoCam ? Math.max(0.1, startOrthoZoom * (1 / factor)) : 1;
    const startTime = performance.now();

    const step = () => {
      const raw = Math.min((performance.now() - startTime) / duration, 1);
      const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      if (_useOrtho) {
        _orthoCam.zoom = startOrthoZoom + (endOrthoZoom - startOrthoZoom) * t;
        _orthoCam.updateProjectionMatrix();
      } else {
        setDistance(startDist + (endDist - startDist) * t);
      }

      if (raw < 1) {
        _zoomAnimFrame = requestAnimationFrame(step);
      } else {
        _zoomAnimFrame = null;
      }
    };
    step();
  }

  function smoothZoomIn(duration)  { smoothZoom(0.82, duration); }
  function smoothZoomOut(duration) { smoothZoom(1.22, duration); }

  function setDistance(dist) {
    const dir = _perspCam.position.clone().sub(_controls.target).normalize();
    _perspCam.position.copy(_controls.target).addScaledVector(dir, dist);
    _controls.update();
    if (_useOrtho) _syncOrthoToPersp();
  }

  function getDistance() {
    return _perspCam.position.distanceTo(_controls.target);
  }

  function setMinZoom(z) { if (_controls) _controls.minZoom = z; }
  function setMaxZoom(z) { if (_controls) _controls.maxZoom = z; }

  // ══════════════════════════════════════════════════════
  // CURSOR / PINCH-ANCHORED ZOOM
  // ══════════════════════════════════════════════════════

  let _zoomFocusProvider = null;

  function setZoomFocusProvider(fn) {
    _zoomFocusProvider = typeof fn === 'function' ? fn : null;
  }

  function _screenToNDC(clientX, clientY) {
    const rect = _renderer.domElement.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  function _projectToFocusPlane(ndc) {
    if (!_controls || !_perspCam) return null;

    if (_zoomFocusProvider) {
      const targets = _zoomFocusProvider();
      if (Array.isArray(targets) && targets.length > 0) {
        _getRaycaster().setFromCamera(ndc, _perspCam);
        const hits = _getRaycaster().intersectObjects(targets, false);
        if (hits.length > 0) return hits[0].point;
      }
    }

    const forward = new THREE.Vector3().subVectors(_controls.target, _perspCam.position);
    if (forward.lengthSq() < 1e-8) return null;
    forward.normalize();

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward, _controls.target);
    _getRaycaster().setFromCamera(ndc, _perspCam);

    const hit = new THREE.Vector3();
    return _getRaycaster().ray.intersectPlane(plane, hit) ? hit : null;
  }

  function _zoomTowardPoint(point, factor) {
    const camOffset = _perspCam.position.clone().sub(point);
    const targetOffset = _controls.target.clone().sub(point);

    const dist = camOffset.length();
    let clamped = factor;
    const newDist = dist * factor;
    const minD = _controls.minDistance;
    const maxD = _controls.maxDistance;
    if (minD && newDist < minD) clamped = minD / dist;
    else if (maxD && isFinite(maxD) && newDist > maxD) clamped = maxD / dist;

    _perspCam.position.copy(point).addScaledVector(camOffset, clamped);
    _controls.target.copy(point).addScaledVector(targetOffset, clamped);
    _controls.update();
    _syncOrthoToPersp();
  }

  function _onWheelZoomToCursor(e) {
    if (!_cursorZoomEnabled) return;
    e.preventDefault();
    _cancelAnimations();
    _markInteraction();

    const rawFactor = Math.exp(e.deltaY * ZOOM_WHEEL_SENSITIVITY);
    const factor = THREE.MathUtils.clamp(rawFactor, ZOOM_WHEEL_MIN_FACTOR, ZOOM_WHEEL_MAX_FACTOR);

    if (_useOrtho) {
      zoom(factor);
      return;
    }

    const point = _projectToFocusPlane(_screenToNDC(e.clientX, e.clientY));
    if (!point) { zoom(factor); return; }
    _zoomTowardPoint(point, factor);
  }

  function _pinchMetrics(t0, t1) {
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return {
      dist: Math.sqrt(dx * dx + dy * dy),
      midX: (t0.clientX + t1.clientX) / 2,
      midY: (t0.clientY + t1.clientY) / 2,
    };
  }

  function _panByPixels(dxPixels, dyPixels) {
    const cam = active();
    if (!cam || !_controls || !_renderer) return;

    const el = _renderer.domElement;
    const distance = cam.position.distanceTo(_controls.target);
    const fovRad = THREE.MathUtils.degToRad(_perspCam.fov);
    const targetDistance = distance * Math.tan(fovRad / 2);
    const unitsPerPixel = (2 * targetDistance) / Math.max(el.clientHeight, 1);

    const te = cam.matrix.elements;
    const right = new THREE.Vector3(te[0], te[1], te[2]);
    const up    = new THREE.Vector3(te[4], te[5], te[6]);

    const panOffset = new THREE.Vector3()
      .addScaledVector(right, -dxPixels * unitsPerPixel)
      .addScaledVector(up, dyPixels * unitsPerPixel);

    cam.position.add(panOffset);
    _controls.target.add(panOffset);
    _controls.update();

    if (_useOrtho) _syncPerspToOrtho();
    else _syncOrthoToPersp();
  }

  function _pinchStartHandler(e) {
    if (!_cursorZoomEnabled || e.touches.length !== 2) { _pinch.active = false; return; }
    const m = _pinchMetrics(e.touches[0], e.touches[1]);
    _pinch.active = true;
    _pinch.prevDist = m.dist;
    _pinch.prevMidX = m.midX;
    _pinch.prevMidY = m.midY;
    _cancelAnimations();
    _markInteraction();
  }

  function _pinchMoveHandler(e) {
    if (!_cursorZoomEnabled || !_pinch.active || e.touches.length !== 2) return;
    e.preventDefault();
    _markInteraction();

    const m = _pinchMetrics(e.touches[0], e.touches[1]);

    const panDX = m.midX - _pinch.prevMidX;
    const panDY = m.midY - _pinch.prevMidY;
    if (panDX !== 0 || panDY !== 0) _panByPixels(panDX, panDY);

    if (_pinch.prevDist > 0 && m.dist > 0) {
      const rawFactor = _pinch.prevDist / m.dist;
      const factor = THREE.MathUtils.clamp(rawFactor, PINCH_MIN_FACTOR, PINCH_MAX_FACTOR);

      if (_useOrtho) {
        zoom(factor);
      } else {
        const point = _projectToFocusPlane(_screenToNDC(m.midX, m.midY));
        if (point) _zoomTowardPoint(point, factor);
        else zoom(factor);
      }
    }

    _pinch.prevDist = m.dist;
    _pinch.prevMidX = m.midX;
    _pinch.prevMidY = m.midY;
  }

  function _pinchEndHandler(e) {
    if (e.touches.length < 2) _pinch.active = false;
  }

  function _setupCursorZoom() {
    if (!_renderer || !_renderer.domElement || !_controls) return;

    _controls.enableZoom = !_cursorZoomEnabled;
    if (_controls.touches) {
      _controls.touches.TWO = _cursorZoomEnabled ? THREE.TOUCH.NONE : THREE.TOUCH.DOLLY_PAN;
    }

    const el = _renderer.domElement;
    el.addEventListener('wheel', _onWheelZoomToCursor, { passive: false });
    el.addEventListener('touchstart', _pinchStartHandler, { passive: true });
    el.addEventListener('touchmove', _pinchMoveHandler, { passive: false });
    el.addEventListener('touchend', _pinchEndHandler, { passive: true });
    el.addEventListener('touchcancel', _pinchEndHandler, { passive: true });
  }

  function enableCursorZoom() {
    _cursorZoomEnabled = true;
    if (_controls) {
      _controls.enableZoom = false;
      if (_controls.touches) _controls.touches.TWO = THREE.TOUCH.NONE;
    }
  }

  function disableCursorZoom() {
    _cursorZoomEnabled = false;
    if (_controls) {
      _controls.enableZoom = true;
      if (_controls.touches) _controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    }
  }

  function isCursorZoomEnabled() {
    return _cursorZoomEnabled;
  }

  // ══════════════════════════════════════════════════════
  // DRAG-ROTATE MOMENTUM
  //
  // Desmos's cube keeps spinning with decaying momentum after you
  // release a drag, until you click again. OrbitControls has no such
  // concept, so this tracks angular velocity independently via Pointer
  // Events layered alongside it (same technique as the cursor-zoom
  // listeners above — multiple listeners on the same element coexist
  // fine), then replays that velocity with exponential decay on release.
  //
  // Only tracks single-pointer, primary-button drags — i.e. exactly
  // the gesture that OrbitControls treats as ROTATE given this file's
  // config (touches.ONE = ROTATE, left mouse button = default ROTATE).
  // A second pointer joining mid-gesture (pinch) aborts tracking rather
  // than producing a nonsense velocity reading.
  // ══════════════════════════════════════════════════════

  function _currentSpherical() {
    const cam = active();
    const offset = new THREE.Vector3().subVectors(cam.position, _controls.target);
    return new THREE.Spherical().setFromVector3(offset);
  }

  function _isPrimaryRotateInput(e) {
    if (e.pointerType === 'mouse') return e.button === 0;
    return true; // touch/pen — governed by touches.ONE = ROTATE
  }

  function _stopMomentum() {
    if (_momentum.frame) cancelAnimationFrame(_momentum.frame);
    _momentum.frame = null;
    _momentum.velTheta = 0;
    _momentum.velPhi = 0;
  }

  function _momentumTick() {
    const now = performance.now();
    const dt = Math.min((now - _momentum.lastTime) / 1000, 0.1);
    _momentum.lastTime = now;

    const cam = active();
    const offset = new THREE.Vector3().subVectors(cam.position, _controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    spherical.theta += _momentum.velTheta * dt;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + _momentum.velPhi * dt, 0.001, Math.PI - 0.001);

    offset.setFromSpherical(spherical);
    cam.position.copy(_controls.target).add(offset);
    cam.lookAt(_controls.target);
    _controls.update();
    if (_useOrtho) _syncPerspToOrtho();
    else _syncOrthoToPersp();

    const decay = Math.pow(MOMENTUM_DECAY_PER_SECOND, dt);
    _momentum.velTheta *= decay;
    _momentum.velPhi *= decay;

    if (Math.hypot(_momentum.velTheta, _momentum.velPhi) > MOMENTUM_STOP_VELOCITY) {
      _momentum.frame = requestAnimationFrame(_momentumTick);
    } else {
      _momentum.frame = null;
    }
  }

  function _startMomentum(velTheta, velPhi) {
    _stopMomentum();
    _momentum.velTheta = velTheta;
    _momentum.velPhi = velPhi;
    _momentum.lastTime = performance.now();
    _momentum.frame = requestAnimationFrame(_momentumTick);
  }

  function _onRotatePointerDown(e) {
    if (!_rotateMomentumEnabled) return;
    _activePointerIds.add(e.pointerId);
    if (_activePointerIds.size > 1) {
      _rotateDrag.pointerId = null; // a second finger joined — not a plain rotate
      return;
    }
    if (!_isPrimaryRotateInput(e)) return;

    _stopMomentum(); // any new grab cancels an in-flight spin
    _cancelAnimations();
    _markInteraction();

    const s = _currentSpherical();
    _rotateDrag.pointerId = e.pointerId;
    _rotateDrag.lastTheta = s.theta;
    _rotateDrag.lastPhi = s.phi;
    _rotateDrag.lastTime = performance.now();
    _rotateDrag.velTheta = 0;
    _rotateDrag.velPhi = 0;
  }

  function _onRotatePointerMove(e) {
    if (!_rotateMomentumEnabled) return;
    if (_rotateDrag.pointerId !== e.pointerId || _activePointerIds.size > 1) return;

    const now = performance.now();
    const dt = Math.max((now - _rotateDrag.lastTime) / 1000, 1 / 240);
    const s = _currentSpherical();

    let dTheta = s.theta - _rotateDrag.lastTheta;
    if (dTheta > Math.PI) dTheta -= Math.PI * 2;   // handle the ±π wrap
    if (dTheta < -Math.PI) dTheta += Math.PI * 2;
    const dPhi = s.phi - _rotateDrag.lastPhi;

    const instTheta = dTheta / dt;
    const instPhi = dPhi / dt;

    _rotateDrag.velTheta += (instTheta - _rotateDrag.velTheta) * ROTATE_VELOCITY_SMOOTHING;
    _rotateDrag.velPhi   += (instPhi   - _rotateDrag.velPhi)   * ROTATE_VELOCITY_SMOOTHING;

    _rotateDrag.lastTheta = s.theta;
    _rotateDrag.lastPhi = s.phi;
    _rotateDrag.lastTime = now;
  }

  function _onRotatePointerUp(e) {
    if (!_rotateMomentumEnabled) return;
    _activePointerIds.delete(e.pointerId);
    if (_rotateDrag.pointerId !== e.pointerId) return;
    _rotateDrag.pointerId = null;

    const speed = Math.hypot(_rotateDrag.velTheta, _rotateDrag.velPhi);
    if (speed >= MOMENTUM_MIN_LAUNCH_VELOCITY) {
      _startMomentum(_rotateDrag.velTheta, _rotateDrag.velPhi);
    }
  }

  function _setupRotateMomentum() {
    if (!_renderer || !_renderer.domElement) return;
    const el = _renderer.domElement;
    el.addEventListener('pointerdown', _onRotatePointerDown);
    el.addEventListener('pointermove', _onRotatePointerMove);
    el.addEventListener('pointerup', _onRotatePointerUp);
    el.addEventListener('pointercancel', _onRotatePointerUp);
  }

  function enableRotateMomentum()  { _rotateMomentumEnabled = true; }
  function disableRotateMomentum() { _rotateMomentumEnabled = false; _stopMomentum(); }
  function isRotateMomentumEnabled() { return _rotateMomentumEnabled; }
  function stopMomentum() { _stopMomentum(); } // manual "stop spinning" action, if you want one

  // ══════════════════════════════════════════════════════
  // PERSPECTIVE-DISTORTION BLEND (continuous ortho ⇄ perspective)
  //
  // This is a SEPARATE effect from toggleOrtho()/_useOrtho above, which
  // swaps to a real THREE.OrthographicCamera. This instead shrinks the
  // perspective camera's own FOV toward near-zero while moving it
  // correspondingly farther away — a very-narrow-FOV perspective camera
  // reads as visually orthographic, since its projection rays become
  // nearly parallel. Whether the UI replaces the binary toggle with this
  // slider, keeps both, or something else is an engine.js/UI decision.
  //
  // value: 0 = tightest FOV (near-orthographic look), 1 = the camera's
  // own normal FOV (full perspective).
  //
  // Integration note: for LIVE slider dragging, call with animate=false
  // on every input event — the slider itself already provides smooth,
  // continuous, user-controlled interpolation, so layering an eased
  // animation on top of that would make it feel laggy/rubber-bandy
  // rather than 1:1 responsive. Reserve animate=true (the default) for
  // discrete jumps, e.g. a "reset to full perspective" button.
  //
  // The reference framing size is recomputed from the camera's actual
  // current fov/distance at the start of every call — this makes it
  // self-correcting if the user zooms via wheel/pinch/keyboard in
  // between blend adjustments, with no separate bookkeeping needed
  // (dist*tan(fov/2) is preserved exactly by every step here, so
  // recovering it back out always returns the same reference height,
  // whatever it currently is).
  // ══════════════════════════════════════════════════════

  function _applyPerspectiveBlend(value, referenceHalfHeight) {
    const fov = THREE.MathUtils.lerp(_perspBlend.minFOV, _perspBlend.baseFOV, value);
    const fovRad = THREE.MathUtils.degToRad(fov);
    const dist = referenceHalfHeight / Math.tan(fovRad / 2);

    const dir = _perspCam.position.clone().sub(_controls.target).normalize();
    if (dir.lengthSq() < 1e-6) dir.set(0.42, 0.32, 1).normalize();

    _perspCam.fov = fov;
    _perspCam.position.copy(_controls.target).addScaledVector(dir, dist);
    _perspCam.updateProjectionMatrix();
    _controls.update();
    _syncOrthoToPersp();
  }

  function setPerspectiveBlend(value, animate = true, duration = 320) {
    if (!_perspCam || !_controls) return;
    if (_perspBlend.baseFOV === null) _perspBlend.baseFOV = _perspCam.fov;

    const clamped = THREE.MathUtils.clamp(value, 0, 1);

    const currentFovRad = THREE.MathUtils.degToRad(_perspCam.fov);
    const currentDist = _perspCam.position.distanceTo(_controls.target);
    const referenceHalfHeight = currentDist * Math.tan(currentFovRad / 2);

    if (_perspBlend.animFrame) {
      cancelAnimationFrame(_perspBlend.animFrame);
      _perspBlend.animFrame = null;
    }

    if (!animate) {
      _perspBlend.value = clamped;
      _applyPerspectiveBlend(clamped, referenceHalfHeight);
      return;
    }

    const startValue = _perspBlend.value;
    const startTime = performance.now();

    const step = () => {
      const raw = Math.min((performance.now() - startTime) / duration, 1);
      const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      _applyPerspectiveBlend(startValue + (clamped - startValue) * t, referenceHalfHeight);

      if (raw < 1) {
        _perspBlend.animFrame = requestAnimationFrame(step);
      } else {
        _perspBlend.value = clamped;
        _perspBlend.animFrame = null;
      }
    };
    step();
  }

  function getPerspectiveBlend() {
    return _perspBlend.value;
  }

  // ══════════════════════════════════════════════════════
  // FOV (perspective only)
  // ══════════════════════════════════════════════════════

  function setFOV(fov) {
    _perspCam.fov = THREE.MathUtils.clamp(fov, 20, 120);
    _perspCam.updateProjectionMatrix();
  }

  function getFOV() { return _perspCam.fov; }

  // ══════════════════════════════════════════════════════
  // ORBIT CONTROLS — speed settings & simple constant auto-rotate
  // ══════════════════════════════════════════════════════

  function setRotateSpeed(s) { if (_controls) _controls.rotateSpeed = s; }
  function setZoomSpeed(s)   { if (_controls) _controls.zoomSpeed = s; }
  function setPanSpeed(s)    { if (_controls) _controls.panSpeed = s; }

  function setDamping(enabled, factor = 0.07) {
    if (!_controls) return;
    _controls.enableDamping = enabled;
    _controls.dampingFactor = factor;
  }

  function setMinDistance(d) { if (_controls) _controls.minDistance = d; }
  function setMaxDistance(d) { if (_controls) _controls.maxDistance = d; }

  function enableRotate(v) { if (_controls) _controls.enableRotate = v; }
  function enablePan(v)    { if (_controls) _controls.enablePan = v; }
  function enableZoom(v)   { if (_controls) _controls.enableZoom = v; }

  function setAutoRotate(enabled, speed = 2.0) {
    if (!_controls) return;
    _controls.autoRotate = enabled;
    _controls.autoRotateSpeed = speed;
  }

  function isAutoRotating() {
    return !!(_controls && _controls.autoRotate);
  }

  // ══════════════════════════════════════════════════════
  // KEYBOARD-DRIVEN PAN
  // ══════════════════════════════════════════════════════

  function panBy(dx, dy) {
    const cam = active();
    if (!cam || !_controls) return;

    const te = cam.matrix.elements;
    const right = new THREE.Vector3(te[0], te[1], te[2]);
    const up    = new THREE.Vector3(te[4], te[5], te[6]);

    const distance = cam.position.distanceTo(_controls.target);
    const panScale = Math.max(distance, 1) * 0.0015;

    const panOffset = new THREE.Vector3()
      .addScaledVector(right, -dx * panScale)
      .addScaledVector(up, dy * panScale);

    cam.position.add(panOffset);
    _controls.target.add(panOffset);
    _controls.update();

    if (_useOrtho) _syncPerspToOrtho();
    else _syncOrthoToPersp();
  }

  // ══════════════════════════════════════════════════════
  // INTERACTION TRACKING
  // ══════════════════════════════════════════════════════

  function _markInteraction() {
    _lastInteractionTime = Date.now();
  }

  function _cancelAnimations() {
    if (_transition.active) {
      _transition.active = false;
      _animating = false;
      if (_animFrame) cancelAnimationFrame(_animFrame);
    }
    if (_zoomAnimFrame) {
      cancelAnimationFrame(_zoomAnimFrame);
      _zoomAnimFrame = null;
    }
    _stopMomentum();
  }

  // ══════════════════════════════════════════════════════
  // CONTROL EVENT LISTENERS
  // ══════════════════════════════════════════════════════

  function _setupControlListeners() {
    if (!_controls) return;

    _controls.addEventListener('change', () => {
      if (_useOrtho) _syncOrthoToPersp();
    });

    _controls.addEventListener('start', () => {
      _cancelAnimations();
      _markInteraction();
    });
  }

  // ══════════════════════════════════════════════════════
  // TOUCH GESTURES — single-finger orbit (native) + double-tap reset
  // ══════════════════════════════════════════════════════

  function _setupTouchGestures() {
    if (!_renderer || !_renderer.domElement || _touch.handlersBound) return;
    const el = _renderer.domElement;

    if (_controls) {
      _controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    }

    _touchStartHandler = (e) => {
      if (e.touches.length > 1) {
        _touch.wasMultiTouch = true;
        return;
      }
      _touch.wasMultiTouch = false;
      _touch.startX = e.touches[0].clientX;
      _touch.startY = e.touches[0].clientY;
      _touch.startTime = Date.now();
    };

    _touchEndHandler = (e) => {
      if (_touch.wasMultiTouch || e.touches.length > 0) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const dt = Date.now() - _touch.startTime;
      const dx = e.changedTouches[0].clientX - _touch.startX;
      const dy = e.changedTouches[0].clientY - _touch.startY;
      const moved = Math.sqrt(dx * dx + dy * dy);

      if (dt < TAP_TIME_THRESHOLD && moved < TAP_MOVE_THRESHOLD) {
        handleTouch(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    };

    el.addEventListener('touchstart', _touchStartHandler, { passive: true });
    el.addEventListener('touchend', _touchEndHandler, { passive: true });
    _touch.handlersBound = true;
  }

  function enableTouchGestures() {
    _setupTouchGestures();
  }

  function disableTouchGestures() {
    if (_pendingTapTimer) { clearTimeout(_pendingTapTimer); _pendingTapTimer = null; }
    if (!_renderer || !_renderer.domElement || !_touch.handlersBound) return;
    const el = _renderer.domElement;
    el.removeEventListener('touchstart', _touchStartHandler);
    el.removeEventListener('touchend', _touchEndHandler);
    _touch.handlersBound = false;
  }

  function setDoubleTapEnabled(v) {
    _touch.doubleTapEnabled = !!v;
  }

  // ══════════════════════════════════════════════════════
  // SYNC HELPERS
  // ══════════════════════════════════════════════════════

  function _syncOrthoToPersp() {
    if (!_orthoCam || !_perspCam) return;
    _orthoCam.position.copy(_perspCam.position);
    _orthoCam.quaternion.copy(_perspCam.quaternion);
    _orthoCam.updateProjectionMatrix();
  }

  function _syncPerspToOrtho() {
    if (!_perspCam || !_orthoCam) return;
    _perspCam.position.copy(_orthoCam.position);
    _perspCam.quaternion.copy(_orthoCam.quaternion);
    _perspCam.updateProjectionMatrix();
  }

  // ══════════════════════════════════════════════════════
  // CAMERA INFO  — for status bar / debug
  // ══════════════════════════════════════════════════════

  function getInfo() {
    const pos = _perspCam.position;
    const tgt = _controls ? _controls.target : new THREE.Vector3();
    return {
      position: { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) },
      target:   { x: tgt.x.toFixed(2), y: tgt.y.toFixed(2), z: tgt.z.toFixed(2) },
      distance: getDistance().toFixed(2),
      fov:      _perspCam.fov.toFixed(1),
      ortho:    _useOrtho,
      perspectiveBlend: _perspBlend.value,
    };
  }

  // ══════════════════════════════════════════════════════
  // LOOK-AT / FRAMING HELPERS
  // ══════════════════════════════════════════════════════

  function lookAt(x, y, z) {
    const target = new THREE.Vector3(x, y, z);
    if (_controls) _controls.target.copy(target);
    _perspCam.lookAt(target);
    _controls && _controls.update();
  }

  function _frameSphere(center, radius, duration = 420) {
    const fovRad = THREE.MathUtils.degToRad(_perspCam.fov);
    const dist = Math.max(radius, 0.01) / Math.sin(fovRad / 2);

    const dir = _perspCam.position.clone().sub(center).normalize();
    if (dir.lengthSq() < 1e-6) dir.set(0.42, 0.32, 1).normalize();

    _transitionTo(
      [center.x + dir.x * dist, center.y + dir.y * dist, center.z + dir.z * dist],
      [center.x, center.y, center.z],
      duration
    );
  }

  function fitToSphere(center, radius, duration = 420) {
    _frameSphere(center, radius * 1.2, duration);
  }

  function autoFrame(meshes, options = {}) {
    if (!_perspCam || !_controls) return false;

    const { padding = 1.35, duration = 500, minRadius = 1.5 } = options;
    const list = Array.isArray(meshes) ? meshes : [meshes];

    const box = new THREE.Box3();
    let hasContent = false;

    for (const obj of list) {
      if (!obj) continue;
      const objBox = new THREE.Box3().setFromObject(obj);
      if (objBox.isEmpty()) continue;
      box.union(objBox);
      hasContent = true;
    }

    if (!hasContent) return false;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, minRadius);

    _frameSphere(center, radius * padding, duration);
    return true;
  }

  // ══════════════════════════════════════════════════════
  // SHOWCASE MODE — eased auto-rotate for screenshots/embeds
  // ══════════════════════════════════════════════════════

  function _showcaseTick() {
    if (!_showcase.active) return;

    const nowMs = performance.now();
    if (!_showcase.lastFrameTime) _showcase.lastFrameTime = nowMs;
    const dt = Math.min((nowMs - _showcase.lastFrameTime) / 1000, 0.1);
    _showcase.lastFrameTime = nowMs;

    if (Date.now() - _lastInteractionTime >= _showcase.resumeDelayMs) {
      _showcase.phaseTime += dt;

      const cycle = (Math.sin((_showcase.phaseTime / _showcase.oscillationPeriod) * Math.PI * 2) + 1) / 2;
      const speed = _showcase.minSpeed + (_showcase.maxSpeed - _showcase.minSpeed) * cycle;

      const cam = active();
      const offset = new THREE.Vector3().subVectors(cam.position, _controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += speed * _showcase.direction * dt;
      offset.setFromSpherical(spherical);

      cam.position.copy(_controls.target).add(offset);
      cam.lookAt(_controls.target);
      _controls.update();
      if (_useOrtho) _syncPerspToOrtho();
      else _syncOrthoToPersp();
    }

    _showcase.frame = requestAnimationFrame(_showcaseTick);
  }

  function startShowcase(options = {}) {
    if (_showcase.active) return;
    if (_gyro.active) disableGyroscope();
    _stopMomentum();

    _showcase.active = true;
    _showcase.direction = options.direction === 'ccw' ? -1 : 1;
    if (typeof options.minSpeed === 'number') _showcase.minSpeed = options.minSpeed;
    if (typeof options.maxSpeed === 'number') _showcase.maxSpeed = options.maxSpeed;
    if (typeof options.oscillationPeriod === 'number') _showcase.oscillationPeriod = options.oscillationPeriod;
    if (typeof options.resumeDelay === 'number') _showcase.resumeDelayMs = options.resumeDelay * 1000;

    _lastInteractionTime = 0;
    _showcase.lastFrameTime = 0;
    _showcase.phaseTime = 0;
    _showcase.frame = requestAnimationFrame(_showcaseTick);
  }

  function stopShowcase() {
    _showcase.active = false;
    if (_showcase.frame) cancelAnimationFrame(_showcase.frame);
    _showcase.frame = null;
  }

  function isShowcasing() {
    return _showcase.active;
  }

  // ══════════════════════════════════════════════════════
  // GYROSCOPE (DEVICE ORIENTATION) — opt-in tilt-to-rotate
  // ══════════════════════════════════════════════════════

  function isGyroscopeSupported() {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  function _onDeviceOrientation(e) {
    if (e.beta === null || e.gamma === null) return;

    if (!_gyro.baseline) {
      _gyro.baseline = { beta: e.beta, gamma: e.gamma };
      const cam = active();
      const offset = new THREE.Vector3().subVectors(cam.position, _controls.target);
      _gyro.baseSpherical = new THREE.Spherical().setFromVector3(offset);
      return;
    }

    _markInteraction();

    const dBeta  = THREE.MathUtils.degToRad(e.beta  - _gyro.baseline.beta)  * _gyro.sensitivity;
    const dGamma = THREE.MathUtils.degToRad(e.gamma - _gyro.baseline.gamma) * _gyro.sensitivity;

    const cam = active();
    const spherical = _gyro.baseSpherical.clone();
    spherical.theta -= dGamma;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - dBeta, 0.05, Math.PI - 0.05);

    const offset = new THREE.Vector3().setFromSpherical(spherical);
    cam.position.copy(_controls.target).add(offset);
    cam.lookAt(_controls.target);
    _controls.update();
    if (_useOrtho) _syncPerspToOrtho();
    else _syncOrthoToPersp();
  }

  async function enableGyroscope(sensitivity) {
    if (_gyro.active) return true;
    if (!isGyroscopeSupported()) return false;

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') return false;
      } catch (err) {
        console.warn('Device orientation permission request failed:', err);
        return false;
      }
    }

    if (_showcase.active) stopShowcase();
    _stopMomentum();

    if (typeof sensitivity === 'number') _gyro.sensitivity = sensitivity;
    _gyro.baseline = null;
    _gyro.handler = (e) => _onDeviceOrientation(e);
    window.addEventListener('deviceorientation', _gyro.handler);
    _gyro.active = true;
    return true;
  }

  function disableGyroscope() {
    if (!_gyro.active) return;
    window.removeEventListener('deviceorientation', _gyro.handler);
    _gyro.handler = null;
    _gyro.active = false;
    _gyro.baseline = null;
  }

  function isGyroscopeActive() {
    return _gyro.active;
  }

  // ══════════════════════════════════════════════════════
  // KEYBOARD SHORTCUT HANDLER
  // ══════════════════════════════════════════════════════

  function handleKey(key, event = null) {
    const k = key.toLowerCase();
    const panStep = 12;
    const shift = !!(event && event.shiftKey);

    switch (k) {
      case 'r': reset(); break;
      case 't': setPreset(shift ? 'bottom' : 'top'); break;
      case 'f': setPreset(shift ? 'back' : 'front'); break;
      case 'b': setPreset('back'); break;
      case 's': setPreset(shift ? 'sideLeft' : 'side'); break;
      case 'i': setPreset(shift ? 'isoNW' : 'iso'); break;
      case 'o': toggleOrtho(); break;
      case 'x': toggleXYOrientation(); break;

      case '1': case '2': case '3': case '4': case '5':
      case '6': case '7': case '8': case '9': case '0': {
        const idx = k === '0' ? 9 : parseInt(k, 10) - 1;
        setPreset(PRESET_HOTKEY_ORDER[idx]);
        break;
      }

      case '+':
      case '=': smoothZoomIn(); break;
      case '-':
      case '_': smoothZoomOut(); break;

      case 'arrowup':    panBy(0, panStep); break;
      case 'arrowdown':  panBy(0, -panStep); break;
      case 'arrowleft':  panBy(-panStep, 0); break;
      case 'arrowright': panBy(panStep, 0); break;

      default:
        return false;
    }
    _markInteraction();
    return true;
  }

  function bindKeyboardShortcuts(target = window) {
    if (_keydownHandler) return;

    _keydownHandler = (e) => {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) {
        return;
      }

      const navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', '+', '-', '='];
      const handled = handleKey(e.key, e);
      if (handled && navKeys.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    target.addEventListener('keydown', _keydownHandler);
  }

  function unbindKeyboardShortcuts(target = window) {
    if (!_keydownHandler) return;
    target.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }

  function getKeyboardShortcuts() {
    return {
      'R':           'Reset to default view',
      'T / Shift+T': 'Top / Bottom view',
      'F / Shift+F': 'Front / Back view',
      'B':           'Back view',
      'S / Shift+S': 'Side (right) / Side (left) view',
      'I / Shift+I': 'Isometric / Isometric NW view',
      'O':           'Toggle Perspective / Orthographic',
      'X':           'Toggle XY Orientation / Default Orientation',
      '1 – 0':       'Jump to preset 1-10',
      '+ / -':       'Zoom in / out',
      '↑ ↓ ← →':     'Pan camera',
    };
  }

  // ══════════════════════════════════════════════════════
  // DOUBLE TAP RESET (mobile)
  // ══════════════════════════════════════════════════════

  function handleTouch(clientX, clientY) {
    if (!_touch.doubleTapEnabled) return;
    _markInteraction();
    const now = Date.now();
    if (now - _touch.lastTapTime < DOUBLE_TAP_WINDOW) {
      if (_pendingTapTimer) { clearTimeout(_pendingTapTimer); _pendingTapTimer = null; }
      reset();
      _touch.lastTapTime = 0;
    } else {
      _touch.lastTapTime = now;
      if (_pendingTapTimer) clearTimeout(_pendingTapTimer);
      _pendingTapTimer = setTimeout(() => {
        _pendingTapTimer = null;
        if (_renderer && _renderer.domElement) {
          _renderer.domElement.dispatchEvent(new CustomEvent('graph3d:tap', {
            detail: { clientX, clientY },
            bubbles: true,
          }));
        }
      }, DOUBLE_TAP_WINDOW);
    }
  }

  // ══════════════════════════════════════════════════════
  // GETTERS
  // ══════════════════════════════════════════════════════

  function getPerspCam()  { return _perspCam; }
  function getOrthoCam()  { return _orthoCam; }
  function getControls()  { return _controls; }
  function getPresets()   { return { ...PRESETS }; }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    init,
    active,
    isOrtho,
    toggleOrtho,
    setOrtho,
    setPerspective,
    onResize,

    setPreset,
    reset,
    zoom,
    zoomIn,
    zoomOut,
    smoothZoom,
    smoothZoomIn,
    smoothZoomOut,
    setDistance,
    getDistance,
    panBy,
    lookAt,
    fitToSphere,
    autoFrame,

    setXYOrientation,
    setDefaultOrientation,
    toggleXYOrientation,
    isXYOrientation,

    addPreset,
    removePreset,
    getPresetNames,

    setFOV,
    getFOV,

    setRotateSpeed,
    setZoomSpeed,
    setPanSpeed,
    setDamping,
    setMinDistance,
    setMaxDistance,
    setMinZoom,
    setMaxZoom,
    enableRotate,
    enablePan,
    enableZoom,
    setAutoRotate,
    isAutoRotating,

    enableCursorZoom,
    disableCursorZoom,
    isCursorZoomEnabled,
    setZoomFocusProvider,

    enableRotateMomentum,
    disableRotateMomentum,
    isRotateMomentumEnabled,
    stopMomentum,

    setPerspectiveBlend,
    getPerspectiveBlend,

    startShowcase,
    stopShowcase,
    isShowcasing,

    enableGyroscope,
    disableGyroscope,
    isGyroscopeSupported,
    isGyroscopeActive,

    enableTouchGestures,
    disableTouchGestures,
    setDoubleTapEnabled,

    getInfo,

    handleKey,
    handleTouch,
    bindKeyboardShortcuts,
    unbindKeyboardShortcuts,
    getKeyboardShortcuts,

    getPerspCam,
    getOrthoCam,
    getControls,
    getPresets,
  };

})();
