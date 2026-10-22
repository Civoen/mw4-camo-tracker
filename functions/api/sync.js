// Cloudflare Pages Function — short sync codes (e.g. STEAK-0218).
// Lives at /api/sync. Uses the same R2 bucket binding as Mapfam
// (MAPFAM_BUCKET), so there's nothing new to set up in the dashboard.
//
// A code is a SNAPSHOT: "Create Code" saves a copy of one device's tracker
// data under a fresh code, and loading that code on another device copies
// the snapshot into that device's own storage. Nothing is linked or shared
// afterwards, so everyone keeps tracking their own progress on their own
// devices; a code only ever changes the device it's entered on.
//
// Storage layout in the bucket:
//   sync/{CODE}.json   <- { v, createdAt, data }
//
// Snapshots older than CODE_TTL_DAYS are refused (and deleted when someone
// tries one). Optional tidy-up: add an R2 lifecycle rule in the Cloudflare
// dashboard to delete objects with prefix "sync/" after 30 days.
//
// API:
//   POST /api/sync            body: { data: {...} } -> { code, expiresAt }
//   GET  /api/sync?code=X                            -> { data, createdAt, expiresAt }

const PREFIX = 'sync/';
const CODE_TTL_DAYS = 30;
const MAX_BYTES = 64 * 1024; // a full tracker snapshot is a few KB

// Short, distinct, easy-to-say words. 200 words x 10,000 numbers gives two
// million codes, so with a few dozen people collisions are effectively
// impossible (and are retried anyway).
const WORDS = [
  'ACORN','ALPHA','AMBER','ANCHOR','APPLE','ARROW','ASPEN','ATLAS','BACON','BADGE',
  'BAGEL','BANJO','BARON','BASIL','BEACON','BEAR','BISON','BLADE','BLAZE','BOLT',
  'BRAVO','BRICK','BUCKET','BUNKER','CABIN','CACTUS','CAMEL','CANDLE','CANYON','CARGO',
  'CEDAR','CHALK','CHARM','CHERRY','CHILI','CINDER','CLOVER','COBALT','COBRA','COMET',
  'CONDOR','CORAL','COYOTE','CRANE','CRATER','CREEK','CROWN','CYCLONE','DAGGER','DELTA',
  'DESERT','DIESEL','DINGO','DONUT','DRAGON','DRIFT','EAGLE','ECHO','EMBER','FALCON',
  'FERRET','FIG','FLARE','FLINT','FOREST','FOX','FROST','GALAXY','GECKO','GHOST',
  'GINGER','GLACIER','GOBLIN','GRAVEL','GRIZZLY','HAMMER','HARBOR','HAWK','HAZEL','HERON',
  'HONEY','HORNET','HUSKY','IGLOO','IRON','JACKAL','JAGUAR','JASPER','JELLY','JET',
  'JUNGLE','KAYAK','KETTLE','KIWI','KNIGHT','KOALA','LAGOON','LANCE','LANTERN','LASER',
  'LEMON','LEOPARD','LIMA','LOBSTER','LOTUS','LYNX','MAGNET','MANGO','MAPLE','MARBLE',
  'MEADOW','MESA','METEOR','MINT','MOOSE','MORTAR','NACHO','NEON','NOMAD','NOVA',
  'NUTMEG','OASIS','OCELOT','OLIVE','ONYX','ORBIT','OSPREY','OTTER','PANDA','PAPRIKA',
  'PEBBLE','PEPPER','PICKLE','PILOT','PIRATE','PIXEL','PLASMA','PRAWN','PUMA','QUARTZ',
  'RADAR','RAPTOR','RAVEN','REBEL','RIDGE','ROCKET','ROGUE','SABER','SALMON','SAPPHIRE',
  'SCOUT','SHADOW','SHARK','SIERRA','SIGNAL','SPARROW','SPHINX','SPRUCE','STEAK','STORM',
  'SUMMIT','TACO','TALON','TANGO','THUNDER','TIGER','TOAST','TOPAZ','TORCH','TUNDRA',
  'TURBO','VALLEY','VAPOR','VECTOR','VIPER','VOLCANO','WAFFLE','WALRUS','WASABI','WHISKER',
  'WIDGET','WILLOW','WOLF','WOMBAT','YETI','ZEBRA','ZENITH','ZEPHYR','ZIPPER','ZULU',
  'BLIZZARD','BREEZE','BRONZE','CASTLE','CIRCUIT','FROSTY','HURRICANE','PUFFIN','RHINO','TOFU'
];

function json(data, status){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// "steak 0218", "Steak-218", "STEAK0218" -> "STEAK-0218" (or null)
function normalizeCode(raw){
  const m = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]+)(\d{1,4})$/);
  if(!m) return null;
  return m[1] + '-' + m[2].padStart(4, '0');
}

function randomCode(){
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return WORDS[buf[0] % WORDS.length] + '-' + String(buf[1] % 10000).padStart(4, '0');
}

function expiresAt(createdAt){
  return createdAt + CODE_TTL_DAYS * 86400000;
}

// ---- POST: save a snapshot, return its new code ----
export async function onRequestPost(context){
  const { request, env } = context;
  const text = await request.text();
  if(text.length > MAX_BYTES) return json({ error: 'Snapshot too large' }, 413);

  let body;
  try{ body = JSON.parse(text); }catch(e){ return json({ error: 'Expected JSON' }, 400); }
  const data = body && body.data;
  if(!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Missing data' }, 400);
  // Only tracker keys, only string values (exactly what localStorage holds).
  const clean = {};
  for(const k of Object.keys(data)){
    if(k.indexOf('mw4camo-') === 0 && typeof data[k] === 'string') clean[k] = data[k];
  }
  if(!Object.keys(clean).length) return json({ error: 'Nothing to save' }, 400);

  let code = null;
  for(let i = 0; i < 8; i++){
    const candidate = randomCode();
    if(!(await env.MAPFAM_BUCKET.head(PREFIX + candidate + '.json'))){ code = candidate; break; }
  }
  if(!code) return json({ error: 'Could not create a code, try again' }, 503);

  const createdAt = Date.now();
  await env.MAPFAM_BUCKET.put(PREFIX + code + '.json', JSON.stringify({ v: 1, createdAt: createdAt, data: clean }), {
    httpMetadata: { contentType: 'application/json' }
  });
  return json({ code: code, expiresAt: expiresAt(createdAt) });
}

// ---- GET: fetch a snapshot by code ----
export async function onRequestGet(context){
  const { request, env } = context;
  const code = normalizeCode(new URL(request.url).searchParams.get('code'));
  if(!code) return json({ error: 'That doesn’t look like a code. They look like STEAK-0218.' }, 400);

  const obj = await env.MAPFAM_BUCKET.get(PREFIX + code + '.json');
  if(!obj) return json({ error: 'No progress found for ' + code + '. Check the code, or create a new one.' }, 404);

  let snap;
  try{ snap = await obj.json(); }catch(e){ return json({ error: 'That snapshot is damaged. Create a new code.' }, 500); }
  if(Date.now() > expiresAt(snap.createdAt || 0)){
    await env.MAPFAM_BUCKET.delete(PREFIX + code + '.json');
    return json({ error: code + ' has expired (codes last ' + CODE_TTL_DAYS + ' days). Create a new one.' }, 410);
  }
  return json({ code: code, data: snap.data, createdAt: snap.createdAt, expiresAt: expiresAt(snap.createdAt) });
}
