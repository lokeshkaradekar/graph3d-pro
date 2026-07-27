/**
 * Graph3D Pro — mod-account.js
 * Account, subscription, billing, notifications, and usage UI module.
 */

const ModAccount = (() => {

  const API = window.GRAPH3D_API_BASE ?? '';
  let _user = null;
  let _subscription = null;
  let _features = [];
  let _notifications = [];
  let _unreadCount = 0;
  let _notifPollTimer = null;

  // ── API helpers ───────────────────────────────────────────────────────────

  async function apiFetch(path, opts = {}) {
    const r = await fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
      ...opts,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error ?? 'Request failed'), { status: r.status });
    return data;
  }

  // ── Auth state ────────────────────────────────────────────────────────────

  async function fetchMe() {
    try {
      const data = await apiFetch('/api/auth/me');
      return data.user ?? null;
    } catch {
      return null;
    }
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.replace('/login');
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  async function fetchSubscription() {
    try {
      return (await apiFetch('/api/subscriptions/me'));
    } catch { return null; }
  }

  async function fetchPlans() {
    try {
      return (await apiFetch('/api/subscriptions/plans')).plans ?? [];
    } catch { return []; }
  }

  async function fetchFeatures() {
    try {
      return (await apiFetch('/api/features/me')).features ?? [];
    } catch { return []; }
  }

  async function fetchUsage() {
    try {
      return (await apiFetch('/api/usage/me'));
    } catch { return { usage: [], summary: [] }; }
  }

  async function startCheckout(planSlug, billingCycle = 'monthly') {
    try {
      const { url } = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ planSlug, billingCycle }),
      });
      if (url) window.location.href = url;
    } catch (err) {
      _toast(err.message || 'Could not start checkout', 'error');
    }
  }

  async function cancelSubscription(subscriptionId) {
    if (!confirm('Cancel your subscription? You will keep access until the current period ends.')) return;
    try {
      await apiFetch('/api/subscriptions/cancel', {
        method: 'POST',
        body: JSON.stringify({ subscriptionId, immediate: false }),
      });
      _toast('Subscription will be canceled at period end', 'success');
      await _refreshSubscription();
    } catch {
      _toast('Failed to cancel subscription', 'error');
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async function fetchNotifications() {
    try {
      const data = await apiFetch('/api/notifications');
      _notifications = data.notifications ?? [];
      _unreadCount = data.unreadCount ?? 0;
      _updateBadge();
      return data;
    } catch { return { notifications: [], unreadCount: 0 }; }
  }

  async function markRead(notifId) {
    try {
      await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
      const n = _notifications.find(n => n.id === notifId);
      if (n) { n.readAt = new Date().toISOString(); _unreadCount = Math.max(0, _unreadCount - 1); }
      _updateBadge();
      _renderNotifications();
    } catch {}
  }

  async function markAllRead() {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      _notifications.forEach(n => { n.readAt = n.readAt ?? new Date().toISOString(); });
      _unreadCount = 0;
      _updateBadge();
      _renderNotifications();
    } catch {}
  }

  function _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = _unreadCount > 9 ? '9+' : String(_unreadCount);
    badge.style.display = _unreadCount > 0 ? 'flex' : 'none';
  }

  function _renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    const markAllBtn = document.getElementById('notif-mark-all');
    if (markAllBtn) markAllBtn.style.display = _unreadCount > 0 ? 'block' : 'none';

    if (_notifications.length === 0) {
      list.innerHTML = `<div class="notif-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span>No notifications</span>
      </div>`;
      return;
    }

    list.innerHTML = _notifications.slice(0, 20).map(n => `
      <div class="notif-item ${n.readAt ? '' : 'notif-unread'}" data-id="${n.id}">
        <div class="notif-icon notif-icon-${_notifIconType(n.type)}">${_notifIcon(n.type)}</div>
        <div class="notif-body">
          <div class="notif-title">${_esc(n.title)}</div>
          ${n.body ? `<div class="notif-desc">${_esc(n.body)}</div>` : ''}
          <div class="notif-time">${_relTime(n.createdAt)}</div>
        </div>
        ${!n.readAt ? `<button class="notif-read-btn" title="Mark as read" data-id="${n.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>
        </button>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.notif-read-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); markRead(btn.dataset.id); });
    });
  }

  function _notifIconType(type) {
    if (type.startsWith('payment')) return 'green';
    if (type.startsWith('subscription')) return 'blue';
    if (type === 'email_verified') return 'green';
    if (type.includes('failed') || type.includes('expired')) return 'red';
    return 'blue';
  }

  function _notifIcon(type) {
    if (type.startsWith('payment_success')) return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>';
    if (type.startsWith('subscription')) return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>';
  }

  // ── Account panel UI ──────────────────────────────────────────────────────

  function _renderAccountPanel() {
    if (!_user) return;

    const avatar = document.getElementById('acct-avatar');
    const name   = document.getElementById('acct-name');
    const email  = document.getElementById('acct-email');
    const badge  = document.getElementById('acct-plan-badge');

    if (avatar) {
      if (_user.avatarUrl) {
        avatar.innerHTML = `<img src="${_esc(_user.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      } else {
        const initials = (_user.displayName ?? _user.email).slice(0, 2).toUpperCase();
        avatar.textContent = initials;
      }
    }
    if (name)  name.textContent  = _user.displayName ?? _user.email.split('@')[0];
    if (email) email.textContent = _user.email;

    const planName = _subscription?.plan?.displayName ?? 'Free';
    if (badge) {
      badge.textContent = planName;
      badge.className = `acct-plan-badge acct-plan-${(_subscription?.plan?.slug ?? 'free').toLowerCase()}`;
    }

    // Set avatar in topbar button
    const topAvatar = document.getElementById('user-btn-avatar');
    if (topAvatar) {
      if (_user.avatarUrl) {
        topAvatar.innerHTML = `<img src="${_esc(_user.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      } else {
        const initials = (_user.displayName ?? _user.email).slice(0, 2).toUpperCase();
        topAvatar.textContent = initials;
      }
    }
    const topName = document.getElementById('user-btn-name');
    if (topName) topName.textContent = _user.displayName ?? _user.email.split('@')[0];
  }

  async function _renderBillingPanel() {
    const container = document.getElementById('billing-content');
    if (!container) return;

    const [subData, plans] = await Promise.all([fetchSubscription(), fetchPlans()]);
    const active = subData?.active;
    const plan = active?.plan;

    let html = '';

    if (active && plan) {
      const status = active.subscription?.status ?? 'active';
      const periodEnd = active.subscription?.currentPeriodEnd;
      const cancelAtEnd = active.subscription?.cancelAtPeriodEnd;
      html += `
        <div class="billing-current">
          <div class="billing-plan-name">${_esc(plan.displayName)}</div>
          <div class="billing-plan-status status-${status}">${status.replace(/_/g, ' ')}</div>
          ${periodEnd ? `<div class="billing-period">Renews ${_fmtDate(periodEnd)}</div>` : ''}
          ${cancelAtEnd ? `<div class="billing-cancel-note">Will cancel at period end</div>` : ''}
          ${status === 'active' && !cancelAtEnd && plan.slug !== 'free' ?
            `<button class="billing-cancel-btn" onclick="ModAccount._cancelSub('${active.subscription.id}')">Cancel subscription</button>` : ''}
        </div>`;
    }

    if (plans.length > 0) {
      html += `<div class="billing-plans-title">Available Plans</div>
        <div class="billing-plans">`;
      plans.forEach(p => {
        const isCurrent = plan?.id === p.id;
        const monthly = (p.priceMonthlycents / 100).toFixed(0);
        const yearly  = (p.priceYearlyCents  / 100).toFixed(0);
        html += `
          <div class="billing-plan-card ${isCurrent ? 'billing-plan-current' : ''}">
            <div class="bp-name">${_esc(p.displayName)}</div>
            <div class="bp-price">$${monthly}<span>/mo</span></div>
            ${yearly > 0 ? `<div class="bp-yearly">$${yearly}/yr billed annually</div>` : '<div class="bp-yearly">Free forever</div>'}
            ${p.description ? `<div class="bp-desc">${_esc(p.description)}</div>` : ''}
            ${isCurrent
              ? `<div class="bp-btn bp-btn-current">Current Plan</div>`
              : (p.priceMonthlycents > 0
                ? `<button class="bp-btn bp-btn-upgrade" onclick="ModAccount._checkout('${p.slug}')">Upgrade</button>`
                : `<button class="bp-btn bp-btn-downgrade" onclick="ModAccount._checkout('${p.slug}')">Downgrade</button>`)
            }
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html || '<div class="billing-loading">Loading billing info…</div>';
  }

  async function _renderUsagePanel() {
    const container = document.getElementById('usage-content');
    if (!container) return;

    container.innerHTML = '<div class="usage-loading">Loading usage…</div>';
    const { summary } = await fetchUsage();

    if (!summary || summary.length === 0) {
      container.innerHTML = '<div class="usage-empty">No usage data yet</div>';
      return;
    }

    container.innerHTML = summary.map(u => {
      const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
      const label = u.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `
        <div class="usage-item">
          <div class="usage-label">
            <span>${label}</span>
            <span class="usage-nums">${u.used.toLocaleString()} / ${u.limit ? u.limit.toLocaleString() : '∞'} ${u.period ? `(${u.period})` : ''}</span>
          </div>
          <div class="usage-bar-track">
            <div class="usage-bar-fill ${pct > 90 ? 'usage-bar-danger' : pct > 70 ? 'usage-bar-warn' : ''}" style="width:${u.limit ? pct : 0}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Profile update ────────────────────────────────────────────────────────

  async function updateProfile(data) {
    try {
      const { id, email, displayName, avatarUrl } = await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      _user = { ..._user, displayName, avatarUrl };
      _renderAccountPanel();
      _toast('Profile updated', 'success');
    } catch {
      _toast('Failed to update profile', 'error');
    }
  }

  // ── Notifications polling ─────────────────────────────────────────────────

  function _startNotifPoll() {
    clearInterval(_notifPollTimer);
    _notifPollTimer = setInterval(() => fetchNotifications(), 60000);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init(user) {
    _user = user;

    if (!_user) {
      // Show sign-in state in topbar
      const btn = document.getElementById('user-menu-btn');
      if (btn) {
        btn.innerHTML = `<span style="font-size:11px">Sign In</span>`;
        btn.onclick = () => window.location.href = '/login';
      }
      return;
    }

    // Wire up topbar user button
    const userBtn = document.getElementById('user-menu-btn');
    if (userBtn) {
      userBtn.addEventListener('click', e => { e.stopPropagation(); _toggleAccountMenu(); });
    }

    // Wire up account menu items
    document.getElementById('menu-account')   ?.addEventListener('click', () => { _closeMenu(); openPanel('account'); });
    document.getElementById('menu-billing')   ?.addEventListener('click', () => { _closeMenu(); openPanel('billing'); });
    document.getElementById('menu-usage')     ?.addEventListener('click', () => { _closeMenu(); openPanel('usage'); });
    document.getElementById('menu-settings')  ?.addEventListener('click', () => { if (window.ModSettings) ModSettings.togglePanel?.(); _closeMenu(); });
    document.getElementById('menu-logout')    ?.addEventListener('click', () => { _closeMenu(); logout(); });

    // Notifications bell
    document.getElementById('notif-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      _toggleNotifPanel();
    });

    document.getElementById('notif-mark-all')?.addEventListener('click', markAllRead);

    // Close menus on outside click
    document.addEventListener('click', _closeAll);

    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('profile-name')?.value?.trim() ?? '';
      await updateProfile({ displayName: name || undefined });
    });

    // Close panel buttons
    document.querySelectorAll('.acct-panel-close').forEach(btn => {
      btn.addEventListener('click', closePanel);
    });

    // Load data
    const [subData, notifData, featData] = await Promise.all([
      fetchSubscription(),
      fetchNotifications(),
      fetchFeatures(),
    ]);
    _subscription = subData;
    _features = featData;
    _renderAccountPanel();

    // Start polling
    _startNotifPoll();

    // Tab switching in account modal
    document.querySelectorAll('.acct-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.acct-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.acct-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.target);
        if (target) target.classList.add('active');
        // Lazy load tab content
        if (tab.dataset.target === 'acct-billing') _renderBillingPanel();
        if (tab.dataset.target === 'acct-usage')   _renderUsagePanel();
      });
    });
  }

  // ── Panel management ──────────────────────────────────────────────────────

  function openPanel(which = 'account') {
    const panel = document.getElementById('account-panel');
    if (!panel) return;
    panel.classList.add('open');

    // Activate correct tab
    document.querySelectorAll('.acct-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.acct-tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.querySelector(`.acct-tab[data-target="acct-${which}"]`);
    const content = document.getElementById(`acct-${which}`);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');

    if (which === 'account') {
      const nameInput = document.getElementById('profile-name');
      if (nameInput && _user) nameInput.value = _user.displayName ?? '';
    }
    if (which === 'billing') _renderBillingPanel();
    if (which === 'usage')   _renderUsagePanel();
  }

  function closePanel() {
    document.getElementById('account-panel')?.classList.remove('open');
  }

  // ── Account menu dropdown ─────────────────────────────────────────────────

  function _toggleAccountMenu() {
    const menu = document.getElementById('account-menu');
    if (!menu) return;
    const isOpen = menu.classList.contains('open');
    _closeAll();
    if (!isOpen) menu.classList.add('open');
  }

  function _closeMenu() {
    document.getElementById('account-menu')?.classList.remove('open');
  }

  function _toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    _closeAll();
    if (!isOpen) {
      panel.classList.add('open');
      _renderNotifications();
      fetchNotifications();
    }
  }

  function _closeAll() {
    document.getElementById('account-menu')?.classList.remove('open');
    document.getElementById('notif-panel')?.classList.remove('open');
  }

  // ── Internal event handlers ───────────────────────────────────────────────

  function _cancelSub(id) { cancelSubscription(id); }
  function _checkout(slug) { startCheckout(slug); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _relTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function _fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

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

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    init,
    openPanel,
    closePanel,
    logout,
    updateProfile,
    markRead,
    markAllRead,
    fetchNotifications,
    _cancelSub,
    _checkout,
  };

})();

window.ModAccount = ModAccount;
