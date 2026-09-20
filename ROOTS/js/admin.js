/* ================================================================
   ROOTS — admin panel
   Email/password auth, approval queue, edit, CSV export, birthdays.
   ================================================================ */
(function () {
  'use strict';

  const ROOTS = window.ROOTS;
  const {
    $, $$, toast, escapeHtml, initials, fullName,
    formatClassJourney, upcomingBirthdays, MONTHS
  } = ROOTS;

  const client = ROOTS.client;

  const loginView = $('#loginView');
  const adminView = $('#adminView');

  let profiles = [];
  let memories = [];
  let activeTab = 'pending';

  async function checkSession() {
    await ROOTS.ready;
    const { data: { session } } = await client.auth.getSession();
    if (session?.user && !session.user.is_anonymous) {
      return true;
    }
    return false;
  }
  
  async function signIn(email, password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await client.auth.signOut();
    location.reload();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn');
    const errEl = $('#loginError');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const fd = new FormData(e.target);
      await signIn(fd.get('email'), fd.get('password'));
      await boot();
    } catch (err) {
      errEl.textContent = /invalid/i.test(err.message)
        ? 'Wrong email or password.'
        : (err.message || 'Sign-in failed.');
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  $('#logoutBtn').addEventListener('click', signOut);

  async function boot() {
    const authed = await checkSession();
    if (!authed) {
      loginView.hidden = false;
      adminView.hidden = true;
      return;
    }

    loginView.hidden = true;
    adminView.hidden = false;

    await load();
  }

  async function load() {
    $('#adminMeta').textContent = 'Loading...';
    try {
      const [p, m] = await Promise.all([
        client.from('profiles')
          .select(`
            id, owner_id, first_name, second_name, nickname, gender,
            birth_day, birth_month, profession, company, location,
            whatsapp, phone_visible, school_photo, current_photo,
            status, created_at,
            class_history ( class_no, section, group_name )
          `)
          .order('created_at', { ascending: false }),
        client.from('memory_wall')
          .select('id, uploaded_by, caption, image_url, status, created_at')
          .order('created_at', { ascending: false })
      ]);

      if (p.error) throw p.error;
      if (m.error) throw m.error;

      profiles = p.data || [];
      memories = m.data || [];

      const pending = profiles.filter((x) => x.status === 'Pending').length;
      $('#pendingCount').textContent = pending;
      $('#memCount').textContent = memories.filter((x) => x.status === 'Pending').length;

      $('#adminMeta').textContent = `${profiles.length} total - ${pending} pending`;

      renderTab();
    } catch (err) {
      toast(err.message || 'Failed to load data.', 'error');
      $('#adminMeta').textContent = 'Error';
    }
  }

  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    $$('.tab').forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    $$('.admin__panel').forEach((p) => {
      p.hidden = p.dataset.panel !== activeTab;
    });
    renderTab();
  });

  function renderTab() {
    if (activeTab === 'pending')   renderPending();
    if (activeTab === 'approved')  renderApproved();
    if (activeTab === 'memories')  renderMemories();
    if (activeTab === 'birthdays') renderBirthdays();
  }

  function renderPending() {
    const rows = profiles.filter((p) => p.status === 'Pending');
    const el = $('#panelPending');

    if (!rows.length) {
      el.innerHTML = `<div class="empty empty--inline"><p>Nothing waiting. All caught up.</p></div>`;
      return;
    }

    el.innerHTML = `<div class="queue">${rows.map(queueRow).join('')}</div>`;
  }

  function queueRow(p) {
    const journey = formatClassJourney(p.class_history);

    return `
      <article class="qrow glass" data-id="${p.id}">
        <div class="qrow__photos">
          <div class="qrow__photo">
            ${p.school_photo
              ? `<img src="${escapeHtml(p.school_photo)}" alt="" loading="lazy">`
              : `<span class="avatar__initials">${escapeHtml(initials(p))}</span>`}
            <span class="qrow__tag">Then</span>
          </div>
          <div class="qrow__photo">
            ${p.current_photo
              ? `<img src="${escapeHtml(p.current_photo)}" alt="" loading="lazy">`
              : `<span class="avatar__initials">${escapeHtml(initials(p))}</span>`}
            <span class="qrow__tag">Now</span>
          </div>
        </div>

        <div class="qrow__body">
          <h3 class="qrow__name">${escapeHtml(fullName(p))}</h3>
          ${p.nickname ? `<p class="qrow__nick">"${escapeHtml(p.nickname)}"</p>` : ''}
          <p class="qrow__line">
            ${[p.profession, p.location].filter(Boolean).map(escapeHtml).join(' - ') || '-'}
          </p>
          ${journey ? `<p class="qrow__line qrow__line--dim">${escapeHtml(journey)}</p>` : ''}
          <p class="qrow__line qrow__line--dim">${escapeHtml(p.whatsapp || '')}</p>
        </div>

        <div class="qrow__actions">
          <button class="btn btn--primary btn--sm" data-act="approve" data-id="${p.id}">Approve</button>
          <button class="btn btn--ghost btn--sm"   data-act="edit"    data-id="${p.id}">Edit</button>
          <button class="btn btn--danger btn--sm"  data-act="reject"  data-id="${p.id}">Reject</button>
        </div>
      </article>
    `;
  }

  function renderApproved() {
    const rows = profiles.filter((p) => p.status === 'Approved');
    const el = $('#panelApproved');

    if (!rows.length) {
      el.innerHTML = `<div class="empty empty--inline"><p>No approved profiles yet.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="atable">
        ${rows.map((p) => `
          <div class="arow" data-id="${p.id}">
            <div class="arow__main">
              <span class="arow__name">${escapeHtml(fullName(p))}</span>
              <span class="arow__meta">${escapeHtml(p.location || p.profession || '')}</span>
            </div>
            <div class="arow__actions">
              <button class="icon-btn icon-btn--sm" data-act="edit" data-id="${p.id}" aria-label="Edit">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                        stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="icon-btn icon-btn--sm icon-btn--danger" data-act="delete" data-id="${p.id}" aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m-8 0 1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"
                        stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderMemories() {
    const el = $('#panelMemories');

    if (!memories.length) {
      el.innerHTML = `<div class="empty empty--inline"><p>No memories uploaded yet.</p></div>`;
      return;
    }

    el.innerHTML = `<div class="mqueue">${memories.map((m) => `
      <article class="mrow glass" data-id="${m.id}">
        <img class="mrow__img" src="${escapeHtml(m.image_url)}" alt="" loading="lazy">
        <div class="mrow__body">
          <p class="mrow__caption">${escapeHtml(m.caption || '(no caption)')}</p>
          <span class="pill pill--${m.status.toLowerCase()}">${escapeHtml(m.status)}</span>
        </div>
        <div class="mrow__actions">
          ${m.status === 'Pending' ? `
            <button class="btn btn--primary btn--sm" data-act="m-approve" data-id="${m.id}">Approve</button>
          ` : ''}
          <button class="btn btn--danger btn--sm" data-act="m-delete" data-id="${m.id}">Delete</button>
        </div>
      </article>
    `).join('')}</div>`;
  }

  function renderBirthdays() {
    const el = $('#panelBirthdays');
    const approved = profiles.filter((p) => p.status === 'Approved');
    const upcoming = upcomingBirthdays(approved, 365);

    if (!upcoming.length) {
      el.innerHTML = `<div class="empty empty--inline"><p>No birthdays recorded yet.</p></div>`;
      return;
    }

    const byMonth = new Map();
    upcoming.forEach((u) => {
      const m = MONTHS[Number(u.profile.birth_month) - 1]
        || String(u.profile.birth_month || 'Unknown');
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(u);
    });

    el.innerHTML = [...byMonth.entries()].map(([month, list]) => `
      <section class="bmonth">
        <h3 class="bmonth__title">${escapeHtml(month)}</h3>
        <div class="bmonth__list">
          ${list.map(({ profile, days, isToday }) => `
            <a class="brow ${isToday ? 'is-today' : ''}"
               href="/profile.html?id=${encodeURIComponent(profile.id)}">
              <span class="brow__day">${profile.birth_day}</span>
              <span class="brow__name">${escapeHtml(fullName(profile))}</span>
              <span class="brow__when">${
                isToday ? 'Today' : days <= 30 ? `in ${days}d` : ''
              }</span>
            </a>
          `).join('')}
        </div>
      </section>
    `).join('');
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const act = btn.dataset.act;
    const id  = btn.dataset.id;

    if (act === 'approve')     return setStatus(id, 'Approved', btn);
    if (act === 'reject')      return setStatus(id, 'Rejected', btn);
    if (act === 'delete')      return softDelete(id, btn);
    if (act === 'edit')        return openEdit(id);
    if (act === 'm-approve')   return setMemoryStatus(id, 'Approved', btn);
    if (act === 'm-delete')    return deleteMemory(id, btn);
  });

  async function setStatus(id, status, btn) {
    btn.disabled = true;
    const { error } = await client
      .from('profiles')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast(error.message, 'error');
      btn.disabled = false;
      return;
    }

    const p = profiles.find((x) => x.id === id);
    if (p) p.status = status;

    toast(status === 'Approved' ? 'Approved.' : 'Rejected.', 'success');
    refreshCounts();
    renderTab();
  }

  async function softDelete(id, btn) {
    if (!confirm('Remove this profile from the directory? This can be undone in the database.')) return;
    btn.disabled = true;
    await setStatus(id, 'Deleted', btn);
  }

  async function setMemoryStatus(id, status, btn) {
    btn.disabled = true;
    const { error } = await client
      .from('memory_wall')
      .update({ status })
      .eq('id', id);

    if (error) { toast(error.message, 'error'); btn.disabled = false; return; }

    const m = memories.find((x) => x.id === id);
    if (m) m.status = status;

    toast('Memory approved.', 'success');
    refreshCounts();
    renderMemories();
  }

  async function deleteMemory(id, btn) {
    if (!confirm('Delete this memory permanently?')) return;
    btn.disabled = true;

    const { error } = await client.from('memory_wall').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); btn.disabled = false; return; }

    memories = memories.filter((x) => x.id !== id);
    refreshCounts();
    renderMemories();
    toast('Deleted.', 'success');
  }

  function refreshCounts() {
    const pending = profiles.filter((x) => x.status === 'Pending').length;
    $('#pendingCount').textContent = pending;
    $('#memCount').textContent = memories.filter((x) => x.status === 'Pending').length;
    $('#adminMeta').textContent = `${profiles.filter((x) => x.status !== 'Deleted').length} total - ${pending} pending`;
  }

  const EDIT_FIELDS = [
    ['first_name',   'First name',    'text'],
    ['second_name',  'Second name',   'text'],
    ['nickname',     'Nickname',      'text'],
    ['profession',   'Profession',    'text'],
    ['company',      'Company',       'text'],
    ['location',     'Location',      'text'],
    ['whatsapp',     'WhatsApp',      'tel']
  ];

  function openEdit(id) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;

    $('#editForm').innerHTML = EDIT_FIELDS.map(([name, label, type]) => `
      <label class="field">
        <span class="field__label">${label}</span>
        <input class="field__input field__input--plain" type="${type}"
               name="${name}" value="${escapeHtml(p[name] ?? '')}">
      </label>
    `).join('') + `
      <label class="toggle">
        <input type="checkbox" name="phone_visible" ${p.phone_visible ? 'checked' : ''}>
        <span class="toggle__track" aria-hidden="true"><span class="toggle__knob"></span></span>
        <span class="toggle__text">Show number on profile</span>
      </label>
      <input type="hidden" name="__id" value="${p.id}">
    `;

    $('#editForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const patch = {};
      EDIT_FIELDS.forEach(([k]) => { patch[k] = (fd.get(k) || '').trim(); });
      patch.phone_visible = e.target.querySelector('[name="phone_visible"]').checked;

      const { error } = await client.from('profiles').update(patch).eq('id', p.id);
      if (error) { toast(error.message, 'error'); return; }

      Object.assign(p, patch);
      toast('Saved.', 'success');
      ROOTS.sheet.close('edit');
      renderTab();
    };

    ROOTS.sheet.open('edit');
  }

  $('#exportBtn').addEventListener('click', () => {
    const cols = [
      'first_name', 'second_name', 'nickname', 'gender',
      'birth_day', 'birth_month', 'profession', 'company',
      'location', 'whatsapp', 'phone_visible', 'status',
      'class_6', 'class_7', 'class_8', 'class_9', 'class_10',
      'class_11_group', 'class_11_section',
      'class_12_group', 'class_12_section'
    ];

    const rows = profiles
      .filter((p) => p.status === 'Approved')
      .map((p) => {
        const byClass = new Map((p.class_history || []).map((h) => [Number(h.class_no), h]));
        const get = (n) => byClass.get(n) || {};
        return [
          p.first_name, p.second_name, p.nickname, p.gender,
          p.birth_day, p.birth_month, p.profession, p.company,
          p.location, p.whatsapp, p.phone_visible ? 'Yes' : 'No', p.status,
          get(6).section, get(7).section, get(8).section,
          get(9).section, get(10).section,
          get(11).group_name, get(11).section,
          get(12).group_name, get(12).section
        ];
      });

    const csv = [cols, ...rows].map(csvLine).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roots-batch-2006-07-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast('Exported.', 'success');
  });

  function csvLine(cells) {
    return cells.map((c) => {
      const s = c == null ? '' : String(c);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }

  boot();
})();
