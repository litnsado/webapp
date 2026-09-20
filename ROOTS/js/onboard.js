/* ================================================================
   ROOTS — onboarding
   Three steps. State held here, written once at the end.
   ================================================================ */
(function () {
  'use strict';

  const ROOTS = window.ROOTS;
  const { $, $$, toast, escapeHtml, MONTHS } = ROOTS;

  const invite = sessionStorage.getItem('roots.invite');
  if (!invite) {
    location.replace('/index.html');
    return;
  }

  const state = {
    step: 1,
    personal: {},
    history: new Map(),
    photos: { school: null, current: null },
    submitting: false
  };

  const CLASSES = [
    { n: 6,  year: '2002-03' },
    { n: 7,  year: '2003-04' },
    { n: 8,  year: '2004-05' },
    { n: 9,  year: '2005-06' },
    { n: 10, year: '2006-07' },
    { n: 11, year: '2007-08' },
    { n: 12, year: '2008-09' }
  ];
  const SECTIONS = ['A', 'B', 'C', 'D'];
  const GROUPS   = ['Bio Maths', 'Maths Computer', 'Commerce', 'Statistics'];

  const progressFill = $('#progressFill');
  const progressBar  = $('#progressBar');
  const stepLabel    = $('#stepLabel');
  const btnNext      = $('#btnNext');
  const btnBack      = $('#btnBack');
  const footer       = $('#footer');

  function goTo(step) {
    state.step = step;

    $$('.step').forEach((el) => {
      const active = el.dataset.step === String(step);
      el.hidden = !active;
      el.classList.toggle('is-active', active);
    });

    if (step === 'done') {
      footer.hidden = true;
      progressBar.hidden = true;
      return;
    }

    footer.hidden = false;
    progressBar.hidden = false;
    stepLabel.textContent = `Step ${step} of 3`;

    const pct = (step / 3) * 100;
    progressFill.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', step);

    btnBack.hidden = step === 1;
    btnNext.textContent = step === 3 ? 'Create my ROOT Card' : 'Continue';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const form1 = $('#form1');

  (function buildBirthday() {
    const daySel   = form1.querySelector('[name="birth_day"]');
    const monthSel = form1.querySelector('[name="birth_month"]');

    for (let d = 1; d <= 31; d++) {
      const o = document.createElement('option');
      o.value = o.textContent = d;
      daySel.appendChild(o);
    }
    MONTHS.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i + 1;
      o.textContent = m;
      monthSel.appendChild(o);
    });
  })();

  form1.querySelector('[name="whatsapp"]').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  function clearErrors() {
    $$('[data-error-for]').forEach((el) => { el.hidden = true; el.textContent = ''; });
  }

  function fieldError(name, message) {
    const el = document.querySelector(`[data-error-for="${name}"]`);
    if (el) { el.textContent = message; el.hidden = false; }
  }

  function validateStep1() {
    clearErrors();
    const fd = new FormData(form1);
    const first = (fd.get('first_name') || '').trim();
    const wa    = (fd.get('whatsapp') || '').trim();
    let ok = true;

    if (!first) { fieldError('first_name', 'Please enter your first name.'); ok = false; }
    if (!/^\d{10}$/.test(wa)) { fieldError('whatsapp', 'Enter a 10-digit mobile number.'); ok = false; }

    if (!ok) return false;

    const day = fd.get('birth_day');
    const monthIdx = fd.get('birth_month');

    state.personal = {
      first_name:   first,
      second_name:  (fd.get('second_name') || '').trim(),
      nickname:     (fd.get('nickname') || '').trim(),
      gender:       fd.get('gender') || null,
      birth_day:    day ? Number(day) : null,
      birth_month:  monthIdx ? MONTHS[Number(monthIdx) - 1] : null,
      profession:   (fd.get('profession') || '').trim(),
      company:      (fd.get('company') || '').trim(),
      location:     (fd.get('location') || '').trim(),
      whatsapp:     `+91${wa}`,
      phone_visible: form1.querySelector('[name="phone_visible"]').checked
    };
    return true;
  }

  const timelineEl = $('#timeline');
  const hintEl     = $('#timelineHint');

  function renderTimeline() {
    timelineEl.innerHTML = CLASSES.map(({ n, year }) => {
      const isSenior = n >= 11;
      const entry = state.history.get(n) || {};
      const filled = isSenior
        ? Boolean(entry.group_name && entry.section)
        : Boolean(entry.section);

      return `
        <li class="tl ${filled ? 'is-filled' : ''}" data-class="${n}">
          <button class="tl__dot" type="button" aria-expanded="false"
                  aria-label="Class ${n}">
            <span class="tl__num">${n}</span>
          </button>
          <div class="tl__body">
            <div class="tl__head">
              <span class="tl__class">Class ${n}</span>
              <span class="tl__year">${year}</span>
            </div>
            <div class="tl__value" data-value>
              ${filled
                ? escapeHtml(
                    isSenior
                      ? `${entry.group_name} - Section ${entry.section}`
                      : `Section ${entry.section}`
                  )
                : '<em>Not set</em>'}
            </div>
            <div class="tl__picker" hidden>
              ${isSenior ? `
                <div class="chip-row" data-group>
                  ${GROUPS.map((g) => `
                    <button class="chip ${entry.group_name === g ? 'is-on' : ''}"
                            type="button" data-group-val="${escapeHtml(g)}">${escapeHtml(g)}</button>
                  `).join('')}
                </div>
              ` : ''}
              <div class="chip-row" data-section>
                ${SECTIONS.map((s) => `
                  <button class="chip ${entry.section === s ? 'is-on' : ''}"
                          type="button" data-section-val="${s}">${s}</button>
                `).join('')}
              </div>
            </div>
          </div>
        </li>
      `;
    }).join('');
  }

  timelineEl.addEventListener('click', (e) => {
    const li = e.target.closest('.tl');
    if (!li) return;
    const n = Number(li.dataset.class);

    if (e.target.closest('.tl__dot')) {
      const picker = li.querySelector('.tl__picker');
      const open = !picker.hidden;
      $$('.tl__picker').forEach((p) => { p.hidden = true; });
      $$('.tl__dot').forEach((d) => d.setAttribute('aria-expanded', 'false'));
      if (!open) {
        picker.hidden = false;
        li.querySelector('.tl__dot').setAttribute('aria-expanded', 'true');
      }
      return;
    }

    const groupBtn = e.target.closest('[data-group-val]');
    if (groupBtn) {
      li.querySelectorAll('[data-group-val]').forEach((b) => b.classList.remove('is-on'));
      groupBtn.classList.add('is-on');
      const entry = state.history.get(n) || {};
      entry.group_name = groupBtn.dataset.groupVal;
      state.history.set(n, entry);
      refreshTimelineRow(n);
      return;
    }

    const secBtn = e.target.closest('[data-section-val]');
    if (secBtn) {
      li.querySelectorAll('[data-section-val]').forEach((b) => b.classList.remove('is-on'));
      secBtn.classList.add('is-on');
      const entry = state.history.get(n) || {};
      entry.section = secBtn.dataset.sectionVal;
      state.history.set(n, entry);
      refreshTimelineRow(n);
    }
  });

  function refreshTimelineRow(n) {
    const li = timelineEl.querySelector(`[data-class="${n}"]`);
    if (!li) return;
    const entry = state.history.get(n) || {};
    const isSenior = n >= 11;
    const filled = isSenior
      ? Boolean(entry.group_name && entry.section)
      : Boolean(entry.section);

    li.classList.toggle('is-filled', filled);
    li.querySelector('[data-value]').innerHTML = filled
      ? escapeHtml(
          isSenior
            ? `${entry.group_name} - Section ${entry.section}`
            : `Section ${entry.section}`
        )
      : '<em>Not set</em>';

    if (filled) li.querySelector('.tl__picker').hidden = true;

    const remaining = CLASSES.filter(({ n: cn }) => !isFilled(cn)).length;
    hintEl.textContent = remaining
      ? `${remaining} year${remaining > 1 ? 's' : ''} still to fill in.`
      : 'All seven years filled in. Looking good.';
  }

  function isFilled(n) {
    const e = state.history.get(n);
    if (!e) return false;
    return n >= 11 ? Boolean(e.group_name && e.section) : Boolean(e.section);
  }

  function validateStep2() {
    const missing = CLASSES.filter(({ n }) => !isFilled(n)).map(({ n }) => n);
    if (missing.length) {
      hintEl.textContent = `Still needed: Class ${missing.join(', ')}.`;
      hintEl.classList.add('is-warn');
      setTimeout(() => hintEl.classList.remove('is-warn'), 1200);
      return false;
    }
    return true;
  }

  $$('.photo-card').forEach((card) => {
    const kind = card.dataset.kind;
    const preview = card.querySelector('.photo-card__preview');
    const placeholder = card.querySelector('.photo-card__placeholder');
    const spinner = card.querySelector('.photo-card__spinner');

    card.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const which = btn.dataset.pick;
        card.querySelector(`[data-input="${which}"]`).click();
      });
    });

    card.querySelectorAll('input[type="file"]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        clearErrors();
        spinner.hidden = false;
        card.classList.add('is-busy');

        try {
          const url = await ROOTS.uploadPhoto(file, kind);
          state.photos[kind] = url;

          const objectUrl = URL.createObjectURL(file);
          preview.src = objectUrl;
          preview.hidden = false;
          placeholder.hidden = true;
          card.classList.add('is-set');
        } catch (err) {
          fieldError(`${kind}_photo`, err.message || 'Upload failed. Try again.');
        } finally {
          spinner.hidden = true;
          card.classList.remove('is-busy');
        }
      });
    });
  });

  function validateStep3() {
    clearErrors();
    let ok = true;
    if (!state.photos.school)  { fieldError('school_photo',  'Please add a school-time photo.'); ok = false; }
    if (!state.photos.current) { fieldError('current_photo', 'Please add a current photo.'); ok = false; }
    return ok;
  }

  async function submit() {
    if (state.submitting) return;
    state.submitting = true;

    btnNext.disabled = true;
    btnNext.textContent = 'Creating your card...';

    try {
      const history = CLASSES
        .map(({ n }) => {
          const e = state.history.get(n);
          if (!e) return null;
          return {
            class_no: n,
            section: e.section || '',
            group_name: n >= 11 ? (e.group_name || '') : ''
          };
        })
        .filter(Boolean);

      await ROOTS.joinRoots({
        invite,
        personal: state.personal,
        schoolPhoto: state.photos.school,
        currentPhoto: state.photos.current,
        history
      });

      sessionStorage.removeItem('roots.invite');
      goTo('done');

    } catch (err) {
      const msg = String(err?.message || '');
      if (/already joined/i.test(msg)) {
        toast('This device has already submitted a card.', 'error');
      } else if (/invite code/i.test(msg)) {
        toast('The invite code is no longer valid.', 'error');
        setTimeout(() => location.replace('/index.html'), 1600);
      } else {
        toast(msg || 'Something went wrong. Please try again.', 'error');
      }
      btnNext.disabled = false;
      btnNext.textContent = 'Create my ROOT Card';
      state.submitting = false;
    }
  }

  btnNext.addEventListener('click', async () => {
    if (state.step === 1) {
      if (!validateStep1()) return;
      goTo(2);
      return;
    }
    if (state.step === 2) {
      if (!validateStep2()) return;
      goTo(3);
      return;
    }
    if (state.step === 3) {
      if (!validateStep3()) return;
      await submit();
    }
  });

  btnBack.addEventListener('click', () => {
    if (state.step > 1) goTo(state.step - 1);
  });

  renderTimeline();
  goTo(1);
})();
