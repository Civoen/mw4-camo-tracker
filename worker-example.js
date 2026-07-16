/**
 * MAPFAM R2 UPLOAD WORKER — starter code, not deployed or tested against a
 * live account. Treat this as a reference to adapt, not a drop-in service.
 *
 * WHAT THIS DOES
 * Accepts a POST with a single "file" field (multipart/form-data — that's
 * what mapfam.js sends), stores it in your R2 bucket, and returns JSON like
 * { "url": "https://<your-public-bucket-domain>/<generated-key>" }.
 * mapfam.js expects exactly that shape back.
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
 *    Public Access → enable, or attach a custom domain) so the returned URL
 *    is actually viewable in <img> tags. Note the public base URL you get
 *    from that step and set PUBLIC_BASE_URL below.
 * 5. Set a shared secret so randoms on the internet can't fill your bucket:
 *      `wrangler secret put UPLOAD_TOKEN`
 *    then have mapfam.js send it — see the fetch() call in mapfam.js's
 *    upload handler, you'll need to add a header there, e.g.:
 *      fetch(MAPFAM_UPLOAD_ENDPOINT, { method:'POST', body:formData,
 *        headers: { 'X-Upload-Token': 'the-same-secret' } })
 *    This is a minimal deterrent, not real auth — anyone who reads your
 *    site's JS can see the token. Fine for a small personal/friend-group
 *    site; not fine if you want this genuinely locked down.
 * 6. `wrangler deploy`, then copy the resulting workers.dev (or custom
 *    domain) URL into MAPFAM_UPLOAD_ENDPOINT at the top of mapfam.js.
 *
 * CORS
 * Your static site (R2/GitHub Pages/wherever) and this Worker are on
 * different origins, so the Worker must answer preflight OPTIONS requests
 * and send Access-Control-Allow-Origin. ALLOWED_ORIGIN below is set to "*"
 * for simplicity — tighten it to your actual site's origin before relying
 * on the UPLOAD_TOKEN check for anything real, since "*" plus a
 * client-visible token is still not strong protection.
 */

const ALLOWED_ORIGIN = '*'; // tighten to e.g. 'https://your-bucket.r2.dev' once live
const PUBLIC_BASE_URL = 'https://REPLACE-WITH-YOUR-PUBLIC-R2-DOMAIN'; // no trailing slash

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Token'
  };
}

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS'){
      return new Response(null, { headers: corsHeaders() });
    }

    if(request.method !== 'POST'){
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    // Minimal shared-secret check — see setup step 5 above.
    if(env.UPLOAD_TOKEN){
      const token = request.headers.get('X-Upload-Token');
      if(token !== env.UPLOAD_TOKEN){
        return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
      }
    }

    let form;
    try{
      form = await request.formData();
    }catch(e){
      return new Response('Expected multipart/form-data', { status: 400, headers: corsHeaders() });
    }

    const file = form.get('file');
    if(!file || typeof file === 'string'){
      return new Response('Missing "file" field', { status: 400, headers: corsHeaders() });
    }

    // Basic guardrails — adjust to taste.
    const MAX_BYTES = 8 * 1024 * 1024; // 8MB
    if(file.size > MAX_BYTES){
      return new Response('File too large', { status: 413, headers: corsHeaders() });
    }
    if(!file.type || !file.type.startsWith('image/')){
      return new Response('Only image uploads are accepted', { status: 415, headers: corsHeaders() });
    }

    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
    const key = 'mapfam/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;

    await env.MAPFAM_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const url = PUBLIC_BASE_URL + '/' + key;

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
    });
  }
};
