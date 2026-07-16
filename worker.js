// This Worker does two jobs:
//   1. Serves the static site (index.html, camos.html, etc.) via the ASSETS
//      binding — same as before, nothing changes for the rest of the site.
//   2. Handles /api/mapfam requests directly, reading/writing images and a
//      shared manifest.json in your R2 bucket, so every visitor sees the
//      same Mapfam gallery.
//
// Because this lives in the same Worker as the site itself, everything
// deploys together through the same GitHub push you're already using — no
// separate Worker project, no `wrangler deploy` from a terminal. The only
// manual steps are in the Cloudflare dashboard (see the setup guide):
// creating the R2 bucket, and adding a binding + a couple of variables to
// THIS Worker project's Settings page.
//
// Expects three things configured on this Worker (via the dashboard, not
// in code — see setup guide):
//   - An R2 bucket binding named MAPFAM_BUCKET
//   - An environment variable MAPFAM_PUBLIC_BASE_URL (the bucket's public URL)
//   - Optionally, a secret UPLOAD_TOKEN (if you want to gate uploads/deletes)

const MANIFEST_KEY = 'mapfam/manifest.json';

async function readManifest(env){
  const obj = await env.MAPFAM_BUCKET.get(MANIFEST_KEY);
  if(!obj) return [];
  try{
    return await obj.json();
  }catch(e){
    return [];
  }
}

async function writeManifest(env, images){
  await env.MAPFAM_BUCKET.put(MANIFEST_KEY, JSON.stringify(images), {
    httpMetadata: { contentType: 'application/json' }
  });
}

function checkToken(request, env){
  if(!env.UPLOAD_TOKEN) return true; // no token configured, skip check
  return request.headers.get('X-Upload-Token') === env.UPLOAD_TOKEN;
}

function jsonResponse(data, status){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleMapfamApi(request, env){
  // ---- GET: anyone can read the current shared image list ----
  if(request.method === 'GET'){
    const images = await readManifest(env);
    return jsonResponse({ images });
  }

  // ---- POST: upload a new image (requires token if one is set) ----
  if(request.method === 'POST'){
    if(!checkToken(request, env)){
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let form;
    try{
      form = await request.formData();
    }catch(e){
      return jsonResponse({ error: 'Expected multipart/form-data' }, 400);
    }

    const file = form.get('file');
    if(!file || typeof file === 'string'){
      return jsonResponse({ error: 'Missing "file" field' }, 400);
    }

    const MAX_BYTES = 8 * 1024 * 1024; // 8MB
    if(file.size > MAX_BYTES){
      return jsonResponse({ error: 'File too large' }, 413);
    }
    if(!file.type || !file.type.startsWith('image/')){
      return jsonResponse({ error: 'Only image uploads are accepted' }, 415);
    }

    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    const key = 'mapfam/' + id + '.' + ext;

    await env.MAPFAM_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const url = env.MAPFAM_PUBLIC_BASE_URL + '/' + key;
    const images = await readManifest(env);
    images.push({ id: id, url: url });
    await writeManifest(env, images);

    return jsonResponse({ images });
  }

  // ---- DELETE: remove an image (requires token if one is set) ----
  if(request.method === 'DELETE'){
    if(!checkToken(request, env)){
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const id = new URL(request.url).searchParams.get('id');
    if(!id){
      return jsonResponse({ error: 'Missing id query param' }, 400);
    }

    const images = await readManifest(env);
    const target = images.find(img => img.id === id);
    const remaining = images.filter(img => img.id !== id);

    if(target){
      const key = target.url.replace(env.MAPFAM_PUBLIC_BASE_URL + '/', '');
      await env.MAPFAM_BUCKET.delete(key);
    }
    await writeManifest(env, remaining);

    return jsonResponse({ images: remaining });
  }

  return new Response('Method not allowed', { status: 405 });
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    if(url.pathname.startsWith('/api/mapfam')){
      return handleMapfamApi(request, env);
    }
    // Everything else — serve the static site as normal.
    return env.ASSETS.fetch(request);
  }
};
