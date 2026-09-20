/* ================================================================
   ROOTS — directory
   Loads all approved profiles once, filters client-side.
   ================================================================ */
(function () {
  'use strict';

  const ROOTS = window.ROOTS;
  const {
    $, toast, escapeHtml, initials, fullName,
    formatClassJourney, birthdayLabel, upcomingBirthdays
  } = ROOTS;

  const grid        = $('#grid');
  const empty       = $('#empty');
  const emptyMsg    = $('#emptyMsg');
  const skeleton    = $('#skeleton');
  const countEl     = $('#count');
  const searchInput = $('#searchInput');
  const searchClear = $('#searchClear');
  const filtersEl   = $('#filters');
  const bdayWrap    = $('#birthdays');
  const bdayStrip   = $('#birthdaysStrip');
  const refreshBtn  = $('#refreshBtn');

  let all = [];
  let query = '';
  let activeFilter = 'all';

  async function load(showSkeleton = true) {
    if (showSkeleton) skeleton.hidden = false;
    empty.hidden = true;

    try {
      all = await ROOTS.getDirectory();
      renderBirthdays();
      applyFilters();
    } catch (err) {
      toast('Could not load the directory.', 'error');
      grid.innerHTML = '';
      countEl.textContent = 'Offline';
    } finally {
      skeleton.hidden = true;
    }
  }

  function renderBirthdays() {
    const upcoming = upcomingBirthdays(all, 30).slice(0, 8);
    if (!upcoming.length) { bdayWrap.hidden = true; return; }

    bdayWrap.hidden = false;
    bdayStrip.innerHTML = upcoming.map(({ profile, days, isToday }) => {
      const photo = profile.current_photo || profile.school_photo || '';
      const when = isToday ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
      return `
        <a class="bday ${isToday ? 'is-today' : ''}"
           href="/profile.html?id=${encodeURIComponent(profile.id)}">
          <span class="bday__avatar">
            ${photo
              ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">`
              : `<span class="avatar__initials">${escapeHtml(initials(profile))}</span>`}
          </span>
          <span class="bday__name">${escapeHtml(profile.nickname || profile.first_name)}</span>
          <span class="bday__when">${escapeHtml(when)}</span>
        </a>
      `;
    }).join('');
  }

  function matchesFilter(p) {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'birthday') return true;

    const hist = p.class_history || [];

    if (activeFilter.startsWith('c')) {
      const n = Number(activeFilter.slice(1));
      return hist.some((h) => Number(h.class_no) === n);
    }
    if (activeFilter.startsWith('sec')) {
      const s = activeFilter.slice(3);
      return hist.some((h) => (h.section || '').toUpperCase() === s);
    }
    return true;
  }

  function matchesQuery(p) {
    if (!query) return true;
    const q = query.toLowerCase();
    const hay = [
      p.first_name, p.second_name, p.nickname, p.profession,
      p.company, p.location, formatClassJourney(p.class_history)
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }

  function applyFilters() {
    let rows = all;

    if (activeFilter === 'birthday') {
      const today = upcomingBirthdays(all, 0);
      rows = today.map((b) => b.profile);
    } else {
      rows = all.filter(matchesFilter);
    }

    rows = rows.filter(matchesQuery);

    render(rows);

    searchClear.hidden = !query;
    countEl.textContent = query || activeFilter !== 'all'
      ? `${rows.length} of ${all.length} classmates`
      : `${all.length} classmate${all.length === 1 ? '' : 's'}`;
  }

  function render(rows) {
    if (!rows.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      emptyMsg.textContent = query
        ? 'No classmates match that search.'
        : 'Nobody here yet. Be the first to join.';
      return;
    }

    empty.hidden = true;
    grid.innerHTML = rows.map(cardHtml).join('');

    requestAnimationFrame(() => {
      grid.querySelectorAll('.card').forEach((el, i) => {
        el.style.setProperty('--i', i);
        el.classList.add('is-in');
      });
    });
  }

  function cardHtml(p) {
    const photo = p.current_photo || p.school_photo || '';
    const journey = formatClassJourney(p.class_history);
    const bday = birthdayLabel(p);

    return `
      <a class="card glass" href="/profile.html?id=${encodeURIComponent(p.id)}"
         style="--i: 0">
        <div class="card__photo">
          ${photo
            ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" decoding="async">`
            : `<span class="avatar__initials avatar__initials--lg">${escapeHtml(initials(p))}</span>`}
        </div>
        <div class="card__body">
          <h3 class="card__name">${escapeHtml(fullName(p) || 'Classmate')}</h3>
          ${p.nickname ? `<p class="card__nick">"${escapeHtml(p.nickname)}"</p>` : ''}
          ${p.profession ? `<p class="card__meta">${escapeHtml(p.profession)}${
            p.location ? ` - ${escapeHtml(p.location)}` : ''
          }</p>` : (p.location ? `<p class="card__meta">${escapeHtml(p.location)}</p>` : '')}
          ${journey ? `<p class="card__journey">${escapeHtml(journey)}</p>` : ''}
          ${bday ? `<p class="card__bday">${escapeHtml(bday)}</p>` : ''}
        </div>
      </a>
    `;
  }

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = searchInput.value.trim();
      applyFilters();
    }, 160);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    query = '';
    searchInput.focus();
    applyFilters();
  });

  filtersEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filtersEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-on'));
    chip.classList.add('is-on');
    activeFilter = chip.dataset.filter;
    applyFilters();

    chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('is-spinning');
    load(false).finally(() => {
      setTimeout(() => refreshBtn.classList.remove('is-spinning'), 500);
    });
  });

  let lastFetch = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastFetch > 60000) {
      lastFetch = Date.now();
      load(false);
    }
  });

  load();
})();
