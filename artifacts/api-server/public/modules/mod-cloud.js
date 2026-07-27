/**
 * Graph3D Pro — mod-cloud.js
 * Cloud Sync Module — Save/Load graphs to the Graph3D backend API.
 * Handles: graph list, create, update, delete, sharing, version history.
 */

const ModCloud = (() => {

  const API = window.GRAPH3D_API_BASE ?? '';
  let _user = null;   // set by initAccountState
  let _graphs = [];   // cached list of user's cloud graphs
  let _autosaveTimer = null;
  let _currentGraphId = null;         // graph currently open in the editor
  let _currentGraphVisibility = null; // that graph's actual current visibility (private/shared/public)
  let _isDirty = false;       // unsaved local changes?
  let _panel = null;          // DOM reference to graphs panel

  // ── Auth helpers ─────────────────────────────────────────────────────────

  function isLoggedIn() { return !!_user; }

  function setUser(user) {
    _user = user;
    _updateCloudBtn();
  }

  // ── API fetch helpers ─────────────────────────────────────────────────────

  async function apiFetch(path, opts = {}) {
    const r = await fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
      ...opts,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error ?? 'Request failed'), { status: r.status, data });
    return data;
  }

  // ── Graph state capture ───────────────────────────────────────────────────

  function _captureState() {
    return {
      equations: window.ModEquations ? ModEquations.serialize() : [],
      sliders:   window.ModSliders   ? ModSliders.serialize()   : {},
      settings:  window.ModSettings  ? ModSettings.get()        : null,
    };
  }

  function _applyState(state) {
    if (!state) return;
    if (state.equations && window.ModEquations) ModEquations.deserialize(state.equations);
    if (state.sliders   && window.ModSliders)   ModSliders.deserialize(state.sliders);
    if (state.settings  && window.ModSettings)  ModSettings.set(state.settings);
  }

  // ── Save current graph ────────────────────────────────────────────────────

  async function saveGraph(opts = {}) {
    if (!isLoggedIn()) {
      _toast('Sign in to save graphs to the cloud', 'info');
      return null;
    }

    const data = _captureState();
    const title = opts.title ?? _currentGraphTitle() ?? 'Untitled Graph';
    const visibility = opts.visibility ?? 'private';

    try {
      let graph;
      if (_currentGraphId && !opts.forceNew) {
        // Update existing
        graph = (await apiFetch(`/api/graphs/${_currentGraphId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, data, visibility }),
        })).graph;
      } else {
        // Create new
        graph = (await apiFetch('/api/graphs', {
          method: 'POST',
          body: JSON.stringify({ title, data, visibility }),
        })).graph;
        _currentGraphId = graph.id;
      }

      _isDirty = false;
      _currentGraphVisibility = visibility;
      _updateDirtyIndicator();
      _toast(`Graph "${title}" saved`, 'success');
      await _refreshGraphList();
      return graph;
    } catch (err) {
      if (err.status === 403 && err.data?.upgrade) {
        _toast('Upgrade your plan to save more graphs', 'error');
      } else {
        _toast('Failed to save graph', 'error');
      }
      return null;
    }
  }

  // ── Load a graph ──────────────────────────────────────────────────────────

  async function loadGraph(graphId) {
    try {
      const { graph } = await apiFetch(`/api/graphs/${graphId}`);
      _applyState(graph.data);
      _currentGraphId = graph.id;
      _currentGraphVisibility = graph.visibility;
      _isDirty = false;
      _updateDirtyIndicator();
      _updateCurrentTitle(graph.title);
      _toast(`Loaded "${graph.title}"`, 'success');
      closePanel();
      return graph;
    } catch {
      _toast('Failed to load graph', 'error');
      return null;
    }
  }

  // ── Delete a graph ────────────────────────────────────────────────────────

  async function deleteGraph(graphId) {
    try {
      await apiFetch(`/api/graphs/${graphId}`, { method: 'DELETE' });
      if (_currentGraphId === graphId) {
        _currentGraphId = null;
        _currentGraphVisibility = null;
        _isDirty = false;
        _updateDirtyIndicator();
      }
      await _refreshGraphList();
      _toast('Graph deleted', 'success');
      return true;
    } catch {
      _toast('Failed to delete graph', 'error');
      return false;
    }
  }

  // ── Enable sharing ────────────────────────────────────────────────────────

  async function enableSharing(graphId) {
    try {
      const { shareToken } = await apiFetch(`/api/graphs/${graphId}/share`, { method: 'POST' });
      const shareUrl = `${window.location.origin}/?share=${shareToken}`;
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      _toast('Share link copied to clipboard!', 'success');
      return shareUrl;
    } catch (err) {
      if (err.status === 403) {
        _toast('Graph sharing requires a paid plan', 'error');
      } else {
        _toast('Failed to enable sharing', 'error');
      }
      return null;
    }
  }

  // ── Load from share token ─────────────────────────────────────────────────

  async function loadFromShareToken(token) {
    try {
      const { graph } = await apiFetch(`/api/graphs/share/${token}`);
      _applyState(graph.data);
      _currentGraphId = null; // shared graph is read-only unless user saves it
      _currentGraphVisibility = null;
      _isDirty = false;
      _updateCurrentTitle(`${graph.title} (shared)`);
      return graph;
    } catch {
      console.warn('[ModCloud] Could not load shared graph:', token);
      return null;
    }
  }

  // ── Graph list ────────────────────────────────────────────────────────────

  async function _refreshGraphList() {
    if (!isLoggedIn()) return;
    try {
      const { graphs } = await apiFetch('/api/graphs');
      _graphs = graphs;
      _renderGraphList();
    } catch {
      // Non-fatal
    }
  }

  function _renderGraphList() {
    const list = document.getElementById('cloud-graph-list');
    if (!list) return;

    if (_graphs.length === 0) {
      list.innerHTML = `<div class="cg-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        <p>No saved graphs yet</p>
        <span>Save the current graph to get started</span>
      </div>`;
      return;
    }

    list.innerHTML = _graphs.map(g => `
      <div class="cg-item ${g.id === _currentGraphId ? 'cg-item-active' : ''}" data-id="${g.id}">
        <div class="cg-thumb" style="background:linear-gradient(135deg,var(--s3),var(--s4))">
          ${g.thumbnailUrl ? `<img src="${g.thumbnailUrl}" alt=""/>` : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5"><path d="M3 3v18h18"/><path d="m7 16 4-8 4 4 2-4"/></svg>`}
        </div>
        <div class="cg-info">
          <div class="cg-title">${_esc(g.title)}</div>
          <div class="cg-meta">
            <span class="cg-vis cg-vis-${g.visibility}">${g.visibility}</span>
            <span>${_relTime(g.updatedAt)}</span>
          </div>
        </div>
        <div class="cg-actions">
          <button class="cg-btn" title="Load" onclick="ModCloud.loadGraph('${g.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="cg-btn" title="Share" onclick="ModCloud.enableSharing('${g.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button class="cg-btn cg-btn-danger" title="Delete" onclick="ModCloud._confirmDelete('${g.id}','${_esc(g.title)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Click on card body to load
    list.querySelectorAll('.cg-item').forEach(item => {
      item.addEventListener('click', e => {
        if (!e.target.closest('.cg-btn')) loadGraph(item.dataset.id);
      });
    });
  }

  function _confirmDelete(graphId, title) {
    if (confirm(`Delete "${title}"? This cannot be undone.`)) deleteGraph(graphId);
  }

  // ── Save dialog ───────────────────────────────────────────────────────────

  function showSaveDialog() {
    if (!isLoggedIn()) {
      window.location.href = '/login?next=/';
      return;
    }

    const dialog = document.getElementById('save-graph-dialog');
    if (!dialog) { _quickSave(); return; }

    const titleInput = dialog.querySelector('#save-graph-title');
    const visSelect = dialog.querySelector('#save-graph-visibility');
    if (titleInput) titleInput.value = _currentGraphTitle() ?? 'Untitled Graph';
    // Reflect the CURRENTLY open graph's actual visibility, not a
    // hardcoded 'private' — otherwise a plain resave of a graph that's
    // already shared/public would silently downgrade it back to
    // private on the next PUT (the dropdown value always gets sent),
    // breaking any link already handed out with no warning.
    if (visSelect) visSelect.value = _currentGraphVisibility ?? 'private';

    // This is a plain <div>, not a native <dialog> element — its
    // visibility is driven entirely by the .open CSS class (see
    // style-pro.css), not by .showModal()/[hidden]. Calling those had
    // no effect, so the dialog never actually appeared from any of its
    // trigger points.
    dialog.classList.add('open');
  }

  function _quickSave() {
    saveGraph({ title: _currentGraphTitle() ?? 'Untitled Graph' });
  }

  // ── Panel open/close ──────────────────────────────────────────────────────

  function openPanel() {
    const panel = document.getElementById('cloud-panel');
    if (!panel) return;
    panel.classList.add('open');
    _refreshGraphList();
  }

  function closePanel() {
    const panel = document.getElementById('cloud-panel');
    if (panel) panel.classList.remove('open');
  }

  function togglePanel() {
    const panel = document.getElementById('cloud-panel');
    if (!panel) return;
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  // ── Autosave ──────────────────────────────────────────────────────────────

  function _startAutosave() {
    clearInterval(_autosaveTimer);
    if (!isLoggedIn()) return;
    _autosaveTimer = setInterval(() => {
      if (_currentGraphId && _isDirty) saveGraph();
    }, 60000); // autosave every 60s if dirty
  }

  function markDirty() {
    if (!_isDirty) {
      _isDirty = true;
      _updateDirtyIndicator();
    }
  }

  // ── Dirty state indicator ─────────────────────────────────────────────────

  function _updateDirtyIndicator() {
    const btn = document.getElementById('cloud-save-btn');
    if (!btn) return;
    if (_isDirty && _currentGraphId) {
      btn.title = 'Unsaved changes — click to save';
      btn.querySelector('.cloud-dot')?.classList.add('cloud-dot-dirty');
    } else {
      btn.title = 'Save to cloud';
      btn.querySelector('.cloud-dot')?.classList.remove('cloud-dot-dirty');
    }
  }

  function _updateCloudBtn() {
    const btn = document.getElementById('cloud-save-btn');
    if (!btn) return;
    btn.style.display = isLoggedIn() ? 'flex' : 'none';
  }

  function _updateCurrentTitle(title) {
    const el = document.getElementById('current-graph-title');
    if (el) el.textContent = title;
  }

  function _currentGraphTitle() {
    const el = document.getElementById('current-graph-title');
    return el?.textContent?.trim() || null;
  }

  // ── Check for shared graph in URL ─────────────────────────────────────────

  async function _checkShareUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share') || params.get('g');
    if (token && token.length < 60) { // share tokens are short; long ones are URL-encoded state
      await loadFromShareToken(token);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      url.searchParams.delete('g');
      history.replaceState(null, '', url.toString());
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _relTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function _toast(msg, type = 'info') {
    if (window.showToast) { showToast(msg, type); return; }
    // Fallback: create a basic toast
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    await _checkShareUrl();
    _updateCloudBtn();
    _startAutosave();

    // Wire up save dialog
    const saveForm = document.getElementById('save-graph-form');
    if (saveForm) {
      saveForm.addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('save-graph-title')?.value.trim() ?? 'Untitled';
        const visibility = document.getElementById('save-graph-visibility')?.value ?? 'private';
        await saveGraph({ title, visibility, forceNew: false });
        document.getElementById('save-graph-dialog')?.classList.remove('open');
      });
    }

    // New graph button
    document.getElementById('cloud-new-btn')?.addEventListener('click', () => {
      if (window.ModEquations) ModEquations.clearAll?.();
      _currentGraphId = null;
      _currentGraphVisibility = null;
      _isDirty = false;
      _updateCurrentTitle('Untitled Graph');
      closePanel();
    });
  }

  return {
    init,
    setUser,
    isLoggedIn,
    openPanel,
    closePanel,
    togglePanel,
    saveGraph,
    loadGraph,
    deleteGraph,
    enableSharing,
    loadFromShareToken,
    showSaveDialog,
    markDirty,
    _confirmDelete,
  };

})();

window.ModCloud = ModCloud;
