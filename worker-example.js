/**
 * MAPFAM R2 UPLOAD + SHARED MANIFEST WORKER — starter code, not deployed or
 * tested against a live account. Treat this as a reference to adapt, not a
 * drop-in service.
 *
 * WHY THIS EXISTS
 * A static site (no server) has nowhere to keep a shared "list of images"
 * that every visitor sees — each browser's localStorage is private to that
 * browser. To make an uploaded image visible to everyone, something with a
 * server has to hold the shared list. That's what this Worker does: it
 * stores each image in R2 AND keeps a manifest.json (also in R2) listing
 * every image that's been uploaded. mapfam.js reads that manifest on page
 * load instead of relying on localStorage, so every visitor sees the same
 * gallery.
 *
 * ENDPOINTS
 *   GET  /            → returns the current manifest: { images: [{id, url}] }
 *   POST /  (file=...) → uploads an image, adds it to the manifest, returns
 *                         the updated manifest
 *   DELETE /?id=<id>   → removes an image from R2 and the manifest
 *
 * mapfam.js expects exactly these shapes back.
 *
 * SETUP (Wrangler CLI)
 * 1. `npm create cloudflare@latest` or `wrangler init` to scaffold a Worker,
 *    then replace its entry file with this one (or adapt into yours).
 * 2. Create the bucket if you haven't: `wrangler r2 bucket create mapfam-images`
 * 3. Add an R2 binding in wrangler.toml:
 *
 *      [[r2_buckets]]
 *      binding = "MAPFAM_BUCKET"
 *      bucket_name = "mapfam-images"
 *
 * 4. Give the bucket public read access (R2 dashboard → bucket → Settings →
 *    Public Access → enable, or attach a custom domain) so uploaded images
 *    are actually viewable in <img> tags. Note the public base URL you get
 *    from that step and set PUBLIC_BASE_URL below.
 * 5. Set a shared secret so randoms on the internet can't add/delete images:
 *      `wrangler secret put UPLOAD_TOKEN`
 *    mapfam.js needs to send this on every POST/DELETE — see the fetch()
 *    calls in mapfam.js, they read MAPFAM_UPLOAD_TOKEN and attach it as an
 *    X-Upload-Token header automatically once you set that constant.
 *    This is a minimal deterrent, not real auth — anyone who reads your
 *    site's JS can see the token. Fine for a small personal/friend-group
 *    site; not fine if you want this genuinely locked down. GET requests
 *    (viewing images) are NOT gated by the token — anyone can view.
 * 6. `wrangler deploy`, then copy the resulting workers.dev (or custom
 *    domain) URL into MAPFAM_UPLOAD_ENDPOINT at the top of mapfam.js.
 *
 * CORS
 * Your static site and this Worker are on different origins, so the Worker
 * must answer preflight OPTIONS requests and send Access-Control-Allow-
 * Origin. ALLOWED_ORIGIN below is set to "*" for simplicity — tighten it to
 * your actual site's origin before relying on the UPLOAD_TOKEN check for
 * anything real, since "*" plus a client-visible token is still not strong
 * protection.
 */

const ALLOWED_ORIGIN = '*'; // tighten to e.g. 'https://your-site.workers.dev' once live
const PUBLIC_BASE_URL = 'https://REPLACE-WITH-YOUR-PUBLIC-R2-DOMAIN'; // no trailing slash
const MANIFEST_KEY = 'mapfam/manifest.json';

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Token'
  };
}

function jsonResponse(data, status){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
  });
}

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

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS'){
      return new Response(null, { headers: corsHeaders() });
    }

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

      const url = PUBLIC_BASE_URL + '/' + key;
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
        const key = target.url.replace(PUBLIC_BASE_URL + '/', '');
        await env.MAPFAM_BUCKET.delete(key);
      }
      await writeManifest(env, remaining);

      return jsonResponse({ images: remaining });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }
};
