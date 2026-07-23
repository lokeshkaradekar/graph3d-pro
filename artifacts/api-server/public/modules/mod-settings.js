/**
 * Graph3D Pro — mod-settings.js
 * Module 08 — Settings Panel, Keyboard Shortcuts,
 * Theme Toggle, Camera Controls, All Toggles
 * ~/graph3d-pro/modules/mod-settings.js
 */

const ModSettings = (() => {

  // ── State ──────────────────────────────────────────────
  let _settings = {
    // Range
    xMin: -5, xMax: 5,
    yMin: -5, yMax: 5,
    zMin: -10, zMax: 10,

    // Rendering
    resolution:  55,
    wireframe:   false,
    transparent: true,
    shadows:     false,
    antialias:   true,

    // Scene
    showAxes:      true,
    showGrid:      true,
    fog:           true,
    showCrosshair: false,
    showCoordTip:  true,

    // Camera
    cameraMode:   'perspective',
    rotateSpeed:  0.5,
    zoomSpeed:    0.9,
    panSpeed:     0.6,
    damping:      true,

    // Theme
    theme: 'dark',

    // Performance
    maxResolution: 120,
    minResolution: 15,

    // Advanced (engine.js features that previously had no settings UI —
    // defaults match engine.js's own cfg defaults exactly)
    bloom:                false,
    ambientOcclusion:     false,
    adaptiveResolution:   true,
    adaptiveTessellation: false,
    meshCacheEnabled:     true,
    // NOTE: renderMode isn't a separate row — engine.js keeps cfg.renderMode
    // ('solid'/'wireframe') in sync with cfg.wireframe automatically, and
    // the Wireframe checkbox below already drives that.

    // Accessibility
    largeText:   false,
    complexMode: false,
  };

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _loadFromStorage();
    _buildSettingsPanel();
    _initKeyboardShortcuts();
    _initTopbarButtons();
    _initHUDButtons();
    _applyTheme(_settings.theme);
    _applyLargeText(_settings.largeText);
    _syncAllToEngine();
  }

  // ══════════════════════════════════════════════════════
  // BUILD SETTINGS PANEL
  // ══════════════════════════════════════════════════════

  function _buildSettingsPanel() {
    const container = document.getElementById('sec-cfg');
    if (!container) return;
    container.innerHTML = '';

    // ── Range ────────────────────────────────────────────
    _addSubLabel(container, 'Range');
    _addRangeRow(container, 'X', 'xMin', 'xMax', _settings.xMin, _settings.xMax);
    _addRangeRow(container, 'Y', 'yMin', 'yMax', _settings.yMin, _settings.yMax);
    _addRangeRow(container, 'Z clip', 'zMin', 'zMax', _settings.zMin, _settings.zMax);

    _addDivider(container);

    // ── Rendering ────────────────────────────────────────
    _addSubLabel(container, 'Rendering');

    _addSliderRow(container, 'Resolution', 'resolution',
      _settings.resolution,
      _settings.minResolution,
      _settings.maxResolution,
      v => {
        _settings.resolution = v;
        Engine.applyConfig({ resolution: v });
        if (window.ModEquations) ModEquations.rebuildAll();
      }
    );

    _addCheckRow(container, 'Wireframe',    'wireframe',   _settings.wireframe,   v => {
      _settings.wireframe = v;
      Engine.applyConfig({ wireframe: v });
      if (window.ModEquations) ModEquations.rebuildAll();
    });
    _addCheckRow(container, 'Transparent',  'transparent', _settings.transparent, v => {
      _settings.transparent = v;
      Engine.applyConfig({ transparent: v });
      if (window.ModEquations) ModEquations.rebuildAll();
    });
    _addCheckRow(container, 'Shadows',      'shadows',     _settings.shadows,     v => {
      _settings.shadows = v;
      Engine.applyConfig({ shadows: v });
    });

    _addDivider(container);

    // ── Advanced (previously had zero UI despite existing in engine.js) ──
    _addSubLabel(container, 'Advanced');

    _addCheckRow(container, 'Bloom', 'bloom', _settings.bloom, v => {
      _settings.bloom = v;
      Engine.applyConfig({ bloom: v });
    });
    _addCheckRow(container, 'Ambient occlusion', 'ambientOcclusion', _settings.ambientOcclusion, v => {
      _settings.ambientOcclusion = v;
      Engine.applyConfig({ ambientOcclusion: v });
    });
    _addCheckRow(container, 'Adaptive resolution', 'adaptiveResolution', _settings.adaptiveResolution, v => {
      _settings.adaptiveResolution = v;
      Engine.applyConfig({ adaptiveResolution: v });
    });
    _addCheckRow(container, 'Adaptive tessellation', 'adaptiveTessellation', _settings.adaptiveTessellation, v => {
      _settings.adaptiveTessellation = v;
      Engine.applyConfig({ adaptiveTessellation: v });
      if (window.ModEquations) ModEquations.rebuildAll();
    });
    _addCheckRow(container, 'Mesh cache', 'meshCacheEnabled', _settings.meshCacheEnabled, v => {
      _settings.meshCacheEnabled = v;
      Engine.applyConfig({ meshCacheEnabled: v });
    });

    _addDivider(container);

    // ── Profiles ─────────────────────────────────────────
    _addSubLabel(container, 'Profiles');
    container.appendChild(_buildProfilesRow());

    _addDivider(container);

    // ── Scene ────────────────────────────────────────────
    _addSubLabel(container, 'Scene');

    _addCheckRow(container, 'Axes',       'showAxes',      _settings.showAxes,      v => {
      _settings.showAxes = v;
      Engine.applyConfig({ showAxes: v });
    });
    _addCheckRow(container, 'Grid',       'showGrid',      _settings.showGrid,      v => {
      _settings.showGrid = v;
      Engine.applyConfig({ showGrid: v });
    });
    _addCheckRow(container, 'Fog',        'fog',           _settings.fog,           v => {
      _settings.fog = v;
      Engine.applyConfig({ fog: v });
    });
    _addCheckRow(container, 'Crosshair',  'showCrosshair', _settings.showCrosshair, v => {
      _settings.showCrosshair = v;
      Engine.applyConfig({ showCrosshair: v });
      const xh = document.getElementById('crosshair');
      if (xh) xh.classList.toggle('visible', v);
    });
    _addCheckRow(container, 'Coord tip',  'showCoordTip',  _settings.showCoordTip,  v => {
      _settings.showCoordTip = v;
      Engine.applyConfig({ showCoordTip: v });
    });

    _addDivider(container);

    // ── Camera ───────────────────────────────────────────
    _addSubLabel(container, 'Camera mode');

    const modeRow = _makeRow();
    modeRow.innerHTML = `<label style="color:var(--t2);width:90px;flex-shrink:0;font-size:11.5px">Projection</label>`;
    const modeSelect = document.createElement('select');
    modeSelect.style.cssText = `
      flex:1;background:var(--s2);border:1px solid var(--b2);
      color:var(--t2);font-size:10.5px;padding:2px 4px;
      border-radius:4px;cursor:pointer;font-family:var(--font-ui)
    `;
    modeSelect.innerHTML = `
      <option value="perspective">Perspective</option>
      <option value="ortho">Orthographic</option>
    `;
    modeSelect.value = _settings.cameraMode;
    modeSelect.addEventListener('change', () => {
      _settings.cameraMode = modeSelect.value;
      const isOrtho = modeSelect.value === 'ortho';
      if (isOrtho !== Camera.isOrtho()) Camera.toggleOrtho();
    });
    modeRow.appendChild(modeSelect);
    container.appendChild(modeRow);

    // Camera speed controls
    _addSliderRow(container, 'Rotate speed', 'rotateSpeed',
      _settings.rotateSpeed, 0.1, 2.0, v => {
        _settings.rotateSpeed = v;
        Camera.setRotateSpeed(v);
      }, 0.05
    );
    _addSliderRow(container, 'Zoom speed', 'zoomSpeed',
      _settings.zoomSpeed, 0.1, 2.0, v => {
        _settings.zoomSpeed = v;
        Camera.setZoomSpeed(v);
      }, 0.05
    );
    _addSliderRow(container, 'Pan speed', 'panSpeed',
      _settings.panSpeed, 0.1, 2.0, v => {
        _settings.panSpeed = v;
        Camera.setPanSpeed(v);
      }, 0.05
    );
    _addCheckRow(container, 'Damping', 'damping', _settings.damping, v => {
      _settings.damping = v;
      Camera.setDamping(v);
    });

    _addDivider(container);

    // ── Camera presets ───────────────────────────────────
    _addSubLabel(container, 'Camera presets');

    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-camera-btn';
    resetBtn.innerHTML = '<i data-lucide="rotate-ccw" width="12" height="12"></i> Reset camera';
    resetBtn.addEventListener('click', () => Camera.reset());
    container.appendChild(resetBtn);

    const camGrid = document.createElement('div');
    camGrid.className = 'cam-grid';

    const camPresets = [
      { key: 'top',   label: 'Top' },
      { key: 'front', label: 'Front' },
      { key: 'side',  label: 'Side' },
      { key: 'iso',   label: 'Isometric' },
      { key: 'back',  label: 'Back' },
      { key: 'bottom',label: 'Bottom' },
    ];

    camPresets.forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.className = 'cam-btn';
      btn.dataset.cam = key;
      btn.textContent = label;
      btn.addEventListener('click', () => Camera.setPreset(key));
      camGrid.appendChild(btn);
    });

    container.appendChild(camGrid);

    _addDivider(container);

    // ── Theme ────────────────────────────────────────────
    _addSubLabel(container, 'Appearance');

    const themeRow = _makeRow();
    themeRow.innerHTML = `<label style="color:var(--t2);width:90px;flex-shrink:0;font-size:11.5px">Theme</label>`;
    const themeToggle = document.createElement('button');
    themeToggle.id = 'theme-toggle-btn';
    themeToggle.style.cssText = `
      flex:1;background:var(--s2);border:1px solid var(--b2);
      color:var(--t2);border-radius:4px;padding:4px 8px;
      cursor:pointer;font-size:11px;font-family:var(--font-ui);
      display:flex;align-items:center;justify-content:center;gap:5px;
      transition:all .14s
    `;
    themeToggle.innerHTML = `
      <i data-lucide="${_settings.theme === 'dark' ? 'sun' : 'moon'}" width="11" height="11"></i>
      ${_settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
    `;
    themeToggle.addEventListener('click', () => {
      _settings.theme = _settings.theme === 'dark' ? 'light' : 'dark';
      _applyTheme(_settings.theme);
      themeToggle.innerHTML = `
        <i data-lucide="${_settings.theme === 'dark' ? 'sun' : 'moon'}" width="11" height="11"></i>
        ${_settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
      `;
      if (window.lucide) lucide.createIcons({ nodes: [themeToggle] });
    });
    themeRow.appendChild(themeToggle);
    container.appendChild(themeRow);

    _addDivider(container);

    // ── Accessibility ────────────────────────────────────
    // Desmos's own 3D calculator is the one tool in their lineup with no
    // display-enlarging setting at all (their other calculators all have
    // one). Large Text below closes that gap; Complex Mode and Audio Trace
    // sit here too since accessibility settings benefit from living in one
    // place rather than being scattered.
    _addSubLabel(container, 'Accessibility');

    _addCheckRow(container, 'Large text', 'largeText', _settings.largeText, v => {
      _settings.largeText = v;
      _applyLargeText(v);
    });

    _addCheckRow(container, 'Complex mode', 'complexMode', _settings.complexMode, v => {
      _settings.complexMode = v;
      // math-engine.js already supports complex evaluation (i = math.complex(0,1),
      // complex-safe derivative/integral/magnitude helpers all exist). This flag
      // is wired through to Engine so graph-builder.js can act on it, but as of
      // this writing graph-builder.js's buildExplicit doesn't check it yet — a
      // surface that evaluates complex (e.g. sqrt(x) for x<0) still renders as a
      // hole either way until it does. Spec for that: when complexMode is true
      // and MathEngine.evalExpr returns a complex result, use its magnitude
      // (Math.hypot(z.re, z.im)) as the plotted height instead of skipping the
      // point. Flagging for vitthalkaradekar rather than editing graph-builder.js
      // directly — not my file.
      Engine.applyConfig({ complexMode: v });
      if (window.ModEquations) ModEquations.rebuildAll();
    });

    const audioTraceRow = _makeRow();
    audioTraceRow.innerHTML = `<label style="color:var(--t2);width:90px;flex-shrink:0;font-size:11.5px">Audio trace</label>`;
    const audioTraceBtn = document.createElement('button');
    audioTraceBtn.style.cssText = `
      flex:1;background:var(--s2);border:1px solid var(--b2);
      color:var(--t2);border-radius:4px;padding:4px 8px;
      cursor:pointer;font-size:11px;font-family:var(--font-ui);
      display:flex;align-items:center;justify-content:center;gap:5px;
    `;
    audioTraceBtn.innerHTML = `<i data-lucide="ear" width="11" height="11"></i> Alt+T to trace`;
    audioTraceBtn.title = 'Hear the currently selected equation as sound — pitch follows value, a click marks each sign change';
    audioTraceBtn.addEventListener('click', () => {
      if (window.ModAudioTrace) ModAudioTrace.toggle();
    });
    audioTraceRow.appendChild(audioTraceBtn);
    container.appendChild(audioTraceRow);
    if (window.lucide) lucide.createIcons({ nodes: [audioTraceRow] });
    _addSubLabel(container, 'Export');

    const exportGrid = document.createElement('div');
    exportGrid.className = 'export-grid';

    const exports = [
      { label: 'PNG',  icon: 'image',        action: () => Engine.screenshot('png') },
      { label: 'JPG',  icon: 'image',        action: () => Engine.screenshot('jpg') },
      { label: 'JSON', icon: 'file-json',    action: _exportJSON },
      // NOTE: this was `Engine.exportOBJ()` — Engine has no such method, so
      // this button silently threw and never worked. OBJ/STL export lives
      // in mod-export.js; wiring both here (STL had no button at all).
      { label: 'OBJ',  icon: 'box',          action: () => window.ModExport && ModExport.exportOBJ() },
      { label: 'Combined', icon: 'boxes',    action: () => window.ModExport && ModExport.exportOBJ({ combined: true }) },
      { label: 'STL',  icon: 'printer',      action: () => window.ModExport && ModExport.exportSTL() },
      { label: 'CSV',  icon: 'table',        action: () => window.ModExport && ModExport.exportCSV() },
      { label: 'URL',  icon: 'link',         action: _copyShareURL },
      { label: 'Short', icon: 'link-2',      action: () => window.ModShare ? ModShare.copyShortLink() : _copyShareURL() },
      { label: 'QR',   icon: 'qr-code',      action: _showQR },
    ];

    exports.forEach(({ label, icon, action }) => {
      const btn = document.createElement('button');
      btn.className = 'export-btn';
      btn.innerHTML = `<i data-lucide="${icon}" width="10" height="10"></i> ${label}`;
      btn.addEventListener('click', action);
      exportGrid.appendChild(btn);
    });

    container.appendChild(exportGrid);

    _addDivider(container);

    // ── Keyboard hints ───────────────────────────────────
    _addSubLabel(container, 'Keyboard shortcuts');

    const hints = document.createElement('div');
    hints.className = 'key-hints';
    hints.innerHTML = `
      <span class="key-hint"><kbd>N</kbd> New equation</span>
      <span class="key-hint"><kbd>R</kbd> Reset camera</span>
      <span class="key-hint"><kbd>M</kbd> Sidebar</span>
      <span class="key-hint"><kbd>T</kbd> Top view</span>
      <span class="key-hint"><kbd>F</kbd> Front view</span>
      <span class="key-hint"><kbd>B</kbd> Back view</span>
      <span class="key-hint"><kbd>I</kbd> Isometric</span>
      <span class="key-hint"><kbd>O</kbd> Ortho toggle</span>
      <span class="key-hint"><kbd>G</kbd> Grid toggle</span>
      <span class="key-hint"><kbd>W</kbd> Wireframe</span>
      <span class="key-hint"><kbd>A</kbd> AI panel</span>
      <span class="key-hint"><kbd>+</kbd><kbd>-</kbd> Zoom</span>
      <span class="key-hint"><kbd>Ctrl Z</kbd> Undo</span>
      <span class="key-hint"><kbd>Ctrl Y</kbd> Redo</span>
      <span class="key-hint"><kbd>Esc</kbd> Close menus</span>
      <span class="key-hint"><kbd>Space</kbd> Animate</span>
      <span class="key-hint"><kbd>?</kbd> All shortcuts</span>
    `;
    container.appendChild(hints);

    // ── Reset all settings button ────────────────────────
    const resetAllBtn = document.createElement('button');
    resetAllBtn.style.cssText = `
      margin-top:10px;width:100%;background:none;
      border:1px solid var(--b2);color:var(--t3);
      border-radius:var(--radius);padding:6px;cursor:pointer;
      font-size:11px;font-family:var(--font-ui);
      display:flex;align-items:center;justify-content:center;gap:5px;
      transition:all .14s
    `;
    resetAllBtn.innerHTML = '<i data-lucide="refresh-ccw" width="11" height="11"></i> Reset all settings';
    resetAllBtn.addEventListener('click', async () => {
      const ok = await _showConfirm('Reset all settings to defaults? This won\'t affect your equations.', {
        confirmLabel: 'Reset',
      });
      if (ok) _resetToDefaults();
    });
    resetAllBtn.addEventListener('mouseenter', () => {
      resetAllBtn.style.borderColor = 'var(--rose)';
      resetAllBtn.style.color = 'var(--rose)';
    });
    resetAllBtn.addEventListener('mouseleave', () => {
      resetAllBtn.style.borderColor = 'var(--b2)';
      resetAllBtn.style.color = 'var(--t3)';
    });
    container.appendChild(resetAllBtn);

    if (window.lucide) lucide.createIcons({ nodes: [container] });
  }

  // ══════════════════════════════════════════════════════
  // SETTINGS PROFILES — one click, several cfg values at once
  // ══════════════════════════════════════════════════════

  const PROFILES = {
    performance: {
      label: 'Performance',
      icon: 'zap',
      values: {
        resolution: 30, adaptiveResolution: true, adaptiveTessellation: false,
        bloom: false, ambientOcclusion: false, shadows: false, antialias: false,
        meshCacheEnabled: true,
      },
    },
    quality: {
      label: 'Quality',
      icon: 'sparkles',
      values: {
        resolution: 90, adaptiveResolution: false, adaptiveTessellation: true,
        bloom: true, ambientOcclusion: true, shadows: true, antialias: true,
        meshCacheEnabled: true,
      },
    },
    battery: {
      label: 'Battery saver',
      icon: 'battery',
      values: {
        resolution: 18, adaptiveResolution: true, adaptiveTessellation: false,
        bloom: false, ambientOcclusion: false, shadows: false, antialias: false,
        meshCacheEnabled: true,
      },
    },
  };

  function applyProfile(key) {
    const profile = PROFILES[key];
    if (!profile) return;
    Object.assign(_settings, profile.values);
    _syncAllToEngine();
    if (window.ModEquations) ModEquations.rebuildAll();
    _buildSettingsPanel();
    _saveToStorage();
    if (window.ModToast) ModToast.show(profile.label + ' profile applied', 'success');
  }

  function _buildProfilesRow() {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px;margin:2px 0 6px';
    Object.entries(PROFILES).forEach(([key, profile]) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        flex:1;background:var(--s2);border:1px solid var(--b2);color:var(--t2);
        border-radius:var(--radius);padding:6px 2px;cursor:pointer;
        font-size:10px;font-family:var(--font-ui);font-weight:500;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        transition:all .14s
      `;
      btn.innerHTML = `<i data-lucide="${profile.icon}" width="13" height="13"></i>${profile.label}`;
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--abrd)'; btn.style.color = 'var(--accent)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--b2)'; btn.style.color = 'var(--t2)'; });
      btn.addEventListener('click', () => applyProfile(key));
      row.appendChild(btn);
    });
    if (window.lucide) lucide.createIcons({ nodes: [row] });
    return row;
  }

  // ══════════════════════════════════════════════════════
  // ROW BUILDERS
  // ══════════════════════════════════════════════════════

  function _makeRow() {
    const row = document.createElement('div');
    row.className = 'setting-row';
    return row;
  }

  function _addSubLabel(container, text) {
    const lbl = document.createElement('span');
    lbl.className = 'sub-label';
    lbl.textContent = text;
    container.appendChild(lbl);
  }

  function _addDivider(container) {
    const d = document.createElement('div');
    d.className = 'divider';
    container.appendChild(d);
  }

  function _addRangeRow(container, label, minKey, maxKey, minVal, maxVal) {
    const row = _makeRow();
    row.innerHTML = `
      <label>${label}</label>
      <input type="number" class="range-min" data-key="${minKey}"
        value="${minVal}" step="1"
        style="width:46px;background:var(--s2);border:1px solid var(--b2);
               color:var(--t1);font-size:11px;padding:2px 4px;border-radius:4px;
               text-align:center;font-family:var(--font-mono)"/>
      <span class="unit">to</span>
      <input type="number" class="range-max" data-key="${maxKey}"
        value="${maxVal}" step="1"
        style="width:46px;background:var(--s2);border:1px solid var(--b2);
               color:var(--t1);font-size:11px;padding:2px 4px;border-radius:4px;
               text-align:center;font-family:var(--font-mono)"/>
    `;

    const minInp = row.querySelector('.range-min');
    const maxInp = row.querySelector('.range-max');

    const onChange = () => {
      const mn = parseFloat(minInp.value);
      const mx = parseFloat(maxInp.value);
      if (isNaN(mn) || isNaN(mx) || mn >= mx) return;
      _settings[minKey] = mn;
      _settings[maxKey] = mx;
      _syncRangeToEngine();
    };

    minInp.addEventListener('change', onChange);
    maxInp.addEventListener('change', onChange);

    // Style on focus
    [minInp, maxInp].forEach(inp => {
      inp.addEventListener('focus', () => inp.style.borderColor = 'var(--abrd)');
      inp.addEventListener('blur',  () => inp.style.borderColor = 'var(--b2)');
    });

    container.appendChild(row);
  }

  function _addSliderRow(container, label, key, value, min, max, onChange, step = 1) {
    const row = _makeRow();

    const dispId = 'setting-disp-' + key;
    row.innerHTML = `
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}"
        step="${step}" value="${value}"
        style="flex:1;accent-color:var(--accent);cursor:pointer"/>
      <span id="${dispId}"
        style="font-family:var(--font-mono);color:var(--accent);
               font-size:11px;width:32px;text-align:right">
        ${value}
      </span>
    `;

    const range = row.querySelector('input[type=range]');
    const disp  = row.querySelector('#' + dispId);

    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      disp.textContent = step < 1 ? v.toFixed(2) : Math.round(v);
      onChange(v);
    });

    container.appendChild(row);
  }

  function _addCheckRow(container, label, key, checked, onChange) {
    const row = _makeRow();
    row.innerHTML = `
      <label>${label}</label>
      <input type="checkbox" ${checked ? 'checked' : ''}
        style="accent-color:var(--accent);cursor:pointer;width:14px;height:14px"/>
    `;

    const chk = row.querySelector('input');
    chk.addEventListener('change', () => onChange(chk.checked));

    container.appendChild(row);
  }

  // ══════════════════════════════════════════════════════
  // SYNC TO ENGINE
  // ══════════════════════════════════════════════════════

  function _syncRangeToEngine() {
    Engine.applyConfig({
      xMin: _settings.xMin, xMax: _settings.xMax,
      yMin: _settings.yMin, yMax: _settings.yMax,
      zMin: _settings.zMin, zMax: _settings.zMax,
    });
    if (window.ModEquations) ModEquations.rebuildAll();
  }

  function _syncAllToEngine() {
    Engine.applyConfig({
      xMin: _settings.xMin, xMax: _settings.xMax,
      yMin: _settings.yMin, yMax: _settings.yMax,
      zMin: _settings.zMin, zMax: _settings.zMax,
      resolution:    _settings.resolution,
      wireframe:     _settings.wireframe,
      transparent:   _settings.transparent,
      shadows:       _settings.shadows,
      showAxes:      _settings.showAxes,
      showGrid:      _settings.showGrid,
      fog:           _settings.fog,
      showCrosshair: _settings.showCrosshair,
      showCoordTip:  _settings.showCoordTip,
      bloom:                _settings.bloom,
      ambientOcclusion:     _settings.ambientOcclusion,
      adaptiveResolution:   _settings.adaptiveResolution,
      adaptiveTessellation: _settings.adaptiveTessellation,
      meshCacheEnabled:     _settings.meshCacheEnabled,
      complexMode:          _settings.complexMode,
    });

    Camera.setRotateSpeed(_settings.rotateSpeed);
    Camera.setZoomSpeed(_settings.zoomSpeed);
    Camera.setPanSpeed(_settings.panSpeed);
    Camera.setDamping(_settings.damping);
  }

  // ══════════════════════════════════════════════════════
  // TOPBAR BUTTONS
  // ══════════════════════════════════════════════════════

  // Mobile bottom sheet (#sidebar at max-width:640px — see style.css).
  // Desktop keeps the plain classList.toggle('closed') drawer behavior
  // it always had; everything below only ever runs when that same
  // breakpoint matches, so desktop's code path is untouched.
  function _isMobileSheet() {
    return !!(window.matchMedia && matchMedia('(max-width:640px)').matches);
  }

  function _setSheetState(state) {
    const sidebar = document.getElementById('sidebar');
    const handle  = document.getElementById('sheet-handle');
    if (!sidebar) return;
    sidebar.dataset.sheet = state;
    // .closed is desktop's class — clear it here so a sheet that was
    // collapsed via the old code path (e.g. before this attribute
    // existed on first load) doesn't leave a stale class lying around.
    sidebar.classList.remove('closed');
    if (handle) handle.setAttribute('aria-expanded', state === 'collapsed' ? 'false' : 'true');
  }

  function _cycleSheetState() {
    const sidebar = document.getElementById('sidebar');
    const current = (sidebar && sidebar.dataset.sheet) || 'collapsed';
    const next = current === 'collapsed' ? 'half' : current === 'half' ? 'expanded' : 'collapsed';
    _setSheetState(next);
  }

  // ── Sheet drag physics ──────────────────────────────────
  // Scoped entirely to #sheet-handle: dragging the sheet's *content*
  // (equation/slider list) is deliberately not supported, since that
  // list scrolls vertically too and a whole-sheet drag zone would
  // constantly fight that scroll gesture. The handle is a large,
  // unambiguous 64px-tall grab target instead — same scoping choice
  // Google/Apple Maps make for their own sheets.
  //
  // Because pointerdown only ever fires here for a touch that started
  // on the handle itself (basic DOM event targeting — nothing global
  // is attached to document/window), this can't intercept a touch that
  // started on #canvas, so it can't interfere with OrbitControls by
  // construction, not just by convention.
  function _initSheetDrag() {
    const handle  = document.getElementById('sheet-handle');
    const sidebar = document.getElementById('sidebar');
    if (!handle || !sidebar) return;

    let dragging   = false;
    let startY     = 0;
    let startTrans = 0;
    let lastY      = 0;
    let lastT      = 0;
    let velocity   = 0;   // px/ms, positive = moving down
    let pendingY   = null;
    let rafId      = null;
    let dragH      = 0;   // sheet height, cached per-drag (constant mid-gesture)
    let dragSafeB  = 0;   // safe-area-inset-bottom, cached per-drag (same reason)

    function safeBottomPx() {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--safe-b');
      return parseFloat(v) || 0;
    }
    function stateY(state, h, safeB) {
      if (state === 'expanded') return 0;
      if (state === 'half')     return h * 0.5;
      return h - 64 - safeB; // collapsed
    }

    function flushFrame() {
      rafId = null;
      if (dragging && pendingY !== null) sidebar.style.transform = `translateY(${pendingY}px)`;
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging   = true;
      dragH      = sidebar.getBoundingClientRect().height;
      dragSafeB  = safeBottomPx();
      startY     = e.clientY;
      startTrans = stateY(sidebar.dataset.sheet || 'collapsed', dragH, dragSafeB);
      lastY = e.clientY; lastT = performance.now(); velocity = 0;
      sidebar.style.transition = 'none'; // 1:1 tracking, no easing lag while dragging
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const max  = dragH - 64 - dragSafeB;
      pendingY   = Math.min(Math.max(startTrans + (e.clientY - startY), 0), max);

      const now = performance.now();
      const dt  = now - lastT;
      if (dt > 0) velocity = (e.clientY - lastY) / dt;
      lastY = e.clientY; lastT = now;

      if (rafId === null) rafId = requestAnimationFrame(flushFrame);
    }

    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

      const currentY   = pendingY !== null ? pendingY : startTrans;
      const collapsedY = dragH - 64 - dragSafeB, halfY = dragH * 0.5, expandedY = 0;

      sidebar.style.transition = ''; // restore the spring-curve CSS transition for the settle animation
      sidebar.style.transform  = '';
      pendingY = null;

      // A quick flick settles by velocity/direction rather than just
      // release position. Two thresholds: a moderate flick nudges one
      // step in that direction (controlled, like a native sheet's
      // "let go mid-drag" behavior); a decisive/fast swipe jumps
      // straight to the extreme regardless of starting state — this is
      // what makes "swipe down to close" actually close it in one
      // gesture from 'expanded', not require two moderate flicks.
      const FLICK = 0.5;        // px/ms (~500px/s) — one step
      const STRONG_FLICK = 1.2; // px/ms (~1200px/s) — straight to the extreme
      let target;
      if (velocity > STRONG_FLICK)       target = 'collapsed';
      else if (velocity < -STRONG_FLICK) target = 'expanded';
      else if (velocity > FLICK)         target = currentY < halfY ? 'half' : 'collapsed';
      else if (velocity < -FLICK)        target = currentY > halfY ? 'half' : 'expanded';
      else {
        const d = {
          expanded:  Math.abs(currentY - expandedY),
          half:      Math.abs(currentY - halfY),
          collapsed: Math.abs(currentY - collapsedY),
        };
        target = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
      }
      _setSheetState(target);
    }

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
  }

  function _initTopbarButtons() {
    // Menu / sidebar toggle
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        if (_isMobileSheet()) {
          const sidebar = document.getElementById('sidebar');
          const current = (sidebar && sidebar.dataset.sheet) || 'collapsed';
          _setSheetState(current === 'collapsed' ? 'half' : 'collapsed');
        } else {
          document.getElementById('sidebar').classList.toggle('closed');
        }
      });
    }

    // Sheet handle: tap cycles collapsed → half → expanded → collapsed;
    // drag (below) does 1:1 tracking with velocity-based snapping.
    // Desktop never sees this (display:none — see style.css), so no
    // mobile guard needed here.
    const sheetHandle = document.getElementById('sheet-handle');
    if (sheetHandle) {
      sheetHandle.addEventListener('click', _cycleSheetState);
    }
    _initSheetDrag();

    // Backdrop: shown only at half/expanded (see style.css); tapping it
    // collapses the sheet, same as tapping outside any other overlay.
    const sheetBackdrop = document.getElementById('sheet-backdrop');
    if (sheetBackdrop) {
      sheetBackdrop.addEventListener('click', () => _setSheetState('collapsed'));
    }

    // AI panel toggle
    const aiBtn = document.getElementById('ai-btn');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => {
        const panel = document.getElementById('ai-panel');
        if (panel) {
          const isOpen = panel.classList.toggle('open');
          aiBtn.classList.toggle('open', isOpen);
        }
      });
    }

    // "More" overflow menu (mobile only — see CSS; a normal inline row on desktop)
    const moreBtn = document.getElementById('more-btn');
    const moreMenu = document.getElementById('tb-more-menu');
    if (moreBtn && moreMenu) {
      const closeMore = () => {
        moreMenu.classList.remove('open');
        moreBtn.setAttribute('aria-expanded', 'false');
      };
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = moreMenu.classList.toggle('open');
        moreBtn.setAttribute('aria-expanded', String(isOpen));
      });
      moreMenu.addEventListener('click', (e) => {
        if (e.target.closest('button')) closeMore();
      });
      document.addEventListener('click', (e) => {
        if (!moreMenu.classList.contains('open')) return;
        if (!moreMenu.contains(e.target) && e.target !== moreBtn && !moreBtn.contains(e.target)) closeMore();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && moreMenu.classList.contains('open')) closeMore();
      });
    }

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', _copyShareURL);
    }

    // Screenshot button
    const shotBtn = document.getElementById('shot-btn');
    if (shotBtn) {
      shotBtn.addEventListener('click', () => {
        Engine.screenshot('png');
        if (window.ModToast) ModToast.show('Screenshot saved', 'success');
      });
    }

    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        const ok = await _showConfirm('Clear all equations and sliders? This can\'t be undone.', {
          confirmLabel: 'Clear', danger: true,
        });
        if (!ok) return;
        if (window.ModEquations) ModEquations.clearAll();
        if (window.ModSliders)   ModSliders.clearAll();
        Engine.clearAllMeshes();
        if (window.ModToast) ModToast.show('Workspace cleared', 'info');
      });
    }

    // Section headers collapse
    document.querySelectorAll('.section-header').forEach(hd => {
      hd.addEventListener('click', () => {
        const secId = 'sec-' + hd.dataset.s;
        const body  = document.getElementById(secId);
        const chev  = hd.querySelector('.section-chevron');
        if (!body) return;
        body.classList.toggle('collapsed');
        chev && chev.classList.toggle('open', !body.classList.contains('collapsed'));
      });
    });
  }

  // ══════════════════════════════════════════════════════
  // HUD BUTTONS
  // ══════════════════════════════════════════════════════

  function _initHUDButtons() {
    const actions = {
      'hud-zoom-in':  () => Camera.zoomIn(),
      'hud-zoom-out': () => Camera.zoomOut(),
      'hud-reset':    () => Camera.reset(),
      'hud-top':      () => Camera.setPreset('top'),
      'hud-front':    () => Camera.setPreset('front'),
      'hud-side':     () => Camera.setPreset('side'),
      'hud-iso':      () => Camera.setPreset('iso'),
      'hud-ortho':    () => {
        const isOrtho = Camera.toggleOrtho();
        const btn = document.getElementById('hud-ortho');
        if (btn) btn.classList.toggle('active', isOrtho);
        const sel = document.querySelector('[data-key="cameraMode"]');
        if (sel) sel.value = isOrtho ? 'ortho' : 'perspective';
      },
      'hud-crosshair': () => {
        _settings.showCrosshair = !_settings.showCrosshair;
        Engine.applyConfig({ showCrosshair: _settings.showCrosshair });
        const btn = document.getElementById('hud-crosshair');
        if (btn) btn.classList.toggle('active', _settings.showCrosshair);
        const xh = document.getElementById('crosshair');
        if (xh) xh.classList.toggle('visible', _settings.showCrosshair);
      },
    };

    Object.entries(actions).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    });

    // data-cam buttons in HUD
    document.querySelectorAll('.hud-btn[data-cam]').forEach(btn => {
      btn.addEventListener('click', () => Camera.setPreset(btn.dataset.cam));
    });

    // Mobile: HUD starts collapsed to a single toggle button (see CSS) —
    // wire it up to reveal/hide the full camera-control stack.
    const hudToggle = document.getElementById('hud-toggle');
    const hud = document.getElementById('hud');
    if (hudToggle && hud) {
      hudToggle.addEventListener('click', () => {
        const isExpanded = hud.classList.toggle('expanded');
        hudToggle.setAttribute('aria-expanded', String(isExpanded));
        hudToggle.classList.toggle('active', isExpanded);
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════════════════

  function _initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // Alt+T: audio trace (same shortcut Desmos uses for the same feature —
      // no reason to invent a different one users would have to relearn)
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (window.ModAudioTrace) ModAudioTrace.toggle();
        return;
      }

      switch (e.key) {
        // ── Equations ──────────────────────────────────
        case 'n': case 'N':
          if (!ctrl) { e.preventDefault(); if (window.ModEquations) ModEquations.addEquation(); }
          break;

        // ── Camera ─────────────────────────────────────
        case 'r': case 'R':
          if (!ctrl) { e.preventDefault(); Camera.reset(); }
          break;
        case 't': case 'T':
          if (!ctrl) { e.preventDefault(); Camera.setPreset('top'); }
          break;
        case 'f': case 'F':
          if (!ctrl) { e.preventDefault(); Camera.setPreset('front'); }
          break;
        case 'b': case 'B':
          if (!ctrl) { e.preventDefault(); Camera.setPreset('back'); }
          break;
        case 'i': case 'I':
          if (!ctrl) { e.preventDefault(); Camera.setPreset('iso'); }
          break;
        case 'o': case 'O':
          if (!ctrl) { e.preventDefault(); Camera.toggleOrtho(); }
          break;
        case '+': case '=':
          e.preventDefault(); Camera.zoomIn(); break;
        case '-': case '_':
          e.preventDefault(); Camera.zoomOut(); break;

        // ── Toggle scene ───────────────────────────────
        case 'g': case 'G':
          if (!ctrl) {
            e.preventDefault();
            _settings.showGrid = !_settings.showGrid;
            Engine.applyConfig({ showGrid: _settings.showGrid });
          }
          break;
        case 'w': case 'W':
          if (!ctrl) {
            e.preventDefault();
            _settings.wireframe = !_settings.wireframe;
            Engine.applyConfig({ wireframe: _settings.wireframe });
            if (window.ModEquations) ModEquations.rebuildAll();
          }
          break;

        // ── UI panels ──────────────────────────────────
        case 'm': case 'M':
          if (!ctrl) {
            e.preventDefault();
            if (_isMobileSheet()) {
              const sidebar = document.getElementById('sidebar');
              const current = (sidebar && sidebar.dataset.sheet) || 'collapsed';
              _setSheetState(current === 'collapsed' ? 'half' : 'collapsed');
            } else {
              document.getElementById('sidebar')?.classList.toggle('closed');
            }
          }
          break;
        case 'a': case 'A':
          if (!ctrl) {
            e.preventDefault();
            const panel = document.getElementById('ai-panel');
            const btn   = document.getElementById('ai-btn');
            if (panel) {
              const open = panel.classList.toggle('open');
              if (btn) btn.classList.toggle('open', open);
            }
          }
          break;

        // ── Animation ──────────────────────────────────
        case ' ':
          e.preventDefault();
          if (window.ModSliders) ModSliders.toggleGlobalAnimation();
          break;

        // ── Undo / Redo ────────────────────────────────
        case 'z':
          if (ctrl) {
            e.preventDefault();
            if (e.shiftKey) { if (window.ModEquations) ModEquations.redo(); }
            else            { if (window.ModEquations) ModEquations.undo(); }
          }
          break;
        case 'y':
          if (ctrl) { e.preventDefault(); if (window.ModEquations) ModEquations.redo(); }
          break;

        // ── Escape ─────────────────────────────────────
        case 'Escape':
          document.getElementById('color-picker')?.classList.remove('open');
          document.getElementById('context-menu')?.classList.remove('open');
          document.getElementById('ai-panel')?.classList.remove('open');
          document.getElementById('ai-btn')?.classList.remove('open');
          if (_isMobileSheet()) _setSheetState('collapsed');
          break;

        // ── Help ───────────────────────────────────────
        case '?':
          e.preventDefault();
          _showCheatSheet();
          break;
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // SHARE / EXPORT
  // ══════════════════════════════════════════════════════

  // Share URL now lives in mod-share.js (it captures camera + full settings,
  // not just the range/resolution/wireframe subset this used to build here —
  // two independent share implementations were quietly drifting apart).
  function _copyShareURL() {
    if (window.ModShare) {
      ModShare.copyShareURL();
    } else if (window.ModToast) {
      ModToast.show('Share module not loaded', 'error');
    }

    const btn = document.getElementById('share-btn');
    if (btn) {
      btn.classList.add('copied');
      const orig = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" width="12" height="12"></i><span> Copied</span>';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = orig;
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      }, 2500);
    }
  }

  function _exportJSON() {
    const state = window.ModShare ? ModShare.buildState() : _buildShareState();
    const json  = JSON.stringify(state, null, 2);
    const a     = document.createElement('a');
    a.download  = 'graph3d-' + Date.now() + '.json';
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.click();
    if (window.ModToast) ModToast.show('JSON exported', 'success');
  }

  // Fallback only — used if ModShare somehow isn't loaded yet. ModShare's
  // buildState() is the canonical, versioned one (includes camera + all
  // settings); this is intentionally the smaller subset it always was.
  function _buildShareState() {
    return {
      equations: window.ModEquations ? ModEquations.serialize() : [],
      sliders:   window.ModSliders   ? ModSliders.serialize()   : {},
      settings: {
        xMin: _settings.xMin, xMax: _settings.xMax,
        yMin: _settings.yMin, yMax: _settings.yMax,
        resolution: _settings.resolution,
        wireframe:  _settings.wireframe,
      },
    };
  }

  function loadFromState(state) {
    if (!state) return;
    if (state.equations && window.ModEquations) ModEquations.deserialize(state.equations);
    if (state.sliders   && window.ModSliders)   ModSliders.deserialize(state.sliders);
    if (state.settings) {
      Object.assign(_settings, state.settings);
      _syncAllToEngine();
    }
  }

  // QR now lives in mod-share.js (single source of truth for anything
  // share-related — was duplicated here before, drifting from the version
  // in mod-share.js that actually includes camera/settings state).
  function _showQR() {
    if (window.ModShare) { ModShare.showQRCode(); return; }
    if (window.ModToast) ModToast.show('Share module not loaded', 'error');
  }

  // ══════════════════════════════════════════════════════
  // CUSTOM MODAL (confirm dialogs, cheat sheet) — replaces native
  // confirm() so consequential choices don't break the app's visual
  // polish. Same inline-CSS-var pattern the existing QR modal used.
  // ══════════════════════════════════════════════════════

  function _showModal({ title, bodyHTML, buttons }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'g3d-modal-overlay';
      overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.7);
        z-index:1100;display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(4px)
      `;

      const btnHTML = buttons.map((b, i) => `
        <button data-i="${i}" style="flex:1;border-radius:6px;padding:8px 12px;
          cursor:pointer;font-size:12px;font-family:var(--font-ui);font-weight:500;
          border:1px solid ${b.danger ? 'var(--rose)' : 'var(--b2)'};
          background:${b.primary ? (b.danger ? 'var(--rose)' : 'var(--accent)') : 'var(--s2)'};
          color:${b.primary ? '#fff' : (b.danger ? 'var(--rose)' : 'var(--t2)')}">
          ${b.label}
        </button>
      `).join('');

      overlay.innerHTML = `
        <div style="background:var(--s1);border:1px solid var(--b2);border-radius:12px;
                    padding:20px;text-align:left;max-width:300px;width:90%;
                    box-shadow:0 24px 60px rgba(0,0,0,.6)">
          ${title ? `<div style="font-size:14px;font-weight:600;color:var(--t1);margin-bottom:10px">${title}</div>` : ''}
          <div style="font-size:12.5px;color:var(--t2);line-height:1.5;margin-bottom:16px">${bodyHTML}</div>
          <div style="display:flex;gap:8px">${btnHTML}</div>
        </div>
      `;

      const cleanup = (value) => { overlay.remove(); document.removeEventListener('keydown', escHandler); resolve(value); };
      const escHandler = e => { if (e.key === 'Escape') cleanup(null); };

      overlay.querySelectorAll('button[data-i]').forEach(btn => {
        btn.addEventListener('click', () => cleanup(buttons[+btn.dataset.i].value));
      });
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });
      document.addEventListener('keydown', escHandler);

      document.body.appendChild(overlay);
    });
  }

  function _showConfirm(message, { danger = false, confirmLabel = 'Confirm' } = {}) {
    return _showModal({
      bodyHTML: message,
      buttons: [
        { label: 'Cancel', value: false },
        { label: confirmLabel, value: true, primary: true, danger },
      ],
    }).then(v => !!v);
  }

  // ══════════════════════════════════════════════════════
  // KEYBOARD SHORTCUT CHEAT SHEET
  // ══════════════════════════════════════════════════════

  const _OWN_SHORTCUTS = {
    'N':          'New equation',
    'G':          'Toggle grid',
    'W':          'Toggle wireframe',
    'M':          'Toggle sidebar',
    'A':          'Toggle AI panel',
    'Alt + T':    'Audio trace the selected equation',
    'Space':      'Play / pause animation',
    'Ctrl/⌘ + Z': 'Undo',
    'Ctrl/⌘ + Y': 'Redo',
    'Esc':        'Close open menu / panel',
    '?':          'Show this cheat sheet',
  };

  function _showCheatSheet() {
    const camShortcuts = (window.Camera && typeof Camera.getKeyboardShortcuts === 'function')
      ? Camera.getKeyboardShortcuts() : {};
    const all = { ..._OWN_SHORTCUTS, ...camShortcuts };

    const rows = Object.entries(all).map(([key, desc]) => `
      <div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;
                  border-bottom:1px solid var(--b2)">
        <kbd style="background:var(--s2);border:1px solid var(--b2);border-radius:4px;
                    padding:1px 6px;font-family:var(--font-mono);font-size:10.5px;
                    color:var(--accent);white-space:nowrap">${key}</kbd>
        <span style="color:var(--t2);font-size:11.5px;text-align:right">${desc}</span>
      </div>
    `).join('');

    _showModal({
      title: 'Keyboard shortcuts',
      bodyHTML: `<div style="max-height:50vh;overflow-y:auto">${rows}</div>`,
      buttons: [{ label: 'Close', value: true, primary: true }],
    });
  }

  // ══════════════════════════════════════════════════════
  // THEME
  // ══════════════════════════════════════════════════════

  let _largeTextStyleInjected = false;

  /**
   * Desmos's other calculators have a display-enlarging setting; their 3D
   * tool doesn't. This closes that gap.
   *
   * Deliberately scoped to #sidebar / #funcs-panel / modal overlays, never
   * to <body> as a whole — most text in this app is inline-styled with
   * fixed px values (not em/rem), so a CSS override would need `!important`
   * everywhere and risks compounding on nested elements. `zoom` sidesteps
   * both problems (it scales rendered layout, not the font-size property,
   * so it isn't fighting inline styles or compounding), and scoping it away
   * from the canvas means the WebGL view's resolution is never affected —
   * only the panels around it get bigger.
   *
   * Known gap: `zoom` lacked Firefox support before Firefox 126. No fallback
   * is implemented for older Firefox — flagging rather than silently
   * shipping a broken toggle for that case.
   */
  function _applyLargeText(enabled) {
    if (!_largeTextStyleInjected) {
      const style = document.createElement('style');
      style.id = 'g3d-large-text-style';
      style.textContent = `
        body.g3d-large-text #sidebar,
        body.g3d-large-text #funcs-panel,
        body.g3d-large-text .g3d-modal-overlay {
          zoom: 1.22;
        }
      `;
      document.head.appendChild(style);
      _largeTextStyleInjected = true;
    }
    document.body.classList.toggle('g3d-large-text', enabled);
    // In-canvas text (axis numbers/labels) isn't covered by the CSS above —
    // that lives in engine.js's own text-sprite rendering. Passing the flag
    // through in case that side gets built; a no-op today if it isn't.
    if (window.Engine) Engine.applyConfig({ largeText: enabled });
  }

  function _applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    _settings.theme = theme;

    // Update Three.js background
    if (window.Engine) {
      const bgColor = theme === 'light' ? 0xf8f9fc : 0x07090f;
      Engine.applyConfig({ bgColor });
    }
  }

  function toggleTheme() {
    const next = _settings.theme === 'dark' ? 'light' : 'dark';
    _applyTheme(next);
    _saveToStorage();
  }

  // ══════════════════════════════════════════════════════
  // RESET DEFAULTS
  // ══════════════════════════════════════════════════════

  function _resetToDefaults() {
    _settings = {
      xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -10, zMax: 10,
      resolution: 55, wireframe: false, transparent: true, shadows: false,
      antialias: true, showAxes: true, showGrid: true, fog: true,
      showCrosshair: false, showCoordTip: true,
      cameraMode: 'perspective', rotateSpeed: 0.5,
      zoomSpeed: 0.9, panSpeed: 0.6, damping: true,
      theme: 'dark', maxResolution: 120, minResolution: 15,
      bloom: false, ambientOcclusion: false, adaptiveResolution: false,
      adaptiveTessellation: false, meshCacheEnabled: true,
      largeText: false, complexMode: false,
    };
    _syncAllToEngine();
    _applyTheme('dark');
    _applyLargeText(false);
    Camera.reset();
    _buildSettingsPanel();
    _saveToStorage();
    if (window.ModToast) ModToast.show('Settings reset to defaults', 'info');
  }

  // ══════════════════════════════════════════════════════
  // PERSIST
  // ══════════════════════════════════════════════════════

  function _saveToStorage() {
    try {
      localStorage.setItem('g3d_settings', JSON.stringify(_settings));
    } catch {}
  }

  function _loadFromStorage() {
    try {
      const raw = localStorage.getItem('g3d_settings');
      if (raw) Object.assign(_settings, JSON.parse(raw));
    } catch {}
  }

  function save() { _saveToStorage(); }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════
  return {
    init,
    get:            () => ({ ..._settings }),
    set:            (k, v) => { _settings[k] = v; _syncAllToEngine(); },
    toggleTheme,
    loadFromState,
    save,
  };

})();

