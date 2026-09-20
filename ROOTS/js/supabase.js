/* ================================================================
   ROOTS — data layer
   Supabase client, anonymous auth, typed accessors.
   Exposes window.ROOTS. Pages must not touch the client directly.
   ================================================================ */

(function () {
  'use strict';

  const SUPABASE_URL      = 'https://djlfercvxngnspybbjzv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbGZlcmN2eG5nbnNweWJianp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NzE1NDksImV4cCI6MjEwNTQ0NzU0OX0.oG6Uvjuq8NNoqKLK_XTdwg-1abuak_us-Jf_bkqAdIA';

  const BUCKET = 'alumni-photos';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[ROOTS] Supabase SDK failed to load. Check the CDN script tag.');
    window.ROOTS = { ready: Promise.resolve(null), error: 'sdk-missing' };
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'roots.auth'
    }
  });

  let authPromise = null;

  function ensureAuth() {
    if (authPromise) return authPromise;

    authPromise = (async () => {
      const { data: { session } } = await client.auth.getSession();
      if (session) return session;

      const { data, error } = await client.auth.signInAnonymously();
      if (error) {
        authPromise = null;
        throw error;
      }
      return data.session;
    })();

    return authPromise;
  }

  async function currentUserId() {
    const session = await ensureAuth();
    return session?.user?.id ?? null;
  }

  async function verifyInvite(code) {
    if (!code) return false;
    await ensureAuth();
    const { data, error } = await client.rpc('verify_invite', {
      p_code: String(code).trim().toUpperCase()
    });
    if (error) throw error;
    return data === true;
  }

  async function getConfig() {
    return {
      schoolName: 'Government Higher Secondary School, Dhalavaipettai',
      batchLabel: 'SSLC Batch 2006-07'
    };
  }

  const PROFILE_CARD_FIELDS = `
    id, first_name, second_name, nickname, gender, profession, company,
    location, whatsapp, phone_visible, school_photo, current_photo,
    birth_day, birth_month, status, created_at,
    class_history ( class_no, section, group_name )
  `;

  async function getDirectory() {
    await ensureAuth();
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_CARD_FIELDS)
      .eq('status', 'Approved')
      .order('first_name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async function getProfile(id) {
    if (!id) throw new Error('Missing profile id');
    await ensureAuth();
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_CARD_FIELDS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  let ownProfilePromise = null;

  function getMyProfile(force = false) {
    if (force) ownProfilePromise = null;
    if (ownProfilePromise) return ownProfilePromise;

    ownProfilePromise = (async () => {
      const uid = await currentUserId();
      if (!uid) return null;

      const { data, error } = await client
        .from('profiles')
        .select(PROFILE_CARD_FIELDS)
        .eq('owner_id', uid)
        .maybeSingle();

      if (error) throw error;
      return data;
    })();

    return ownProfilePromise;
  }

  const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  const TARGET_SIZE      = 1200;
  const JPEG_QUALITY     = 0.82;

  function loadImageFallback(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
      img.src = url;
    });
  }

  async function compressToSquare(file) {
    let src;
    try {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      src = await loadImageFallback(file);
    }

    const w = src.width  || src.naturalWidth;
    const h = src.height || src.naturalHeight;
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TARGET_SIZE;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

    if (typeof src.close === 'function') src.close();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    });
  }

  async function uploadPhoto(file, kind) {
    if (!file) throw new Error('No file selected');
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image');
    if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is too large (max 12 MB)');
    if (kind !== 'school' && kind !== 'current') throw new Error('Invalid photo kind');

    const uid = await currentUserId();
    if (!uid) throw new Error('Not signed in');

    const blob = await compressToSquare(file);
    const path = `${uid}/${kind}.jpg`;

    const { error: upErr } = await client
      .storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000'
      });

    if (upErr) throw upErr;

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function joinRoots({ invite, personal, schoolPhoto, currentPhoto, history }) {
    await ensureAuth();

    const { data, error } = await client.rpc('join_roots', {
      p_invite_code:   String(invite || '').toUpperCase(),
      p_first_name:    personal.first_name,
      p_second_name:   personal.second_name   ?? '',
      p_nickname:      personal.nickname      ?? '',
      p_gender:        personal.gender        ?? null,
      p_birth_day:     personal.birth_day     ?? null,
      p_birth_month:   personal.birth_month   ?? null,
      p_profession:    personal.profession    ?? '',
      p_company:       personal.company       ?? '',
      p_location:      personal.location      ?? '',
      p_whatsapp:      personal.whatsapp      ?? '',
      p_phone_visible: personal.phone_visible ?? false,
      p_school_photo:  schoolPhoto  ?? null,
      p_current_photo: currentPhoto ?? null,
      p_history:       history ?? []
    });

    if (error) throw error;
    return data;
  }

  window.ROOTS = Object.assign(window.ROOTS || {}, {
    client,
    ready: ensureAuth().catch((e) => { console.error('[ROOTS] auth failed', e); return null; }),

    ensureAuth,
    currentUserId,

    getConfig,
    verifyInvite,
    getDirectory,
    getProfile,
    getMyProfile,

    uploadPhoto,
    joinRoots
  });
})();
