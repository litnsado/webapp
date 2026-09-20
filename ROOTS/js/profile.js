/* ================================================================
   ROOTS — ROOT Card viewer
   Then/Now crossfade, roots draw, years light up 6 -> 12.
   ================================================================ */
(function () {
  'use strict';

  const ROOTS = window.ROOTS;
  const {
    $, $$, toast, escapeHtml, fullName, birthdayLabel
  } = ROOTS;

  const id = new URLSearchParams(location.search).get('id');
  const profileEl = $('#profile');
  const notFound  = $('#notFound');

  if (!id) { showNotFound(); return; }

  (async function load() {
    try {
      const p = await ROOTS.getProfile(id);
      if (!p) { showNotFound(); return; }
      render(p);
      profileEl.hidden = false;
      setTimeout(() => playRecognition(p), 180);
    } catch (err) {
      toast('Could not load that profile.', 'error');
      showNotFound();
    }
  })();

  function showNotFound() {
    notFound.hidden = false;
  }

  function render(p) {
    const school  = p.school_photo  || p.current_photo || '';
    const current = p.current_photo || p.school_photo  || '';

    const imgSchool  = $('#imgSchool');
    const imgCurrent = $('#imgCurrent');

    if (school)  imgSchool.src  = school;
    if (current) imgCurrent.src = current;

    if (!p.school_photo || !p.current_photo) {
      $('#tnToggle').hidden = true;
      $('#frameThen').hidden = !p.school_photo;
      $('#frameNow').hidden  = !p.current_photo;
      $('#frameNow').classList.toggle('is-visible', Boolean(p.current_photo));
      $('#frameThen').classList.toggle('is-visible', Boolean(p.school_photo) && !p.current_photo);
    }

    $('#name').textContent = fullName(p) || 'Classmate';

    const nick = $('#nick');
    if (p.nickname) {
      nick.textContent = `"${p.nickname}"`;
      nick.hidden = false;
    }

    const byClass = new Map(
      (p.class_history || []).map((h) => [Number(h.class_no), h])
    );

    const CLASSES = [6, 7, 8, 9, 10, 11, 12];
    $('#journeyList').innerHTML = CLASSES.map((n) => {
      const h = byClass.get(n);
      if (!h) return '';

      const isSenior = n >= 11;
      const detail = isSenior
        ? [h.group_name, h.section ? `Section ${h.section}` : ''].filter(Boolean).join(' - ')
        : (h.section ? `Section ${h.section}` : '');

      return `
        <li class="pj" data-class="${n}">
          <span class="pj__year">Class ${n}</span>
          <span class="pj__detail">${escapeHtml(detail || '-')}</span>
        </li>
      `;
    }).join('');

    const rows = [];
    if (p.profession) rows.push(['Profession', p.profession]);
    if (p.company)    rows.push(['Company', p.company]);
    if (p.location)   rows.push(['Location', p.location]);

    const bday = birthdayLabel(p);
    if (bday) rows.push(['Birthday', bday]);

    if (rows.length) {
      $('#detailsList').innerHTML = rows.map(([k, v]) => `
        <div class="details__row">
          <dt>${escapeHtml(k)}</dt>
          <dd>${escapeHtml(v)}</dd>
        </div>
      `).join('');
    } else {
      $('.details').hidden = true;
    }

    if (p.phone_visible && p.whatsapp) {
      $('#contact').hidden = false;
      const digits = String(p.whatsapp).replace(/\D/g, '');
      $('#waBtn').href = `https://wa.me/${digits}`;
    }

    $('#shareBtn').addEventListener('click', () => share(p));
  }

  function playRecognition(p) {
    const frameThen = $('#frameThen');
    const frameNow  = $('#frameNow');

    if (p.school_photo && p.current_photo) {
      frameThen.classList.add('is-visible');
      setTimeout(() => {
        frameThen.classList.remove('is-visible');
        frameNow.classList.add('is-visible');
      }, 1400);
    } else {
      frameThen.classList.add('is-visible');
      frameNow.classList.add('is-visible');
    }

    setTimeout(drawRoot, 1900);

    const items = $$('.pj');
    items.forEach((el, i) => {
      setTimeout(() => el.classList.add('is-lit'), 2300 + i * 150);
    });
  }

  function drawRoot() {
    const root = $('#root');
    if (!root) return;
    root.classList.add('is-drawn');

    $$('#rootPaths .root__p').forEach((path, i) => {
      const len = path.getTotalLength();
      path.style.strokeDasharray  = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.style.transition = `stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1) ${i * 110}ms`;
      requestAnimationFrame(() => {
        path.style.strokeDashoffset = '0';
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tnToggle')) return;
    const then = $('#frameThen');
    const now  = $('#frameNow');
    const thenOn = then.classList.contains('is-visible');
    then.classList.toggle('is-visible', !thenOn);
    now.classList.toggle('is-visible', thenOn);
  });

  async function share(p) {
    const url = location.href;
    const title = `${fullName(p)} - ROOTS`;
    const text = p.nickname
      ? `${fullName(p)} ("${p.nickname}") - SSLC Batch 2006-07`
      : `${fullName(p)} - SSLC Batch 2006-07`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch { /* cancelled */ }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('Link copied.', 'success');
    } catch {
      toast('Could not share on this device.', 'error');
    }
  }
})();