/* ═══════════════════════════════════════════════════════
   UPGRADES — Units, Configurable grid, Accessibility
═══════════════════════════════════════════════════════ */

const ModSettingsExtended = (() => {

  // ── Units system ──────────────────────────────────
  const UNITS = {
    default:  { label: 'Default',  scale: 1,              symbol: '' },
    radians:  { label: 'Radians',  scale: 1,              symbol: 'rad' },
    degrees:  { label: 'Degrees',  scale: Math.PI / 180,  symbol: '°' },
    meters:   { label: 'Meters',   scale: 1,              symbol: 'm' },
    cm:       { label: 'Centimeters', scale: 0.01,        symbol: 'cm' },
  };

  let _currentUnit = 'default';
  let _gridSpacing = 1;

  function setUnit(unitKey) {
    _currentUnit = unitKey;
    if (window.ModToast) ModToast.show('Units: ' + UNITS[unitKey].label, 'info');
  }

  function getUnitScale() { return UNITS[_currentUnit]?.scale || 1; }
  function getUnitSymbol() { return UNITS[_currentUnit]?.symbol || ''; }

  // ── Configurable grid spacing ──────────────────────
  function setGridSpacing(n) {
    _gridSpacing = Math.max(0.1, parseFloat(n) || 1);
    // Rebuild grid via Engine if available
    if (window.Engine) {
      Engine.applyConfig({ gridSpacing: _gridSpacing });
    }
  }

  // ── Accessibility ──────────────────────────────────
  function initAccessibility() {
    // Keyboard focus visible ring
    const style = document.createElement('style');
    style.textContent = `
      :focus-visible {
        outline: 2px solid var(--accent) !important;
        outline-offset: 2px !important;
      }
      button:focus-visible, input:focus-visible, select:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .hud-btn:focus-visible { outline-color: var(--accent); }
    `;
    document.head.appendChild(style);

    // ARIA labels on HUD buttons
    const ariaMap = {
      'hud-zoom-in':  'Zoom in',
      'hud-zoom-out': 'Zoom out',
      'hud-top':      'Top view',
      'hud-front':    'Front view',
      'hud-side':     'Side view',
      'hud-iso':      'Isometric view',
      'hud-reset':    'Reset camera',
      'hud-crosshair':'Toggle crosshair',
      'hud-ortho':    'Toggle orthographic projection',
      'menu-btn':     'Toggle sidebar',
      'ai-btn':       'Open AI assistant',
      'share-btn':    'Share graph',
      'shot-btn':     'Take screenshot',
      'anim-btn':     'Toggle animation',
      'clear-btn':    'Clear workspace',
    };
    Object.entries(ariaMap).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (el) { el.setAttribute('aria-label', label); el.setAttribute('title', label); }
    });

    // Role and region landmarks
    const sidebar = document.getElementById('sidebar');
    if (sidebar) { sidebar.setAttribute('role', 'complementary'); sidebar.setAttribute('aria-label', 'Equation panel'); }
    // Note: canvas already has role="img" + a descriptive aria-label set
    // directly in the HTML template (see tools/build.js) — not repeated
    // here, since setting it again at init time would just overwrite
    // that with a shorter, less useful label.

    // High contrast preference
    if (window.matchMedia && matchMedia('(prefers-contrast: high)').matches) {
      document.documentElement.style.setProperty('--b1', '#334466');
      document.documentElement.style.setProperty('--b2', '#4455aa');
      document.documentElement.style.setProperty('--t2', '#ccddff');
    }

    // Reduced motion preference
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const s = document.createElement('style');
      s.textContent = '*, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }';
      document.head.appendChild(s);
    }
  }

  // ── Inject units + grid UI into settings panel ────
  function injectSettingsExtras() {
    const container = document.getElementById('sec-cfg');
    if (!container) return;

    const existing = container.querySelector('#units-section');
    if (existing) return;

    // Find divider to insert after
    const dividers = container.querySelectorAll('.divider');
    const insertPoint = dividers[dividers.length - 1] || container.lastChild;

    const section = document.createElement('div');
    section.id = 'units-section';

    const sub = document.createElement('span');
    sub.className = 'sub-label';
    sub.textContent = 'Units & Grid';
    section.appendChild(sub);

    // Units selector
    const unitRow = document.createElement('div');
    unitRow.className = 'setting-row';
    unitRow.innerHTML = `<label>Units</label>`;
    const unitSel = document.createElement('select');
    unitSel.style.cssText = 'flex:1;background:var(--s2);border:1px solid var(--b2);color:var(--t2);font-size:10.5px;padding:2px 4px;border-radius:4px';
    Object.entries(UNITS).forEach(([key, u]) => {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = u.label;
      unitSel.appendChild(opt);
    });
    unitSel.addEventListener('change', () => setUnit(unitSel.value));
    unitRow.appendChild(unitSel);
    section.appendChild(unitRow);

    // Grid spacing
    const gridRow = document.createElement('div');
    gridRow.className = 'setting-row';
    gridRow.innerHTML = `
      <label>Grid spacing</label>
      <input type="number" value="1" min="0.1" max="10" step="0.5"
        style="width:60px;background:var(--s2);border:1px solid var(--b2);
               color:var(--t1);font-size:11px;padding:2px 4px;border-radius:4px;
               text-align:center;font-family:var(--font-mono)"/>
    `;
    const gridInp = gridRow.querySelector('input');
    gridInp.addEventListener('change', () => setGridSpacing(gridInp.value));
    section.appendChild(gridRow);

    container.insertBefore(section, insertPoint);
  }

  function init() {
    initAccessibility();
    setTimeout(injectSettingsExtras, 500);
  }

  return { init, setUnit, getUnitScale, getUnitSymbol, setGridSpacing };

})();

window.ModSettingsExtended = ModSettingsExtended;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ModSettingsExtended.init);
} else {
  ModSettingsExtended.init();
}
