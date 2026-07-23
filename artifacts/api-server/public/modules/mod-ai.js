/**
 * Graph3D Pro — mod-ai.js
 * Module 09 — AI Equation Assistant
 * Updated to use Graph3D backend /api/chat endpoint.
 */

const ModAI = (() => {

  // ── State ──────────────────────────────────────────────
  let _history    = [];
  let _isOpen     = false;
  let _isThinking = false;
  let _mode       = 'chat'; // 'chat' | 'tutor'

  // Always use same-origin /api/chat (served by Express backend)
  const API_URL = (window.GRAPH3D_API_BASE ?? '') + '/api/chat';

  // ── Quick action prompts ───────────────────────────────
  const QUICK_ACTIONS = [
    { label: 'Explain equation',    prompt: '__EXPLAIN_CURRENT__' },
    { label: 'Generate a surface',  prompt: 'Generate an interesting and visually striking 3D surface equation. Give me the expression and explain what makes it interesting.' },
    { label: 'What is a torus?',    prompt: 'What is a torus and how is it parametrized mathematically? Give me the parametric equations.' },
    { label: 'Fix my equation',     prompt: '__FIX_CURRENT__' },
    { label: 'Implicit surface',    prompt: 'Give me a beautiful implicit surface equation (f(x,y,z)=0 form) that I have not seen before, with a brief explanation.' },
    { label: 'Animate something',   prompt: 'Give me an equation that uses the t variable for animation, with an interesting time-based transformation.' },
  ];

  const TUTOR_QUICK_ACTIONS = [
    { label: 'Explain equation',        prompt: '__EXPLAIN_CURRENT__' },
    { label: 'Quiz me',                 prompt: '__QUIZ_CURRENT__' },
    { label: 'Step-by-step',            prompt: '__STEPBYSTEP_CURRENT__' },
    { label: 'Give me a hint',          prompt: '__HINT_CURRENT__' },
    { label: 'Why does this matter?',   prompt: '__WHY_CURRENT__' },
    { label: 'Fix my equation',         prompt: '__FIX_CURRENT__' },
  ];

  // ── Offline templates ──────────────────────────────────
  const OFFLINE_TEMPLATES = {
    sphere:    { type: 'implicit',   expr: 'x^2 + y^2 + z^2 - 4',                         label: 'Sphere' },
    torus:     { type: 'parametric', expr: '(2+cos(v))*cos(u), (2+cos(v))*sin(u), sin(v)', label: 'Torus' },
    saddle:    { type: 'explicit',   expr: 'x^2 - y^2',                                    label: 'Saddle' },
    ripple:    { type: 'explicit',   expr: 'sin(sqrt(x^2 + y^2))',                          label: 'Ripple wave' },
    paraboloid:{ type: 'explicit',   expr: 'x^2 + y^2',                                    label: 'Paraboloid' },
    helix:     { type: 'curve',      expr: 'cos(t), sin(t), t/5',                           label: 'Helix' },
    klein:     { type: 'parametric', expr: '(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*cos(v),(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*sin(v),sin(v/2)*sin(u)+cos(v/2)*sin(2*u)', label: 'Klein bottle' },
  };

  // ── System prompt ──────────────────────────────────────
  function _systemPrompt(mode) {
    const base = `You are an expert mathematics tutor and AI assistant for Graph3D Pro, a professional 3D graphing calculator. You help users understand and create mathematical expressions for 3D graphs.

When you suggest equations, format them clearly. For explicit surfaces use: z = f(x,y). For parametric surfaces: x(u,v), y(u,v), z(u,v). For implicit surfaces: f(x,y,z) = 0.

When you provide an equation the user should graph, wrap it in a code block like this:
\`\`\`equation
type: explicit
z = sin(sqrt(x^2+y^2))
\`\`\`

Valid types are: explicit, parametric, implicit, curve, polar, spherical, cylindrical, vector.

Keep responses concise and focused on mathematics. Do not use emojis.`;

    if (mode === 'tutor') {
      return base + '\n\nYou are in Socratic Tutor mode. Guide the user to understand concepts through questions and hints rather than giving direct answers. Ask probing questions, encourage exploration, and celebrate their insights.';
    }
    return base;
  }

  // ── Current equation context ───────────────────────────
  function _getCurrentEquation() {
    if (!window.ModEquations) return null;
    try {
      const eqs = ModEquations.serialize();
      if (!eqs || eqs.length === 0) return null;
      return eqs[0]; // first equation as context
    } catch { return null; }
  }

  function _resolvePrompt(prompt) {
    const eq = _getCurrentEquation();
    const expr = eq?.expr ?? '(no equation)';
    const type = eq?.type ?? 'explicit';

    return prompt
      .replace('__EXPLAIN_CURRENT__', `Explain this ${type} equation and what it represents geometrically: ${expr}`)
      .replace('__FIX_CURRENT__', `I'm having trouble with this equation (type: ${type}): ${expr}. Can you help me fix or improve it?`)
      .replace('__QUIZ_CURRENT__', `Quiz me on this ${type} equation: ${expr}. Ask me a question about what it represents or how it works.`)
      .replace('__STEPBYSTEP_CURRENT__', `Explain step by step what this ${type} equation does: ${expr}. Break it down into parts.`)
      .replace('__HINT_CURRENT__', `Give me a hint (not the full explanation) about what makes this equation interesting: ${expr}`)
      .replace('__WHY_CURRENT__', `Why does this equation matter mathematically? ${expr} (type: ${type})`);
  }

  // ── API call ───────────────────────────────────────────
  async function _callAPI(userMessage) {
    const messages = [
      { role: 'system', content: _systemPrompt(_mode) },
      ..._history,
      { role: 'user', content: userMessage },
    ];

    const r = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 1024 }),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message ?? 'AI request failed');
    return data.choices?.[0]?.message?.content ?? '';
  }

  // ── Send message ───────────────────────────────────────
  async function sendMessage(rawPrompt) {
    if (_isThinking) return;
    const prompt = _resolvePrompt(rawPrompt.trim());
    if (!prompt) return;

    _history.push({ role: 'user', content: prompt });
    _addMessage('user', rawPrompt); // show original prompt (without resolved context)
    _setThinking(true);

    try {
      const reply = await _callAPI(prompt);
      _history.push({ role: 'assistant', content: reply });
      _addMessage('assistant', reply);
    } catch (err) {
      if (err.message?.includes('OPENROUTER_API_KEY')) {
        _addMessage('assistant', 'AI assistant is not configured on this server. Please set OPENROUTER_API_KEY.');
      } else {
        _addMessage('assistant', `Sorry, I encountered an error: ${err.message}`);
      }
    } finally {
      _setThinking(false);
    }
  }

  // ── Explain current equation ───────────────────────────
  async function explainEquation() {
    openPanel();
    await sendMessage('__EXPLAIN_CURRENT__');
  }

  // ── Generate from description ──────────────────────────
  async function generateFromDescription(description) {
    openPanel();
    await sendMessage(`Generate a 3D graph for: "${description}". Provide the equation type and expression.`);
  }

  // ── Debug error ────────────────────────────────────────
  async function debugError(errorMsg, expr) {
    openPanel();
    await sendMessage(`I got this error when plotting "${expr}": ${errorMsg}. How do I fix it?`);
  }

  // ── Quick template ─────────────────────────────────────
  function quickTemplate(key) {
    const t = OFFLINE_TEMPLATES[key];
    if (!t) return;
    if (window.ModEquations) {
      ModEquations.addEquation?.({ type: t.type, expr: t.expr });
    }
  }

  function getTemplates() { return OFFLINE_TEMPLATES; }

  // ── Tutor mode ─────────────────────────────────────────
  function setMode(mode) {
    _mode = mode;
    const title = document.getElementById('ai-panel-title');
    if (title) title.textContent = mode === 'tutor' ? 'AI Tutor' : 'AI Assistant';
    _renderQuickActions();
  }

  function toggleTutorMode() {
    setMode(_mode === 'tutor' ? 'chat' : 'tutor');
  }

  function getMode() { return _mode; }

  // ── UI helpers ─────────────────────────────────────────
  function _setThinking(v) {
    _isThinking = v;
    const btn = document.getElementById('ai-send-btn');
    const indicator = document.getElementById('ai-thinking');
    if (btn) btn.disabled = v;
    if (indicator) indicator.style.display = v ? 'flex' : 'none';
  }

  function _addMessage(role, content) {
    const container = document.getElementById('ai-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `ai-message ${role}`;

    // Parse equations from code blocks
    const parsed = _parseContent(content);
    div.innerHTML = parsed.html;

    // Wire up inject buttons
    parsed.equations.forEach((eq, i) => {
      const btn = div.querySelector(`[data-eq-inject="${i}"]`);
      btn?.addEventListener('click', () => {
        if (window.ModEquations) {
          ModEquations.addEquation?.({ type: eq.type, expr: eq.expr });
        }
      });
    });

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function _parseContent(content) {
    const equations = [];
    let html = _esc(content);

    // Extract equation code blocks
    html = html.replace(/```equation\n([\s\S]*?)```/g, (_, block) => {
      const lines = block.trim().split('\n');
      let type = 'explicit', expr = '';
      lines.forEach(l => {
        if (l.startsWith('type:')) type = l.replace('type:', '').trim();
        else if (l.startsWith('z =') || l.match(/^\S/)) expr = l.trim();
      });
      if (!expr && lines.length === 1) expr = lines[0].trim();
      const idx = equations.length;
      equations.push({ type, expr });
      return `<div class="ai-eq-block"><code>${_esc(expr)}</code><button class="ai-inject-btn" data-eq-inject="${idx}">+ Add to graph</button></div>`;
    });

    // Basic markdown
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return { html: `<p>${html}</p>`, equations };
  }

  function _esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _renderQuickActions() {
    const container = document.getElementById('ai-quick-btns');
    if (!container) return;
    const actions = _mode === 'tutor' ? TUTOR_QUICK_ACTIONS : QUICK_ACTIONS;
    container.innerHTML = actions.map(a =>
      `<button class="ai-quick-btn" data-prompt="${_esc(a.prompt)}">${_esc(a.label)}</button>`
    ).join('');
    container.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
    });
  }

  // ── Panel ──────────────────────────────────────────────
  function openPanel() {
    const panel = document.getElementById('ai-panel');
    if (panel) panel.classList.add('open');
    _isOpen = true;
    const input = document.getElementById('ai-input');
    if (input) setTimeout(() => input.focus(), 100);
  }

  function closePanel() {
    const panel = document.getElementById('ai-panel');
    if (panel) panel.classList.remove('open');
    _isOpen = false;
  }

  function togglePanel() {
    if (_isOpen) closePanel(); else openPanel();
  }

  function clearHistory() {
    _history = [];
    const container = document.getElementById('ai-messages');
    if (container) {
      container.innerHTML = '';
      _addMessage('assistant', 'Conversation cleared. How can I help you with your 3D graph?');
    }
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    // AI send button
    const sendBtn  = document.getElementById('ai-send-btn');
    const inputEl  = document.getElementById('ai-input');
    const closeBtn = document.getElementById('ai-close-btn');

    sendBtn?.addEventListener('click', () => {
      const msg = inputEl?.value?.trim();
      if (msg) { inputEl.value = ''; sendMessage(msg); }
    });

    inputEl?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const msg = inputEl.value.trim();
        if (msg) { inputEl.value = ''; sendMessage(msg); }
      }
    });

    closeBtn?.addEventListener('click', closePanel);

    // Mode toggle
    document.getElementById('ai-mode-toggle')?.addEventListener('click', toggleTutorMode);

    // Clear button
    document.getElementById('ai-clear-btn')?.addEventListener('click', clearHistory);

    // Natural language quick-add
    const nlBtn   = document.getElementById('ai-nl-btn');
    const nlInput = document.getElementById('ai-nl-input');
    nlBtn?.addEventListener('click', () => {
      const v = nlInput?.value?.trim();
      if (v) { nlInput.value = ''; generateFromDescription(v); }
    });

    _renderQuickActions();

    // Initial greeting
    setTimeout(() => {
      if (document.getElementById('ai-messages')?.children.length === 0) {
        _addMessage('assistant', 'Hi! I\'m your AI assistant for Graph3D Pro. I can help you create, understand, and fix 3D equations. Try clicking a quick action below, or ask me anything!');
      }
    }, 500);
  }

  return {
    init,
    openPanel,
    closePanel,
    togglePanel,
    sendMessage,
    explainEquation,
    generateFromDescription,
    quickTemplate,
    getTemplates,
    debugError,
    setMode,
    toggleTutorMode,
    getMode,
    clearHistory,
  };

})();
