/* ================================================================
   ROOTS — UI runtime
   Service worker, dock routing, bottom sheets, toasts, helpers.
   ================================================================ */

(function () {
  'use strict';

  const ROOTS = (window.ROOTS = window.ROOTS || {});

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }

  const sheetState = new WeakMap();

  function openSheet(id) {
    const sheet = document.getElementById(`sheet-${id}`);
    const scrim = $('[data-sheet-scrim]');
    if (!sheet) return;

    const lastFocus = document.activeElement;
    sheetState.set(sheet, { lastFocus });

    if (scrim) scrim.hidden = false;
    sheet.hidden = false;

    requestAnimationFrame(() => {
      if (scrim) scrim.classList.add('is-open');
      sheet.classList.add('is-open');
    });

    document.body.style.overflow = 'hidden';

    const focusable = sheet.querySelector(
      'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) setTimeout(() => focusable.focus(), 260);
  }

  function closeSheet(sheetOrId) {
    const sheet = typeof sheetOrId === 'string'
      ? document.getElementById(`sheet-${sheetOrId}`)
      : sheetOrId;
    if (!sheet) return;

    const scrim = $('[data-sheet-scrim]');
    sheet.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-open');
    document.body.style.overflow = '';

    setTimeout(() => {
      sheet.hidden = true;
      if (scrim && !$$('.sheet.is-open').length) scrim.hidden = true;

      const st = sheetState.get(sheet);
      if (st?.lastFocus?.focus) st.lastFocus.focus();
      sheetState.delete(sheet);
    }, 340);
  }

  function initSheets() {
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open-sheet]');
      if (opener) {
        e.preventDefault();
        openSheet(opener.dataset.openSheet);
        return;
      }

      const closer = e.target.closest('[data-close-sheet]');
      if (closer) {
        e.preventDefault();
        closeSheet(closer.closest('.sheet'));
        return;
      }

      if (e.target.matches('[data-sheet-scrim]')) {
        const open = $$('.sheet.is-open')[0];
        if (open) closeSheet(open);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = $$('.sheet.is-open')[0];
      if (open) closeSheet(open);
    });
  }

  let toastEl = null;
  let toastTimer = null;

  function toast(message, variant = 'default', ms = 3200) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.dataset.variant = variant;
    toastEl.classList.add('is-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, ms);
  }

  const DOCK_MATCHERS = [
    { test: /^\/(index\.html)?$/,  href: '/index.html' },
    { test: /^\/directory\.html/,  href: '/directory.html' },
    { test: /^\/memories\.html/,   href: '/memories.html' },
    { test: /^\/profile\.html/,    href: '/profile.html' }
  ];

  function setDockActive() {
    const path = location.pathname;
    const match = DOCK_MATCHERS.find((m) => m.test.test(path));
    if (!match) return;

    $$('.dock__item').forEach((item) => {
      const isActive = item.getAttribute('href') === match.href;
      item.classList.toggle('is-active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  async function resolveProfileDockLink() {
    const link = $('.dock__item[href="/profile.html"]');
    if (!link || !ROOTS.getMyProfile) return;

    try {
      const me = await ROOTS.getMyProfile();
      if (me?.id) {
        link.href = `/profile.html?id=${encodeURIComponent(me.id)}`;
      } else {
        link.href = '/onboard.html';
      }
    } catch {
      // Leave default href.
    }
  }

  function applyDockVisibility() {
    if (/^\/onboard\.html/.test(location.pathname)) {
      const dock = $('.dock');
      if (dock) dock.hidden = true;
      document.body.classList.add('no-dock');
    }
  }

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(profile) {
    if (!profile) return '';
    const a = (profile.first_name || '').trim();
    const b = (profile.second_name || '').trim();
    return ((a[0] || '') + (b[0] || '')).toUpperCase() || '?';
  }

  function fullName(profile) {
    if (!profile) return '';
    return [profile.first_name, profile.second_name]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(' ');
  }

  function displayName(profile) {
    if (!profile) return '';
    const nick = (profile.nickname || '').trim();
    return nick ? `${fullName(profile)} (${nick})` : fullName(profile);
  }

  function formatClassJourney(history = []) {
    if (!Array.isArray(history) || !history.length) return '';

    const byClass = new Map();
    history.forEach((h) => byClass.set(Number(h.class_no), h));

    const parts = [];

    const sections = new Set();
    for (let c = 6; c <= 10; c++) {
      const s = byClass.get(c)?.section;
      if (s) sections.add(s);
    }
    if (sections.size) {
      parts.push(`Classes 6-10 ${[...sections].sort().join('/')}`);
    }

    const groups = new Set();
    for (let c = 11; c <= 12; c++) {
      const g = byClass.get(c)?.group_name;
      if (g) groups.add(g);
    }
    if (groups.size) {
      parts.push(`11-12 ${[...groups].sort().join('/')}`);
    }

    return parts.join(' - ');
  }

  function monthName(index1to12) {
    const n = Number(index1to12);
    if (!Number.isFinite(n) || n < 1 || n > 12) return '';
    return MONTHS[n - 1];
  }

  function birthdayLabel(profile) {
    const d = profile?.birth_day;
    const m = monthName(profile?.birth_month);
    if (!d || !m) return '';
    return `${d} ${m}`;
  }

  function upcomingBirthdays(profiles, withinDays = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const out = [];

    for (const p of profiles || []) {
      const day = Number(p.birth_day);
      const monthIdx = MONTHS.findIndex(
        (m) => m.toLowerCase() === String(p.birth_month || '').toLowerCase()
      );
      if (!day || monthIdx < 0) continue;

      let next = new Date(today.getFullYear(), monthIdx, day);
      if (next < today) next = new Date(today.getFullYear() + 1, monthIdx, day);

      const days = Math.round((next - today) / 86400000);
      if (days <= withinDays) {
        out.push({ profile: p, date: next, days, isToday: days === 0 });
      }
    }

    return out.sort((a, b) => a.days - b.days);
  }

  function boot() {
    initSheets();
    setDockActive();
    applyDockVisibility();
    resolveProfileDockLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  Object.assign(ROOTS, {
    $, $$,
    sheet: { open: openSheet, close: closeSheet },
    toast,

    escapeHtml,
    initials,
    fullName,
    displayName,
    formatClassJourney,
    monthName,
    birthdayLabel,
    upcomingBirthdays,

    MONTHS
  });
})();
