/*!
 * PropAI Chat Widget v1.0.0
 * Self-contained floating chat widget for WordPress (no dependencies)
 * Configure via window.PropAiConfig before loading this script.
 *
 * Configuration:
 *   window.PropAiConfig = {
 *     apiBase: 'https://your-backend.railway.app',  // Required
 *     primaryColor: '#7c3aed',                       // Optional
 *     accentColor: '#1d4ed8',                        // Optional
 *     agencyName: 'PropAI Jaipur',                   // Optional
 *     agentName: 'Priya',                            // Optional
 *     agentAvatar: '🏠',                             // Optional
 *     position: 'right',                             // 'right' | 'left'
 *   };
 */

(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────────────────
  const cfg = Object.assign({
    apiBase: '',
    primaryColor: '#7c3aed',
    accentColor: '#1d4ed8',
    agencyName: 'PropAI Jaipur',
    agentName: 'Priya',
    agentAvatar: '🏠',
    position: 'right',
  }, window.PropAiConfig || {});

  if (!cfg.apiBase) {
    console.error('[PropAI Widget] window.PropAiConfig.apiBase is required.');
    return;
  }

  const GRADIENT = `linear-gradient(135deg, ${cfg.primaryColor}, ${cfg.accentColor})`;

  // ── State ────────────────────────────────────────────────────────────────────
  let sessionId = localStorage.getItem('propai_session_id') || null;
  let isOpen = false;
  let isTyping = false;
  let currentStep = 'COLLECT_NAME';
  let currentQuickReplies = [];

  // ── Inject CSS ────────────────────────────────────────────────────────────────
  const injectStyles = () => {
    const style = document.createElement('style');
    style.id = 'propai-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

      #propai-widget * {
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      /* ── Floating Button ── */
      #propai-btn {
        position: fixed;
        ${cfg.position === 'left' ? 'left: 24px' : 'right: 24px'};
        bottom: 24px;
        width: 62px;
        height: 62px;
        border-radius: 50%;
        background: ${GRADIENT};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        box-shadow: 0 8px 32px rgba(124, 58, 237, 0.45);
        z-index: 999998;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        outline: none;
      }
      #propai-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 12px 40px rgba(124, 58, 237, 0.55);
      }
      #propai-btn::after {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px solid ${cfg.primaryColor};
        opacity: 0;
        animation: propai-pulse 2.5s infinite;
      }
      @keyframes propai-pulse {
        0%   { transform: scale(0.95); opacity: 0.6; }
        70%  { transform: scale(1.15); opacity: 0; }
        100% { transform: scale(0.95); opacity: 0; }
      }

      /* ── Notification Badge ── */
      #propai-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #ef4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        display: none;
      }

      /* ── Chat Panel ── */
      #propai-panel {
        position: fixed;
        ${cfg.position === 'left' ? 'left: 16px' : 'right: 16px'};
        bottom: 100px;
        width: 380px;
        max-width: calc(100vw - 32px);
        height: 560px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0,0,0,0.05);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(20px) scale(0.96);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
      }
      #propai-panel.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: all;
      }

      /* ── Header ── */
      #propai-header {
        background: ${GRADIENT};
        padding: 16px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      #propai-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
        border: 2px solid rgba(255,255,255,0.4);
      }
      #propai-header-info { flex: 1; }
      #propai-header-name {
        font-weight: 600;
        font-size: 15px;
        color: white;
        line-height: 1.2;
      }
      #propai-header-status {
        font-size: 12px;
        color: rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 2px;
      }
      #propai-header-status::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #4ade80;
        display: inline-block;
        animation: propai-blink 2s infinite;
      }
      @keyframes propai-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      #propai-close-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        line-height: 1;
      }
      #propai-close-btn:hover { background: rgba(255,255,255,0.25); }

      /* ── Powered by bar ── */
      #propai-powered {
        background: #f8f8ff;
        text-align: center;
        font-size: 10px;
        color: #888;
        padding: 4px;
        letter-spacing: 0.3px;
        border-bottom: 1px solid #f0f0f8;
        flex-shrink: 0;
      }
      #propai-powered span {
        color: ${cfg.primaryColor};
        font-weight: 600;
      }

      /* ── Messages Area ── */
      #propai-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px 14px;
        background: #f8f9fe;
        scroll-behavior: smooth;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #propai-messages::-webkit-scrollbar { width: 4px; }
      #propai-messages::-webkit-scrollbar-thumb {
        background: #ddd;
        border-radius: 4px;
      }

      /* ── Message Bubbles ── */
      .propai-msg {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        animation: propai-slide-in 0.25s ease;
      }
      @keyframes propai-slide-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .propai-msg.bot { justify-content: flex-start; }
      .propai-msg.user { justify-content: flex-end; }

      .propai-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${GRADIENT};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        flex-shrink: 0;
        margin-bottom: 2px;
      }

      .propai-bubble {
        max-width: 78%;
        padding: 11px 14px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .propai-msg.bot .propai-bubble {
        background: #ffffff;
        color: #1e293b;
        border-bottom-left-radius: 5px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .propai-msg.user .propai-bubble {
        background: ${GRADIENT};
        color: white;
        border-bottom-right-radius: 5px;
        box-shadow: 0 2px 8px rgba(124,58,237,0.3);
      }

      .propai-timestamp {
        font-size: 10px;
        color: #94a3b8;
        margin-top: 3px;
        padding: 0 4px;
        align-self: flex-end;
      }
      .propai-msg.user .propai-timestamp { text-align: right; }

      /* ── Typing Indicator ── */
      #propai-typing {
        display: none;
        align-items: flex-end;
        gap: 8px;
      }
      #propai-typing .propai-msg-avatar {
        width: 28px;
        height: 28px;
        font-size: 13px;
      }
      .propai-typing-bubble {
        background: white;
        border-radius: 18px;
        border-bottom-left-radius: 5px;
        padding: 12px 16px;
        display: flex;
        gap: 5px;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .propai-dot {
        width: 7px;
        height: 7px;
        background: #94a3b8;
        border-radius: 50%;
        animation: propai-bounce 1.2s infinite;
      }
      .propai-dot:nth-child(2) { animation-delay: 0.2s; }
      .propai-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes propai-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40%           { transform: translateY(-6px); }
      }

      /* ── Quick Replies ── */
      #propai-quick-replies {
        padding: 8px 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        background: #f8f9fe;
        border-top: 1px solid #eef0fb;
        flex-shrink: 0;
      }
      .propai-qr-btn {
        padding: 7px 14px;
        background: white;
        border: 1.5px solid ${cfg.primaryColor};
        color: ${cfg.primaryColor};
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.18s ease;
        white-space: nowrap;
        font-family: inherit;
      }
      .propai-qr-btn:hover {
        background: ${cfg.primaryColor};
        color: white;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(124,58,237,0.25);
      }

      /* ── Property Cards ── */
      .propai-properties {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 280px;
      }
      .propai-property-card {
        background: white;
        border-radius: 12px;
        padding: 12px 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.07);
        border-left: 3px solid ${cfg.primaryColor};
        animation: propai-slide-in 0.3s ease;
      }
      .propai-property-title {
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 4px;
      }
      .propai-property-meta {
        font-size: 12px;
        color: #64748b;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .propai-property-meta span {
        display: flex;
        align-items: center;
        gap: 3px;
      }
      .propai-property-desc {
        font-size: 12px;
        color: #94a3b8;
        line-height: 1.4;
      }
      .propai-property-badge {
        display: inline-block;
        background: #dcfce7;
        color: #16a34a;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 10px;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* ── Input Area ── */
      #propai-input-area {
        padding: 12px 14px;
        background: white;
        border-top: 1px solid #f0f0f8;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
      }
      #propai-input {
        flex: 1;
        border: 1.5px solid #e2e8f0;
        border-radius: 24px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        font-family: inherit;
        color: #1e293b;
        background: #f8f9fe;
        transition: border-color 0.2s;
        resize: none;
        max-height: 80px;
        overflow-y: auto;
      }
      #propai-input:focus {
        border-color: ${cfg.primaryColor};
        background: white;
      }
      #propai-input::placeholder { color: #94a3b8; }

      #propai-send-btn {
        width: 42px;
        height: 42px;
        background: ${GRADIENT};
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease, opacity 0.15s;
        flex-shrink: 0;
      }
      #propai-send-btn:hover { transform: scale(1.08); }
      #propai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      #propai-send-btn svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      /* ── Done State ── */
      #propai-done-bar {
        display: none;
        padding: 10px 14px;
        background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        border-top: 1px solid #bbf7d0;
        text-align: center;
        font-size: 13px;
        color: #16a34a;
        font-weight: 500;
      }

      /* ── Visit Scheduler ── */
      .propai-scheduler {
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.10);
        border: 1.5px solid #e8eaf6;
        overflow: hidden;
        width: 100%;
        max-width: 290px;
        margin-top: 8px;
        animation: propai-slide-in 0.3s ease;
      }
      .propai-scheduler-header {
        background: ${GRADIENT};
        color: white;
        padding: 12px 14px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      /* Calendar */
      .propai-cal {
        padding: 12px 12px 8px;
      }
      .propai-cal-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .propai-cal-nav span {
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
      }
      .propai-cal-nav button {
        background: none;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        width: 28px; height: 28px;
        cursor: pointer;
        font-size: 14px;
        color: #64748b;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
      }
      .propai-cal-nav button:hover { background: #f1f5f9; border-color: ${cfg.primaryColor}; color: ${cfg.primaryColor}; }
      .propai-cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .propai-cal-day-label {
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
        padding: 2px 0 6px;
        text-transform: uppercase;
      }
      .propai-cal-day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border-radius: 8px;
        cursor: pointer;
        border: none;
        background: transparent;
        color: #1e293b;
        transition: all 0.15s;
        font-family: inherit;
      }
      .propai-cal-day:hover:not(:disabled) { background: #ede9fe; color: ${cfg.primaryColor}; }
      .propai-cal-day.selected { background: ${cfg.primaryColor}; color: white; font-weight: 700; }
      .propai-cal-day.today { border: 1.5px solid ${cfg.primaryColor}; color: ${cfg.primaryColor}; font-weight: 600; }
      .propai-cal-day.today.selected { border-color: transparent; color: white; }
      .propai-cal-day:disabled { color: #cbd5e1; cursor: not-allowed; }
      .propai-cal-day.empty { cursor: default; }
      /* Time Slots */
      .propai-time-section {
        padding: 0 12px 12px;
        border-top: 1px solid #f1f5f9;
      }
      .propai-time-label {
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 10px 0 8px;
      }
      .propai-time-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .propai-time-slot {
        padding: 7px 4px;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 500;
        color: #475569;
        background: white;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
        font-family: inherit;
      }
      .propai-time-slot:hover { border-color: ${cfg.primaryColor}; color: ${cfg.primaryColor}; background: #faf5ff; }
      .propai-time-slot.selected { background: ${cfg.primaryColor}; color: white; border-color: ${cfg.primaryColor}; font-weight: 600; }
      /* Confirm Button */
      .propai-confirm-visit {
        display: block;
        width: calc(100% - 24px);
        margin: 0 12px 12px;
        padding: 10px;
        background: ${GRADIENT};
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.15s;
        font-family: inherit;
      }
      .propai-confirm-visit:hover { opacity: 0.9; transform: translateY(-1px); }
      .propai-confirm-visit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

      /* ── Mobile ── */
      @media (max-width: 480px) {
        #propai-panel {
          right: 0 !important;
          left: 0 !important;
          bottom: 0;
          width: 100%;
          max-width: 100%;
          border-radius: 20px 20px 0 0;
          height: 85vh;
          max-height: 85vh;
        }
        #propai-btn {
          right: 16px !important;
          left: auto !important;
          bottom: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  // ── Build DOM ─────────────────────────────────────────────────────────────────
  const buildWidget = () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'propai-widget';

    wrapper.innerHTML = `
      <!-- Floating Button -->
      <button id="propai-btn" aria-label="Open Property Assistant" title="Chat with ${cfg.agentName}">
        <span>🏠</span>
        <span id="propai-badge">1</span>
      </button>

      <!-- Chat Panel -->
      <div id="propai-panel" role="dialog" aria-label="Property Assistant Chat" aria-modal="true">

        <!-- Header -->
        <div id="propai-header">
          <div id="propai-avatar">${cfg.agentAvatar}</div>
          <div id="propai-header-info">
            <div id="propai-header-name">${cfg.agentName} · ${cfg.agencyName}</div>
            <div id="propai-header-status">Online now</div>
          </div>
          <button id="propai-close-btn" aria-label="Close chat">✕</button>
        </div>

        <!-- Powered by -->
        <div id="propai-powered">Powered by <span>PropAI</span> · Jaipur Real Estate</div>

        <!-- Messages -->
        <div id="propai-messages" role="log" aria-live="polite" aria-label="Chat messages">
          <!-- Typing indicator -->
          <div id="propai-typing">
            <div class="propai-msg-avatar">${cfg.agentAvatar}</div>
            <div class="propai-typing-bubble">
              <div class="propai-dot"></div>
              <div class="propai-dot"></div>
              <div class="propai-dot"></div>
            </div>
          </div>
        </div>

        <!-- Quick Replies -->
        <div id="propai-quick-replies"></div>

        <!-- Done State Bar -->
        <div id="propai-done-bar">✅ Our Investment Manager will contact you shortly!</div>

        <!-- Input Area -->
        <div id="propai-input-area">
          <input
            type="text"
            id="propai-input"
            placeholder="Type your message..."
            autocomplete="off"
            aria-label="Type your message"
            maxlength="500"
          />
          <button id="propai-send-btn" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
  };

  // ── Time Helpers ──────────────────────────────────────────────────────────────
  const timeStr = () =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // ── DOM References ────────────────────────────────────────────────────────────
  let els = {};
  const $ = (id) => document.getElementById(id);

  const initRefs = () => {
    els = {
      btn: $('propai-btn'),
      badge: $('propai-badge'),
      panel: $('propai-panel'),
      closeBtn: $('propai-close-btn'),
      messages: $('propai-messages'),
      typing: $('propai-typing'),
      quickReplies: $('propai-quick-replies'),
      input: $('propai-input'),
      sendBtn: $('propai-send-btn'),
      doneBar: $('propai-done-bar'),
    };
  };

  // ── Open / Close ──────────────────────────────────────────────────────────────
  const openChat = () => {
    isOpen = true;
    els.panel.classList.add('open');
    els.badge.style.display = 'none';
    setTimeout(() => els.input.focus(), 300);
  };

  const closeChat = () => {
    isOpen = false;
    els.panel.classList.remove('open');
  };

  // ── Visit Scheduler State ─────────────────────────────────────────────────────
  let _schedulerDate = null;
  let _schedulerTime = null;
  let _schedulerEl  = null;

  // ── Calendar Builder ──────────────────────────────────────────────────────────
  const buildCalendar = (year, month) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = new Date(year, month).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    let cells = '';
    dayLabels.forEach(d => { cells += `<div class="propai-cal-day-label">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) cells += `<div class="propai-cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isPast = date < today;
      const isToday = date.getTime() === today.getTime();
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isSelected = _schedulerDate === dateStr;
      cells += `<button class="propai-cal-day${isToday?' today':''}${isSelected?' selected':''}" 
        ${isPast ? 'disabled' : `data-date="${dateStr}"`}>${d}</button>`;
    }
    return { monthName, cells };
  };

  const TIME_SLOTS = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'];

  const buildTimePicker = () => {
    if (!_schedulerDate) return '';
    const slots = TIME_SLOTS.map(t => {
      const sel = _schedulerTime === t ? ' selected' : '';
      return `<button class="propai-time-slot${sel}" data-time="${t}">${t}</button>`;
    }).join('');
    return `
      <div class="propai-time-section">
        <div class="propai-time-label">🕐 Choose a time</div>
        <div class="propai-time-grid">${slots}</div>
      </div>`;
  };

  const buildScheduler = () => {
    const now = new Date();
    const yr  = now.getFullYear();
    const mo  = now.getMonth();
    const { monthName, cells } = buildCalendar(yr, mo);
    const canConfirm = _schedulerDate && _schedulerTime;
    return `
      <div class="propai-scheduler" id="propai-scheduler">
        <div class="propai-scheduler-header">📅 Schedule a Visit</div>
        <div class="propai-cal" id="propai-cal" data-year="${yr}" data-month="${mo}">
          <div class="propai-cal-nav">
            <button id="propai-cal-prev">&#8249;</button>
            <span>${monthName}</span>
            <button id="propai-cal-next">&#8250;</button>
          </div>
          <div class="propai-cal-grid">${cells}</div>
        </div>
        ${buildTimePicker()}
        <button class="propai-confirm-visit" id="propai-confirm-visit" ${canConfirm ? '' : 'disabled'}>
          ${canConfirm ? `✅ Confirm — ${fmtDate(_schedulerDate)} at ${_schedulerTime}` : 'Select date & time to confirm'}
        </button>
      </div>`;
  };

  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const refreshScheduler = () => {
    if (!_schedulerEl) return;
    const calEl  = _schedulerEl.querySelector('#propai-cal');
    const yr     = parseInt(calEl.dataset.year);
    const mo     = parseInt(calEl.dataset.month);
    const { monthName, cells } = buildCalendar(yr, mo);
    calEl.querySelector('.propai-cal-grid').innerHTML = cells;
    calEl.querySelector('.propai-cal-nav span').textContent = monthName;

    // Time picker
    const existingTime = _schedulerEl.querySelector('.propai-time-section');
    if (existingTime) existingTime.remove();
    if (_schedulerDate) {
      calEl.insertAdjacentHTML('afterend', buildTimePicker());
      attachTimeListeners();
    }

    // Confirm button
    const btn = _schedulerEl.querySelector('#propai-confirm-visit');
    const canConfirm = _schedulerDate && _schedulerTime;
    btn.disabled = !canConfirm;
    btn.textContent = canConfirm ? `✅ Confirm — ${fmtDate(_schedulerDate)} at ${_schedulerTime}` : 'Select date & time to confirm';
  };

  const attachTimeListeners = () => {
    _schedulerEl.querySelectorAll('.propai-time-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        _schedulerTime = btn.dataset.time;
        _schedulerEl.querySelectorAll('.propai-time-slot').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        refreshScheduler();
      });
    });
  };

  const injectScheduler = (containerEl) => {
    _schedulerDate = null;
    _schedulerTime = null;
    containerEl.insertAdjacentHTML('beforeend', buildScheduler());
    _schedulerEl = containerEl.querySelector('#propai-scheduler');

    // Calendar day clicks
    _schedulerEl.querySelector('.propai-cal-grid').addEventListener('click', e => {
      const btn = e.target.closest('.propai-cal-day');
      if (!btn || btn.disabled || btn.classList.contains('empty')) return;
      _schedulerDate = btn.dataset.date;
      _schedulerTime = null;
      refreshScheduler();
      attachDateListeners();
    });

    attachDateListeners();

    // Nav buttons
    _schedulerEl.querySelector('#propai-cal-prev').addEventListener('click', () => {
      const calEl = _schedulerEl.querySelector('#propai-cal');
      let yr = parseInt(calEl.dataset.year), mo = parseInt(calEl.dataset.month);
      mo--; if (mo < 0) { mo = 11; yr--; }
      calEl.dataset.year = yr; calEl.dataset.month = mo;
      refreshScheduler();
      attachDateListeners();
    });
    _schedulerEl.querySelector('#propai-cal-next').addEventListener('click', () => {
      const calEl = _schedulerEl.querySelector('#propai-cal');
      let yr = parseInt(calEl.dataset.year), mo = parseInt(calEl.dataset.month);
      mo++; if (mo > 11) { mo = 0; yr++; }
      calEl.dataset.year = yr; calEl.dataset.month = mo;
      refreshScheduler();
      attachDateListeners();
    });

    // Confirm
    _schedulerEl.querySelector('#propai-confirm-visit').addEventListener('click', () => {
      if (!_schedulerDate || !_schedulerTime) return;
      const msg = `I want to visit on ${fmtDate(_schedulerDate)} at ${_schedulerTime}.`;
      // Hide scheduler
      _schedulerEl.remove();
      _schedulerEl = null;
      sendMessage(msg);
    });
  };

  const attachDateListeners = () => {
    if (!_schedulerEl) return;
    _schedulerEl.querySelectorAll('.propai-cal-day:not([disabled]):not(.empty)').forEach(btn => {
      btn.addEventListener('click', () => {
        _schedulerDate = btn.dataset.date;
        _schedulerTime = null;
        refreshScheduler();
        attachDateListeners();
        attachTimeListeners();
        scrollToBottom();
      });
    });
  };

  // Detect if AI message is asking for visit time
  const isVisitAsk = (text) => {
    const t = text.toLowerCase();
    return t.includes('kab visit') || t.includes('visit karna hai') ||
           t.includes('preferred date') || t.includes('schedule a visit') ||
           t.includes('plan a visit') || t.includes('book a visit') ||
           (t.includes('date') && t.includes('time') && (t.includes('visit') || t.includes('meet')));
  };

  // ── Append Message ────────────────────────────────────────────────────────────
  const appendMessage = (text, role, properties = []) => {
    const msgEl = document.createElement('div');
    msgEl.className = `propai-msg ${role}`;

    const time = timeStr();

    if (role === 'bot') {
      msgEl.innerHTML = `
        <div class="propai-msg-avatar">${cfg.agentAvatar}</div>
        <div>
          <div class="propai-bubble">${escHtml(text)}</div>
          ${properties.length ? renderPropertyCards(properties) : ''}
          <div class="propai-timestamp">${time}</div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div>
          <div class="propai-bubble">${escHtml(text)}</div>
          <div class="propai-timestamp">${time}</div>
        </div>
      `;
    }

    // Insert before typing indicator
    els.messages.insertBefore(msgEl, els.typing);

    // If bot is asking for visit time → inject scheduler
    if (role === 'bot' && isVisitAsk(text)) {
      const contentWrapper = msgEl.querySelector('div:last-child') || msgEl;
      setTimeout(() => {
        injectScheduler(contentWrapper);
        scrollToBottom();
      }, 120);
    } else {
      scrollToBottom();
    }
  };

  const escHtml = (str) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;').replace(/\n/g, '<br>');

  const scrollToBottom = () => {
    els.messages.scrollTop = els.messages.scrollHeight;
  };

  // ── Property Cards ────────────────────────────────────────────────────────────
  const renderPropertyCards = (properties) => {
    if (!properties || !properties.length) return '';
    const cards = properties.map((p) => `
      <div class="propai-property-card">
        <div class="propai-property-badge">✅ ${p.status || 'Active'}</div>
        <div class="propai-property-title">${escHtml(p.name || '')}</div>
        <div class="propai-property-meta">
          <span>📍 ${escHtml(p.location || '')}</span>
          ${p.size ? `<span>📐 ${escHtml(p.size)}</span>` : ''}
          ${p.type ? `<span>🏷️ ${escHtml(p.type)}</span>` : ''}
        </div>
        ${p.description ? `<div class="propai-property-desc">${escHtml(p.description)}</div>` : ''}
      </div>
    `).join('');

    return `<div class="propai-properties">${cards}</div>`;
  };

  // ── Quick Replies ─────────────────────────────────────────────────────────────
  const renderQuickReplies = (replies) => {
    els.quickReplies.innerHTML = '';
    if (!replies || !replies.length) return;

    replies.forEach((label) => {
      const btn = document.createElement('button');
      btn.className = 'propai-qr-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        sendMessage(label);
      });
      els.quickReplies.appendChild(btn);
    });
  };

  // ── Typing Indicator ──────────────────────────────────────────────────────────
  const showTyping = () => {
    isTyping = true;
    els.typing.style.display = 'flex';
    scrollToBottom();
    els.sendBtn.disabled = true;
    els.input.disabled = true;
  };

  const hideTyping = () => {
    isTyping = false;
    els.typing.style.display = 'none';
    els.sendBtn.disabled = false;
    els.input.disabled = false;
    els.input.focus();
  };

  // ── Handle Done State ─────────────────────────────────────────────────────────
  const handleDone = () => {
    els.doneBar.style.display = 'block';
    els.quickReplies.innerHTML = '';
    els.input.placeholder = 'Conversation completed';
    els.input.disabled = true;
    els.sendBtn.disabled = true;
  };

  // ── API Calls ─────────────────────────────────────────────────────────────────
  const apiCall = async (path, body) => {
    const res = await fetch(`${cfg.apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const startSession = async () => {
    showTyping();
    try {
      const data = await apiCall('/api/chat/start', { sessionId: sessionId || undefined });
      sessionId = data.sessionId;
      localStorage.setItem('propai_session_id', sessionId);
      currentStep = data.step;
      hideTyping();
      appendMessage(data.reply, 'bot');
      renderQuickReplies(data.quickReplies || []);
    } catch (err) {
      hideTyping();
      appendMessage(`Hello! 👋 Welcome to ${cfg.agencyName}. I'm having a little trouble connecting right now. Please try again in a moment.`, 'bot');
      console.error('[PropAI] Start session error:', err);
    }
  };

  const sendMessage = async (text) => {
    if (!text || !text.trim() || isTyping) return;
    const msg = text.trim();

    // Show user bubble
    appendMessage(msg, 'user');
    els.input.value = '';
    els.quickReplies.innerHTML = '';

    showTyping();

    try {
      const data = await apiCall('/api/chat', {
        sessionId,
        message: msg,
      });

      sessionId = data.sessionId;
      localStorage.setItem('propai_session_id', sessionId);
      currentStep = data.step;

      hideTyping();
      appendMessage(data.reply, 'bot', data.properties || []);
      renderQuickReplies(data.quickReplies || []);

      if (data.step === 'DONE') {
        handleDone();
      }

    } catch (err) {
      hideTyping();
      appendMessage(`Sorry, I ran into a connection issue. Please try again in a moment.`, 'bot');
      console.error('[PropAI] Send message error:', err);
    }
  };

  // ── Event Listeners ───────────────────────────────────────────────────────────
  const bindEvents = () => {
    // Open/close toggle
    els.btn.addEventListener('click', () => {
      if (isOpen) {
        closeChat();
      } else {
        openChat();
        // Start session on first open
        if (els.messages.children.length === 1) { // only typing indicator present
          startSession();
        }
      }
    });

    els.closeBtn.addEventListener('click', closeChat);

    // Send on button click
    els.sendBtn.addEventListener('click', () => {
      sendMessage(els.input.value);
    });

    // Send on Enter (not Shift+Enter)
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(els.input.value);
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isOpen && !els.panel.contains(e.target) && !els.btn.contains(e.target)) {
        closeChat();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeChat();
    });
  };

  // ── Show Unread Badge ─────────────────────────────────────────────────────────
  const showBadge = () => {
    if (!isOpen) {
      els.badge.style.display = 'flex';
    }
  };

  // ── Initialize ────────────────────────────────────────────────────────────────
  const init = () => {
    injectStyles();
    buildWidget();
    initRefs();
    bindEvents();

    // Show badge after 3s to draw attention
    setTimeout(showBadge, 3000);
  };

  // ── Boot ──────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

