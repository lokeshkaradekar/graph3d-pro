/**
 * Graph3D Pro — mod-share.js
 * Module 11 — URL Sharing, QR Codes, Autosave, Session Restore
 * Updated to integrate with cloud backend via ModCloud.
 */

const ModShare = (() => {

  const AUTOSAVE_KEY = 'g3d_autosave';
  const AUTOSAVE_INTERVAL = 30000; // 30s

  const STATE_VERSION = 2;

  let _autosaveTimer = null;

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════

  function init() {
    _startAutosave();
    _restoreOnLoad();
    window.addEventListener('beforeunload', () => _autosave());
  }

  // ══════════════════════════════════════════════════════
  // CAMERA STATE
  // ══════════════════════════════════════════════════════

  function _captureCamera() {
    if (!window.Camera || typeof Camera.active !== 'function') return null;
    try {
      const cam = Camera.active();
      const controls = typeof Camera.getControls === 'function' ? Camera.getControls() : null;
      const target = controls ? controls.target : null;
      return {
        px: +cam.position.x.toFixed(4),
        py: +cam.position.y.toFixed(4),
        pz: +cam.position.z.toFixed(4),
        tx: target ? +target.x.toFixed(4) : 0,
        ty: target ? +target.y.toFixed(4) : 0,
        tz: target ? +target.z.toFixed(4) : 0,
        ortho: !!(typeof Camera.isOrtho === 'function' && Camera.isOrtho()),
        fov: typeof Camera.getFOV === 'function' ? +Camera.getFOV().toFixed(2) : undefined,
      };
    } catch { return null; }
  }

  function _applyCamera(cam) {
    if (!cam || !window.Camera) return;
    try {
      if (cam.ortho && typeof Camera.setOrtho === 'function') Camera.setOrtho();
      else if (!cam.ortho && typeof Camera.setPerspective === 'function') Camera.setPerspective();

      const active = typeof Camera.active === 'function' ? Camera.active() : null;
      if (active && typeof cam.px === 'number') active.position.set(cam.px, cam.py, cam.pz);

      const controls = typeof Camera.getControls === 'function' ? Camera.getControls() : null;
      if (controls && typeof cam.tx === 'number') {
        controls.target.set(cam.tx, cam.ty, cam.tz);
        controls.update();
      }
      if (typeof cam.fov === 'number' && typeof Camera.setFOV === 'function') Camera.setFOV(cam.fov);
    } catch {}
  }

  // ══════════════════════════════════════════════════════
  // BUILD STATE OBJECT
  // ══════════════════════════════════════════════════════

  function buildState() {
    return {
      v: STATE_VERSION,
      ts: Date.now(),
      equations: window.ModEquations ? ModEquations.serialize() : [],
      sliders:   window.ModSliders   ? ModSliders.serialize()   : {},
      camera:    _captureCamera(),
      settings:  window.ModSettings  ? ModSettings.get()        : null,
    };
  }

  // ══════════════════════════════════════════════════════
  // SHARE URL (client-side hash encoding)
  // ══════════════════════════════════════════════════════

  function getShareURL() {
    const state = buildState();
    const encoded = encodeURIComponent(JSON.stringify(state));
    const base = window.location.origin + window.location.pathname;
    return base + '?state=' + encoded;
  }

  async function copyShareURL() {
    const url = getShareURL();
    try {
      await navigator.clipboard.writeText(url);
      _toast('Share link copied!', 'success');
    } catch {
      _toast('Could not copy to clipboard', 'error');
    }
    return url;
  }

  // ══════════════════════════════════════════════════════
  // LOCAL AUTOSAVE
  // ══════════════════════════════════════════════════════

  function _autosave() {
    try {
      const state = buildState();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    } catch {}
    // Mark cloud as dirty if user is logged in
    if (window.ModCloud) ModCloud.markDirty();
  }

  function _startAutosave() {
    if (_autosaveTimer) clearInterval(_autosaveTimer);
    _autosaveTimer = setInterval(_autosave, AUTOSAVE_INTERVAL);
  }

  function forceSave() { _autosave(); }

  function clearAutosave() {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
  }

  // ══════════════════════════════════════════════════════
  // RESTORE ON LOAD
  // ══════════════════════════════════════════════════════

  async function _restoreOnLoad() {
    // Priority 1: URL state param (shared link)
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get('state');
    if (stateParam) {
      try {
        const state = JSON.parse(decodeURIComponent(stateParam));
        await _applyStateDeferred(state);
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('state');
        history.replaceState(null, '', url.toString());
        return;
      } catch {}
    }

    // Priority 2: URL hash (legacy)
    const hash = window.location.hash.slice(1);
    if (hash && hash.length > 10) {
      try {
        const state = JSON.parse(decodeURIComponent(hash));
        await _applyStateDeferred(state);
        history.replaceState(null, '', window.location.pathname);
        return;
      } catch {}
    }

    // Priority 3: Local autosave
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        await _applyStateDeferred(state);
      }
    } catch {}
  }

  function _applyStateDeferred(state) {
    return new Promise(resolve => {
      // Wait for modules to be ready
      const attempt = (retries = 0) => {
        if (window.ModEquations || retries > 10) {
          _applyState(state);
          resolve();
        } else {
          setTimeout(() => attempt(retries + 1), 200);
        }
      };
      attempt();
    });
  }

  function _applyState(state) {
    if (!state) return;
    if (state.equations && window.ModEquations) {
      try { ModEquations.deserialize(state.equations); } catch {}
    }
    if (state.sliders && window.ModSliders) {
      try { ModSliders.deserialize(state.sliders); } catch {}
    }
    if (state.camera) {
      setTimeout(() => _applyCamera(state.camera), 300);
    }
    if (state.settings && window.ModSettings && typeof ModSettings.set === 'function') {
      try { ModSettings.set(state.settings); } catch {}
    }
  }

  // ══════════════════════════════════════════════════════
  // LOAD FROM HASH / QUERY ID (legacy compat)
  // ══════════════════════════════════════════════════════

  async function loadFromHash(hash) {
    if (!hash) return;
    try {
      const state = JSON.parse(decodeURIComponent(hash));
      _applyState(state);
    } catch {}
  }

  async function loadFromQueryId(id) {
    // For cloud-based short links: delegate to ModCloud
    if (window.ModCloud) {
      await ModCloud.loadFromShareToken(id);
    }
  }

  async function saveShortLink() {
    if (!window.ModCloud || !ModCloud.isLoggedIn()) {
      _toast('Sign in to create short links', 'info');
      return null;
    }
    const graph = await ModCloud.saveGraph({ title: 'Shared Graph', visibility: 'shared', forceNew: true });
    if (graph?.shareToken) {
      const url = `${window.location.origin}/?share=${graph.shareToken}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      _toast('Short link copied!', 'success');
      return url;
    }
    return null;
  }

  async function copyShortLink() { return saveShortLink(); }

  // ══════════════════════════════════════════════════════
  // QR CODE
  // ══════════════════════════════════════════════════════

  function showQRCode() {
    const url = getShareURL();
    const encodedUrl = encodeURIComponent(url);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
    const win = window.open('', '_blank', 'width=250,height=280,toolbar=no');
    if (win) {
      win.document.write(`<html><body style="margin:0;background:#07090f;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px">
        <img src="${qrUrl}" width="200" height="200" style="border-radius:8px"/>
        <p style="color:#fff;font-family:sans-serif;font-size:13px;margin:0">Scan to open graph</p>
      </body></html>`);
    }
  }

  // ══════════════════════════════════════════════════════
  // SOCIAL SHARING
  // ══════════════════════════════════════════════════════

  function shareToTwitter() {
    const url = getShareURL();
    const text = 'Check out this 3D graph I made with Graph3D Pro';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  }

  function shareToWhatsApp() {
    const url = getShareURL();
    window.open(`https://wa.me/?text=${encodeURIComponent('Check out this 3D graph: ' + url)}`, '_blank');
  }

  function shareViaEmail() {
    const url = getShareURL();
    const subject = 'Check out this 3D graph';
    const body = 'I made this 3D graph with Graph3D Pro:\n\n' + url;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // ══════════════════════════════════════════════════════
  // EMBED CODE
  // ══════════════════════════════════════════════════════

  function getEmbedCode() {
    const url = getShareURL();
    return `<iframe src="${url}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
  }

  async function copyEmbedCode() {
    const code = getEmbedCode();
    try {
      await navigator.clipboard.writeText(code);
      _toast('Embed code copied!', 'success');
    } catch {
      _toast('Could not copy embed code', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // PRESET SHARE URL
  // ══════════════════════════════════════════════════════

  function getPresetShareURL(preset) {
    const base = window.location.origin + window.location.pathname;
    return base + '?state=' + encodeURIComponent(JSON.stringify({ v: 2, equations: [{ type: preset.type, expr: preset.expr, color: preset.color }], sliders: {}, camera: null, settings: null }));
  }

  // ══════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════

  function _toast(msg, type = 'info') {
    if (window.showToast) { showToast(msg, type); return; }
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════

  return {
    init,
    buildState,
    getShareURL,
    copyShareURL,
    showQRCode,
    loadFromHash,
    forceSave,
    clearAutosave,
    getEmbedCode,
    copyEmbedCode,
    shareToTwitter,
    shareToWhatsApp,
    shareViaEmail,
    saveShortLink,
    copyShortLink,
    loadFromQueryId,
    getPresetShareURL,
  };

})();
