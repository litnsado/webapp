/* ================================================================
   ROOTS — Memory Wall
   Upload open to any member; admin approves before it appears.
   ================================================================ */
(function () {
  'use strict';

  const ROOTS = window.ROOTS;
  const { $, toast, escapeHtml } = ROOTS;
  const client = ROOTS.client;

  const grid      = $('#memGrid');
  const emptyEl   = $('#memEmpty');
  const countEl   = $('#count');
  const skeleton  = $('#skeleton');
  const form      = $('#uploadForm');
  const submitBtn = $('#memSubmit');
  const errEl     = $('#memError');

  let pendingFile = null;

  async function load() {
    skeleton.hidden = false;
    emptyEl.hidden = true;

    try {
      const { data, error } = await client
        .from('memory_wall')
        .select('id, caption, image_url, created_at')
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      render(data || []);
    } catch (err) {
      toast('Could not load memories.', 'error');
      countEl.textContent = 'Offline';
    } finally {
      skeleton.hidden = true;
    }
  }

  function render(rows) {
    countEl.textContent = rows.length
      ? `${rows.length} memor${rows.length === 1 ? 'y' : 'ies'}`
      : 'Nothing here yet';

    if (!rows.length) {
      grid.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    grid.innerHTML = rows.map((m) => `
      <figure class="memitem glass" data-id="${m.id}">
        <img src="${escapeHtml(m.image_url)}" alt="" loading="lazy" decoding="async">
        ${m.caption ? `<figcaption>${escapeHtml(m.caption)}</figcaption>` : ''}
      </figure>
    `).join('');
  }

  const card = $('.photo-card');
  const preview = card.querySelector('.photo-card__preview');
  const placeholder = card.querySelector('.photo-card__placeholder');
  const spinner = card.querySelector('.photo-card__spinner');

  card.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      card.querySelector(`[data-input="${btn.dataset.pick}"]`).click();
    });
  });

  card.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      pendingFile = file;
      errEl.hidden = true;

      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.hidden = false;
      placeholder.hidden = true;
      card.classList.add('is-set');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    if (!pendingFile) {
      errEl.textContent = 'Please choose a photo.';
      errEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    spinner.hidden = false;

    try {
      const uid = await ROOTS.currentUserId();
      if (!uid) throw new Error('Not signed in');

      const { client: sb } = ROOTS;
      const compressed = await sb.storage
        .from('alumni-photos')
        .getPublicUrl('__probe__');
      void compressed;

      const blob = await (async () => {
        const bmp = await createImageBitmap(pendingFile, { imageOrientation: 'from-image' })
          .catch(() => null);
        const src = bmp || await new Promise((res, rej) => {
          const u = URL.createObjectURL(pendingFile);
          const im = new Image();
          im.onload = () => { URL.revokeObjectURL(u); res(im); };
          im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Bad image')); };
          im.src = u;
        });
        const w = src.width || src.naturalWidth;
        const h = src.height || src.naturalHeight;
        const side = Math.min(w, h);
        const c = document.createElement('canvas');
        c.width = c.height = 1200;
        const cx = c.getContext('2d');
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 1200, 1200);
        if (typeof src.close === 'function') src.close();
        return new Promise((res, rej) => c.toBlob(
          (b) => b ? res(b) : rej(new Error('Encode failed')),
          'image/jpeg', 0.82
        ));
      })();

      const path = `${uid}/memory-${Date.now()}.jpg`;
      const { error: upErr } = await client.storage
        .from('alumni-photos')
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (upErr) throw upErr;

      const { data: urlData } = client.storage
        .from('alumni-photos')
        .getPublicUrl(path);

      const caption = new FormData(form).get('caption') || '';

      const { error } = await client.from('memory_wall').insert({
        uploaded_by: uid,
        caption: String(caption).trim(),
        image_url: urlData.publicUrl,
        status: 'Pending'
      });
      if (error) throw error;

      toast('Sent for approval. Thank you.', 'success');
      ROOTS.sheet.close('upload');
      resetForm();

    } catch (err) {
      errEl.textContent = err.message || 'Upload failed. Try again.';
      errEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send for approval';
      spinner.hidden = true;
    }
  });

  function resetForm() {
    form.reset();
    pendingFile = null;
    preview.hidden = true;
    preview.removeAttribute('src');
    placeholder.hidden = false;
    card.classList.remove('is-set');
  }

  load();
})();
