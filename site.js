// Runs on every page load so the eyebrow badge, mode accent, and any other
// mode-aware styling stay correct regardless of which page you land on.
applyModeAccent();

// ---- Motion ----
// The site is often open alongside the game, so every animation here is a
// one-off reaction to something the user did (or a single play on load):
// nothing loops, and only transform/opacity/colour are animated. With the
// OS "reduce motion" setting on, CSS strips the animations (see site.css)
// and the JS-driven ones below skip themselves.
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// Runs fn after the browser has painted the current state, so a CSS
// transition sees a real "before" value to animate from.
function afterPaint(fn){
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// Counts an element's leading "NN%" text up from 0 once (homepage headline).
function countUpPercent(el, target, duration){
  if(!el || !el.firstChild || REDUCED_MOTION || target <= 0) return;
  const node = el.firstChild;
  const ms = duration || 600;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = Math.round(target * eased) + '%';
    if(t < 1) requestAnimationFrame(step);
  }
  node.textContent = '0%';
  requestAnimationFrame(step);
}

// Plays the mastery sweep once per milestone: the first time a tile shows
// as 100%. Dropping below 100% re-arms it.
const CELEBRATED_KEY = 'mw4camo-celebrated';
function celebrateNewMilestones(tileEls){
  let seen = [];
  try{ seen = JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]'); }catch(e){}
  const next = [];
  tileEls.forEach(el => {
    const id = el.getAttribute('data-tile');
    if(!el.classList.contains('maxed')) return;
    next.push(id);
    if(!seen.includes(id)) el.classList.add('mastery-sweep');
  });
  try{ localStorage.setItem(CELEBRATED_KEY, JSON.stringify(next)); }catch(e){}
}

// ---- Shared progress helpers ----
function loadCamoProgress(){
  try{
    const raw = localStorage.getItem('mw4camo-progress');
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}

function saveCamoProgress(progress){
  try{ localStorage.setItem('mw4camo-progress', JSON.stringify(progress)); }catch(e){}
}

// A weapon counts as "mastered" once every tier in CAMO_TIERS is checked.
// Tiers are data-driven (see data.js), so this keeps working unchanged if
// the tier list changes size when MW4's real camo system is announced.
function isWeaponMastered(name, progress){
  const p = progress[name] || {};
  return CAMO_TIERS.every(t => p[t.key]);
}

// The color of the highest tier THIS weapon has earned so far (gold as
// soon as Gold is checked, moving up through platinum/onyx/nova as it
// progresses). Returns null if nothing's been earned yet.
function highestOwnTierColor(name, progress){
  const p = progress[name] || {};
  let color = null;
  CAMO_TIERS.forEach(t => { if(p[t.key]) color = t.color; });
  return color;
}

// True once every weapon in `weaponsArr` has tier `tierKey` checked.
function tierCompleteForWeapons(weaponsArr, tierKey, progress){
  return weaponsArr.length > 0 && weaponsArr.every(w => (progress[w.name] || {})[tierKey]);
}

// The color of the highest tier that's fully complete across every weapon
// in `weaponsArr` (used to recolor a class tile once, say, all Gold is in).
// Returns null if not even the first tier is fully complete yet.
function highestCompleteTierColor(weaponsArr, progress){
  let color = null;
  for(let i = 0; i < CAMO_TIERS.length; i++){
    if(tierCompleteForWeapons(weaponsArr, CAMO_TIERS[i].key, progress)) color = CAMO_TIERS[i].color;
    else break;
  }
  return color;
}

// Whether a given tier is unlocked for a specific weapon right now: it
// needs the tier before it on this weapon, plus whatever the tier's `gate`
// asks for on other weapons (see CAMO_TIERS in data.js).
function tierUnlocked(weapon, tierIndex, progress){
  return !tierLockReason(weapon, tierIndex, progress);
}

// Why a tier is locked (shown as a tooltip), or '' if it's unlocked.
function tierLockReason(weapon, tierIndex, progress){
  if(tierIndex === 0) return '';
  const tier = CAMO_TIERS[tierIndex];
  const prev = CAMO_TIERS[tierIndex - 1];
  if(!(progress[weapon.name] || {})[prev.key]) return 'Needs ' + prev.label + ' first';
  if(!tier.gate) return '';
  const pool = tier.gate === 'all' ? WEAPONS : WEAPONS.filter(w => w.class === weapon.class);
  const done = pool.filter(w => (progress[w.name] || {})[prev.key]).length;
  if(done < pool.length){
    const scope = tier.gate === 'all' ? 'all weapons' : 'every ' + classLabel(weapon.class).replace(/s$/, '');
    return 'Needs ' + prev.label + ' on ' + scope + ' (' + done + '/' + pool.length + ')';
  }
  return '';
}

// What's holding a class back: the lowest tier not yet earned on every
// weapon in it, and which weapons are missing it. With class gating that
// tier is what stops the next one unlocking anywhere in the class.
// Returns null when the whole class is complete.
function classBlocker(cls, progress){
  const weapons = WEAPONS.filter(w => w.class === cls);
  for(let i = 0; i < CAMO_TIERS.length; i++){
    const missing = weapons.filter(w => !(progress[w.name] || {})[CAMO_TIERS[i].key]);
    // A tier gated on ALL weapons can be held up by other classes: report
    // that (once, as a game-wide row) rather than this class's own gaps.
    if(missing.length && i > 0 && CAMO_TIERS[i].gate === 'all'){
      const prev = CAMO_TIERS[i - 1];
      const globalMissing = WEAPONS.filter(w => !(progress[w.name] || {})[prev.key]);
      if(globalMissing.length){
        return { global: true, tier: prev, unlocks: CAMO_TIERS[i].label, missing: globalMissing };
      }
    }
    if(missing.length){
      return {
        tier: CAMO_TIERS[i],
        unlocks: i < CAMO_TIERS.length - 1 ? CAMO_TIERS[i + 1].label : DIVERGENCE.label,
        missing: missing
      };
    }
  }
  return null;
}

function nextTierLabel(name){
  const progress = loadCamoProgress();
  const p = progress[name] || {};
  const next = CAMO_TIERS.find(t => !p[t.key]);
  if(!next) return 'All tiers complete';
  const hint = tierHint(next, weaponLookup(name));
  return 'Next: ' + next.label + (hint ? ' (' + hint + ')' : '');
}

// Checks the next available tier for a weapon (used by the "Next Camo"
// button in the Grind List). Uses the same tierUnlocked() rule as the
// checklist on the Camo Tracker page. No-ops if the next tier is locked or
// the weapon is already fully mastered.
function advanceNextTier(name){
  const weapon = weaponLookup(name);
  const progress = loadCamoProgress();
  const p = progress[name] || {};
  const nextIndex = CAMO_TIERS.findIndex(t => !p[t.key]);
  if(nextIndex === -1) return; // already fully mastered
  if(!tierUnlocked(weapon, nextIndex, progress)) return; // locked (see tierLockReason)
  if(!progress[name]) progress[name] = {};
  progress[name][CAMO_TIERS[nextIndex].key] = true;
  saveCamoProgress(progress);
  logCamoChange(name, CAMO_TIERS[nextIndex].key);
  renderGrindList();
  document.dispatchEvent(new CustomEvent('grindlist:changed'));
}

// ---- Recent activity log ----
// A simple feed of every tier earned, most recent first, shown on
// recent.html. Capped so localStorage doesn't grow without bound.
const RECENT_LOG_KEY = 'mw4camo-recent';
const RECENT_LOG_LIMIT = 200;

// ---- Undo toast ----
// Shared by any "remove" action on the site. The actual destructive step
// (saving to storage, or in Mapfam's shared mode, calling the delete API)
// is deferred until the toast times out — so if the user hits Undo in time,
// nothing was ever actually thrown away, not even server-side.
let _undoToastEl = null;
let _undoToastTimer = null;

function showUndoToast(message, onCommit, onUndo){
  if(_undoToastEl){
    clearTimeout(_undoToastTimer);
    if(_undoToastEl._onCommit) _undoToastEl._onCommit(); // finalize whatever was already pending
    _undoToastEl.remove();
    _undoToastEl = null;
  }
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = '<span class="undo-toast-msg"></span><button class="undo-toast-btn" type="button">Undo</button>';
  toast.querySelector('.undo-toast-msg').textContent = message;
  document.body.appendChild(toast);
  toast._onCommit = onCommit;
  _undoToastEl = toast;

  toast.querySelector('.undo-toast-btn').addEventListener('click', () => {
    clearTimeout(_undoToastTimer);
    onUndo();
    toast.remove();
    _undoToastEl = null;
  });

  requestAnimationFrame(() => toast.classList.add('open'));
  _undoToastTimer = setTimeout(() => {
    onCommit();
    toast.classList.remove('open');
    setTimeout(() => toast.remove(), 200);
    _undoToastEl = null;
  }, 6000);
}

function loadRecentLog(){
  try{
    const raw = localStorage.getItem(RECENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}

function saveRecentLog(list){
  try{ localStorage.setItem(RECENT_LOG_KEY, JSON.stringify(list)); }catch(e){}
}

function logCamoChange(weaponName, tierKey){
  const w = weaponLookup(weaponName);
  const tier = CAMO_TIERS.find(t => t.key === tierKey);
  if(!tier) return;
  const log = loadRecentLog();
  log.unshift({ name: w.name, class: w.class, tierKey: tier.key, tierLabel: tier.label, ts: Date.now() });
  saveRecentLog(log.slice(0, RECENT_LOG_LIMIT));
}

function formatRelativeTime(ts){
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if(diffSec < 5) return 'Just now';
  if(diffSec < 60) return diffSec + 's ago';
  const diffMin = Math.round(diffSec / 60);
  if(diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.round(diffMin / 60);
  if(diffHr < 24) return diffHr + 'h ago';
  const diffDay = Math.round(diffHr / 24);
  if(diffDay < 7) return diffDay + 'd ago';
  return new Date(ts).toLocaleDateString();
}

// Renders the recent-activity feed on recent.html.
// Renders the recent-activity feed on recent.html. Rows are clickable
// (jump to that weapon's class on the Camo Tracker page); each has its own
// remove button, plus a page-level "Clear All" wired up separately.
// Renders a given log array (doesn't touch storage — used both for the
// normal load and for optimistically showing a pending removal before it's
// actually committed).
function renderRecentRows(containerId, log){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = log.length
    ? log.map((entry, i) =>
        '<div class="recent-row" data-index="'+i+'" data-class="'+entry.class+'" role="button" tabindex="0">' +
          '<span class="recent-dot" style="background:'+(entry.color || (CAMO_TIERS.find(t => t.key === entry.tierKey) || {}).color)+'"></span>' +
          '<span class="recent-main">' +
            '<span class="recent-weapon">'+entry.name+'</span>' +
            '<span class="recent-class">'+entry.class+'</span>' +
          '</span>' +
          '<span class="recent-tier">'+entry.tierLabel+'</span>' +
          '<span class="recent-time">'+formatRelativeTime(entry.ts)+'</span>' +
          '<button class="recent-remove" data-index="'+i+'" type="button" aria-label="Remove entry">&times;</button>' +
        '</div>'
      ).join('')
    : '<div class="empty-note">No camo activity yet. Check off a tier on the Camo Tracker page to see it here.</div>';

  el.querySelectorAll('.recent-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const currentLog = loadRecentLog();
      const removed = currentLog[idx];
      const remaining = currentLog.slice(0, idx).concat(currentLog.slice(idx + 1));
      renderRecentRows(containerId, remaining); // optimistic — nothing saved yet
      showUndoToast(
        'Removed "' + removed.name + ' \u00b7 ' + removed.tierLabel + '"',
        () => saveRecentLog(remaining),        // commit: only now actually saved
        () => renderRecentList(containerId)     // undo: re-render from untouched storage
      );
    });
  });
  el.querySelectorAll('.recent-row').forEach(row => {
    row.addEventListener('click', () => {
      window.location.href = 'camos.html?class=' + encodeURIComponent(row.getAttribute('data-class'));
    });
    row.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); row.click(); }
    });
  });
}

function renderRecentList(containerId){
  renderRecentRows(containerId, loadRecentLog());
}

// Wires up the "Clear All" button on recent.html.
function initRecentClearAll(buttonId, listContainerId){
  const btn = document.getElementById(buttonId);
  if(!btn) return;
  btn.addEventListener('click', () => {
    const currentLog = loadRecentLog();
    if(!currentLog.length) return;
    renderRecentRows(listContainerId, []); // optimistic — nothing saved yet
    showUndoToast(
      'Cleared ' + currentLog.length + ' entr' + (currentLog.length === 1 ? 'y' : 'ies'),
      () => saveRecentLog([]),
      () => renderRecentList(listContainerId)
    );
  });
}

// ---- Grind List (pinned weapons currently being worked on) ----
const GRIND_LIST_KEY = 'mw4camo-grindlist';

function loadGrindList(){
  try{
    const raw = localStorage.getItem(GRIND_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}

function saveGrindList(list){
  try{ localStorage.setItem(GRIND_LIST_KEY, JSON.stringify(list)); }catch(e){}
}

let grindList = loadGrindList();

const grindListEl = document.getElementById('grindList');
const grindListToggle = document.getElementById('grindListToggle');
const grindListFullscreen = document.getElementById('grindListFullscreen');
const grindListPanel = document.getElementById('grindListPanel');
const grindListCount = document.getElementById('grindListCount');

function weaponLookup(name){
  return WEAPONS.find(w => w.name === name) || { name: name, class: '' };
}

// ---- Full Screen mode (identical behavior to Easy Tarkov's "Infil") ----
// Takes over the whole viewport: the page's own content is hidden (via a
// body class) and the Grind List panel fills the space instead, scaling
// item text based on how much room each pinned weapon gets.
function applyFullscreenSizing(){
  if(!grindListEl.classList.contains('fullscreen')) return;
  const barHeight = grindListEl.querySelector('.grind-list-bar').getBoundingClientRect().height;
  const panelHeight = Math.max(200, window.innerHeight - barHeight);
  grindListPanel.style.height = panelHeight + 'px';

  const budget = panelHeight / Math.max(1, grindList.length);
  grindListEl.classList.remove('fs-lg', 'fs-md', 'fs-sm');
  grindListEl.classList.add(budget >= 90 ? 'fs-lg' : budget >= 60 ? 'fs-md' : 'fs-sm');
}

function renderGrindList(){
  if(!grindListEl) return;
  applyFullscreenSizing();
  const progress = loadCamoProgress();
  grindListCount.textContent = grindList.length;
  grindListPanel.innerHTML = grindList.length
    ? grindList.map(name => {
        const w = weaponLookup(name);
        const mastered = isWeaponMastered(name, progress);
        const p = progress[name] || {};
        const nextIndex = CAMO_TIERS.findIndex(t => !p[t.key]);
        const unlocked = nextIndex !== -1 && tierUnlocked(w, nextIndex, progress);
        const nextBtnHtml = mastered
          ? ''
          : '<button class="grind-item-next" data-name="'+name+'" type="button"'+(unlocked ? '' : ' disabled title="'+tierLockReason(w, nextIndex, progress)+'"')+'>Next Camo</button>';
        return '<div class="grind-item" data-name="'+name+'">' +
          '<span><span class="grind-item-name">'+w.name+'</span><br>' +
          '<span class="grind-item-sub">'+w.class+' &middot; '+nextTierLabel(name)+'</span></span>' +
          '<span class="grind-item-actions">' +
            '<a class="grind-item-view" href="camos.html?class='+encodeURIComponent(w.class)+'">View Class</a>' +
            nextBtnHtml +
            '<button class="grind-item-remove" data-name="'+name+'" type="button">Remove</button>' +
          '</span>' +
        '</div>';
      }).join('')
    : '<div class="grind-list-empty">No weapons pinned. Click any weapon on the Camo Tracker page to pin it here.</div>';
}

if(grindListEl){
  grindListToggle.addEventListener('click', () => grindListEl.classList.toggle('open'));
  grindListToggle.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); grindListEl.classList.toggle('open'); }
  });
  grindListCount.addEventListener('click', (e) => {
    e.stopPropagation();
    if(!grindList.length) return;
    grindList = [];
    saveGrindList(grindList);
    renderGrindList();
    document.dispatchEvent(new CustomEvent('grindlist:changed'));
  });
  if(grindListFullscreen){
    grindListFullscreen.addEventListener('click', (e) => {
      e.stopPropagation();
      const active = grindListEl.classList.toggle('fullscreen');
      document.body.classList.toggle('grindlist-fullscreen', active);
      if(active){
        grindListEl.classList.add('open');
      }else{
        // Minimise returns to the square popup (still open), not fully closed.
        grindListEl.classList.remove('fs-lg', 'fs-md', 'fs-sm');
        grindListPanel.style.height = '';
      }
      grindListFullscreen.textContent = active ? 'Minimise' : 'Full Screen';
      renderGrindList();
    });
  }
  grindListPanel.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.grind-item-remove');
    if(removeBtn){
      const name = removeBtn.getAttribute('data-name');
      grindList = grindList.filter(n => n !== name);
      saveGrindList(grindList);
      renderGrindList();
      document.dispatchEvent(new CustomEvent('grindlist:changed'));
      return;
    }
    const nextBtn = e.target.closest('.grind-item-next');
    if(nextBtn){
      advanceNextTier(nextBtn.getAttribute('data-name'));
      return;
    }
  });
  renderGrindList();
  window.addEventListener('resize', applyFullscreenSizing);
}

// Pins/unpins a weapon into the Grind List. Fires an event so any checklist
// on the page can refresh its own "pinned" indicators without a hard reload.
function togglePin(name){
  if(grindList.includes(name)){
    grindList = grindList.filter(n => n !== name);
  }else{
    grindList.push(name);
  }
  saveGrindList(grindList);
  renderGrindList();
  document.dispatchEvent(new CustomEvent('grindlist:changed'));
}

// ---- Mobile nav menu ----
const topbarRightEl = document.querySelector('.topbar-right');
if(topbarRightEl){
  const mobileMenuWrap = document.createElement('div');
  mobileMenuWrap.className = 'mobile-menu-wrap';

  const mobileMenuBtn = document.createElement('button');
  mobileMenuBtn.type = 'button';
  mobileMenuBtn.className = 'mobile-menu-btn';
  mobileMenuBtn.setAttribute('aria-label', 'Open navigation menu');
  mobileMenuBtn.textContent = '\u2630 Menu';

  const mobileMenuPanel = document.createElement('div');
  mobileMenuPanel.className = 'mobile-menu-panel';

  const staticLinks = [
    { name: 'Home', url: 'index.html' },
    { name: 'Camo Tracker', url: 'camos.html' },
    { name: 'Stats', url: 'stats.html' },
    { name: 'Recent', url: 'recent.html' },
    { name: 'Mapfam', url: 'mapfam.html' },
    { name: 'Manage Data', url: 'import.html', danger: true }
  ];

  mobileMenuPanel.innerHTML = staticLinks.map(l => '<a href="'+l.url+'"'+(l.danger ? ' class="mobile-menu-danger"' : '')+'>'+l.name+'</a>').join('');

  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mobileMenuPanel.classList.toggle('open');
  });

  mobileMenuWrap.appendChild(mobileMenuBtn);
  mobileMenuWrap.appendChild(mobileMenuPanel);
  topbarRightEl.appendChild(mobileMenuWrap);

  document.addEventListener('click', (e) => {
    if(!e.target.closest('.mobile-menu-wrap')) mobileMenuPanel.classList.remove('open');
  });
}

// ---- Keyboard shortcut: Esc closes open panels ----
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && grindListEl) grindListEl.classList.remove('open');
});

// ---- Homepage: weapon class summary tiles ----
// Renders one tile per class (e.g. "Assault Rifles 2/7") linking into the
// Camo Tracker pre-filtered to that class, plus an "All Weapons" tile.
// Homepage search: live dropdown of matching weapons, each linking into
// the Camo Tracker pre-filtered to that weapon's class with the search
// term carried over (?class=X&search=Y), so the same result is highlighted
// there instead of just dumping the visitor on an unfiltered page.
function initHomeWeaponSearch(inputId, resultsId){
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if(!input || !results) return;

  function renderResults(query){
    const q = query.trim().toLowerCase();
    if(!q){ results.classList.remove('open'); results.innerHTML = ''; return; }
    const matches = WEAPONS.filter(w => w.name.toLowerCase().includes(q)).slice(0, 8);
    results.innerHTML = matches.length
      ? matches.map(w =>
          '<div class="home-search-row" data-name="'+w.name+'" data-class="'+w.class+'">' +
            '<span class="home-search-name">'+w.name+'</span>' +
            '<span class="home-search-class">'+w.class+'</span>' +
          '</div>'
        ).join('')
      : '<div class="home-search-empty">No weapons found</div>';
    results.classList.add('open');
  }

  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('focus', () => renderResults(input.value));
  results.addEventListener('click', (e) => {
    const row = e.target.closest('.home-search-row');
    if(!row) return;
    const cls = row.getAttribute('data-class');
    const name = row.getAttribute('data-name');
    window.location.href = 'camos.html?class=' + encodeURIComponent(cls) + '&search=' + encodeURIComponent(name);
  });
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.home-search-wrap')) results.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') results.classList.remove('open');
  });
}

// ---- Live refresh (mode switches + other tabs) ----
// Pages register a refresh callback with onDataSync(). It runs when the
// mode changes (no page reload needed: weapon progress is shared, so only
// mode-specific bits like the Mastery panel actually change) and whenever
// another tab/window saves tracker data, so a stale tab never shows, or
// worse saves over, newer progress.
const _syncHandlers = [];
function onDataSync(fn){ _syncHandlers.push(fn); }
function runDataSync(){
  _syncHandlers.forEach(fn => { try{ fn(); }catch(e){ console.error(e); } });
}

function changeMode(modeKey){
  if(modeKey === getCurrentMode()) return;
  setCurrentMode(modeKey);
  applyModeAccent();
  runDataSync();
}

window.addEventListener('storage', (e) => {
  if(e.key !== null && e.key.indexOf('mw4camo-') !== 0) return;
  if(e.key === null || e.key === MODE_KEY_STORAGE) applyModeAccent();
  if(grindListEl){
    grindList = loadGrindList();
    renderGrindList();
  }
  runDataSync();
});

// Full 3-pill switcher, used on the homepage.
function renderModeSwitcher(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  function draw(){
    const current = getCurrentMode();
    el.innerHTML = MODES.map(m =>
      '<button class="mode-pill'+(m.key === current ? ' active' : '')+'" data-mode="'+m.key+'" type="button" style="--pill-accent:'+m.accent+'">'+m.label+'</button>'
    ).join('');
  }
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-pill');
    if(btn) changeMode(btn.getAttribute('data-mode'));
  });
  onDataSync(draw);
  draw();
}

// Compact dropdown version for the nav bar on every other page, so you can
// switch modes without needing to go back to the homepage first.
function renderNavModeSwitcher(wrapId){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;
  function draw(){
    const current = getCurrentMode();
    wrap.innerHTML =
      '<button class="nav-mode-btn" type="button">'+getModeInfo(current).label+' <span class="nav-mode-caret">&#9662;</span></button>' +
      '<div class="nav-mode-menu">' +
        MODES.map(m =>
          '<button class="nav-mode-option'+(m.key === current ? ' active' : '')+'" data-mode="'+m.key+'" type="button" style="--pill-accent:'+m.accent+'">'+m.label+'</button>'
        ).join('') +
      '</div>';
  }
  wrap.addEventListener('click', (e) => {
    const menu = wrap.querySelector('.nav-mode-menu');
    const opt = e.target.closest('.nav-mode-option');
    if(opt){
      menu.classList.remove('open');
      changeMode(opt.getAttribute('data-mode'));
      return;
    }
    if(e.target.closest('.nav-mode-btn')){
      e.stopPropagation();
      menu.classList.toggle('open');
    }
  });
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.nav-mode-switcher')){
      const menu = wrap.querySelector('.nav-mode-menu');
      if(menu) menu.classList.remove('open');
    }
  });
  onDataSync(draw);
  draw();
}

function renderClassSummary(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const progress = loadCamoProgress();

  function tile(label, count, total, href, weaponsInScope){
    const maxed = total > 0 && count === total;
    const color = highestCompleteTierColor(weaponsInScope, progress);
    const styleAttr = (!maxed && color) ? ' style="--tile-border:' + color + '"' : '';
    return '<a class="class-tile'+(maxed ? ' maxed' : '')+'" data-tile="'+label+'" href="'+href+'"'+styleAttr+'>' +
      '<span class="card-inner">' +
        '<span class="class-tile-name">'+label+'</span>' +
        '<span class="class-tile-count">'+count+'/'+total+'</span>' +
      '</span>' +
    '</a>';
  }

  const allDone = WEAPONS.filter(w => isWeaponMastered(w.name, progress)).length;
  let html = tile('All Weapons', allDone, WEAPONS.length, 'camos.html', WEAPONS);

  WEAPON_CLASSES.forEach(cls => {
    const weapons = WEAPONS.filter(w => w.class === cls);
    const done = weapons.filter(w => isWeaponMastered(w.name, progress)).length;
    html += tile(classLabel(cls), done, weapons.length, 'camos.html?class=' + encodeURIComponent(cls), weapons);
  });

  el.innerHTML = html;
  celebrateNewMilestones(el.querySelectorAll('.class-tile'));
}

// ---- Camo checklist renderer (per-weapon, sequential/class-gated tiers) ----
// config = { listElId, classFilterId, filterEmptyId }
function initCamoChecklist(config){
  const listEl = document.getElementById(config.listElId);
  let progress = loadCamoProgress();
  const prevBarPct = {}; // last drawn % per tier, so bars glide between values

  // The grid is rebuilt on every change, so the changed card is a brand new
  // element. These effects start it from its old look and let CSS animate
  // to the new one: swatch pop on tick, outline colour fade, and a single
  // sweep when the weapon's final camo lands.
  function animateCardChange(name, tierKey, checked, oldColor){
    if(REDUCED_MOTION) return;
    const card = [...listEl.querySelectorAll('.weapon-card')].find(c => c.getAttribute('data-name') === name);
    if(!card) return;
    if(checked){
      const input = card.querySelector('input[data-tier="' + tierKey + '"]');
      const chip = input && input.nextElementSibling;
      if(chip) chip.classList.add('chip-pop');
      if(tierKey === CAMO_TIERS[CAMO_TIERS.length - 1].key) card.classList.add('mastery-sweep');
    }
    const newColor = card.style.getPropertyValue('--card-border');
    card.style.setProperty('--card-border', oldColor || 'var(--line)');
    afterPaint(() => {
      if(newColor) card.style.setProperty('--card-border', newColor);
      else card.style.removeProperty('--card-border');
    });
  }

  const params = new URLSearchParams(window.location.search);
  const requestedClass = params.get('class');
  let activeClass = (requestedClass && WEAPON_CLASSES.includes(requestedClass)) ? requestedClass : 'All';

  function scopedWeapons(){
    return activeClass === 'All' ? WEAPONS : WEAPONS.filter(w => w.class === activeClass);
  }

  // Search filters which cards are shown, but deliberately doesn't affect
  // scopedWeapons() — the progress bar/percentage stay about the whole
  // class, not just whatever the search happens to currently match.
  let searchQuery = params.get('search') || '';
  function visibleWeapons(){
    const scope = scopedWeapons();
    if(!searchQuery) return scope;
    const q = searchQuery.toLowerCase();
    return scope.filter(w => w.name.toLowerCase().includes(q));
  }

  // Big % reflects Gold completion for the current scope (the headline the
  // design calls out), with a labeled bar-row underneath for every tier so
  // the breakdown stays legible on narrow screens too.
  function updateProgressBar(){
    const scope = scopedWeapons();
    const total = scope.length;
    const bigPct = document.getElementById('progressBigPct');
    const bars = document.getElementById('progressBars');

    const tierStats = CAMO_TIERS.map(t => {
      const done = scope.filter(w => (progress[w.name] || {})[t.key]).length;
      return { tier: t, done: done, pct: total ? Math.round((done / total) * 100) : 0 };
    });

    const label = activeClass === 'All' ? 'All Weapons' : classLabel(activeClass);

    // Overall completion: 100% only once every weapon in scope has every
    // tier (Nova) — not just Gold, which was the old (incorrect) behavior.
    const totalPossible = total * CAMO_TIERS.length;
    const totalEarned = tierStats.reduce((sum, s) => sum + s.done, 0);
    const overallPct = totalPossible ? Math.round((totalEarned / totalPossible) * 100) : 0;

    // The headline number's color tracks the highest tier anyone in this
    // scope has started earning — gold by default, then platinum, onyx,
    // and finally nova as soon as any weapon reaches each stage.
    let activeColor = 'var(--gold)'; // site gold until a camo is earned
    for(let i = CAMO_TIERS.length - 1; i >= 0; i--){
      if(tierStats[i].done > 0){ activeColor = CAMO_TIERS[i].color; break; }
    }

    if(bigPct){
      bigPct.innerHTML = overallPct + '%<span>' + label + ' &middot; Overall</span>';
      bigPct.style.color = activeColor;
    }
    if(bars){
      // Each fill is drawn at its previous value, then scaled to the new
      // one after paint, so it glides rather than jumps (transform only).
      bars.innerHTML = tierStats.map(s =>
        '<div class="bar-row">' +
          '<div class="bar-label">' + s.tier.label + '</div>' +
          '<div class="bar-track"><div class="bar-fill" data-pct="' + s.pct + '" style="transform:scaleX(' + ((prevBarPct[s.tier.key] || 0) / 100) + ');background:' + s.tier.color + ';"></div></div>' +
          '<div class="bar-count">' + s.done + '/' + total + '</div>' +
        '</div>'
      ).join('');
      tierStats.forEach(s => { prevBarPct[s.tier.key] = s.pct; });
      afterPaint(() => {
        bars.querySelectorAll('.bar-fill').forEach(f => {
          f.style.transform = 'scaleX(' + (Number(f.getAttribute('data-pct')) / 100) + ')';
        });
      });
    }

    renderBlockers();

    // Progress block's own outline: gold once the whole scope has Gold,
    // then platinum, onyx, nova as each tier gets fully completed.
    const progressBlock = document.getElementById('progressBlock');
    if(progressBlock){
      const outlineColor = highestCompleteTierColor(scope, progress);
      if(outlineColor) progressBlock.style.setProperty('--tier-border', outlineColor);
      else progressBlock.style.removeProperty('--tier-border');
    }
  }

  let blockersExpanded = false;
  // "What's blocking" list under the progress bars: one line per class in
  // scope that isn't finished, naming the weapons holding it back. Weapon
  // names are buttons that search for that weapon.
  function renderBlockers(){
    const progressBlock = document.getElementById('progressBlock');
    if(!progressBlock) return;
    let box = document.getElementById('progressBlockers');
    if(!box){
      box = document.createElement('div');
      box.id = 'progressBlockers';
      box.className = 'blockers';
      progressBlock.appendChild(box);
      box.addEventListener('click', (e) => {
        if(e.target.closest('[data-toggle-blockers]')){
          blockersExpanded = !blockersExpanded;
          renderBlockers();
          return;
        }
        const btn = e.target.closest('[data-find]');
        if(!btn) return;
        searchQuery = btn.getAttribute('data-find');
        const input = config.searchInputId ? document.getElementById(config.searchInputId) : null;
        if(input) input.value = searchQuery;
        render();
      });
    }
    const classes = activeClass === 'All' ? WEAPON_CLASSES : [activeClass];
    let rows = classes.map(cls => ({ cls: cls, b: classBlocker(cls, progress) })).filter(r => r.b);
    // Game-wide blockers (e.g. Harmonic Break waiting on Platinum anywhere)
    // are the same for every class, so show them once, first.
    const globalRow = rows.find(r => r.b.global);
    rows = rows.filter(r => !r.b.global);
    if(globalRow) rows.unshift({ cls: null, b: globalRow.b });
    if(!rows.length){
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    const MAX_NAMES = 3;
    const MAX_ROWS = 3;
    const shown = blockersExpanded ? rows : rows.slice(0, MAX_ROWS);
    const toggle = rows.length > MAX_ROWS
      ? '<button class="blockers-toggle" type="button" data-toggle-blockers>' + (blockersExpanded ? 'Show less' : 'Show all ' + rows.length + ' classes') + '</button>'
      : '';
    box.innerHTML = '<div class="blockers-title">Holding things up</div>' +
      shown.map(r => {
        const names = r.b.missing.slice(0, MAX_NAMES).map(w =>
          '<button class="blocker-weapon" type="button" data-find="' + w.name + '">' + w.name + '</button>'
        ).join(', ');
        const more = r.b.missing.length > MAX_NAMES ? ' +' + (r.b.missing.length - MAX_NAMES) + ' more' : '';
        return '<div class="blocker-row">' +
          '<span class="blocker-class">' + (r.cls ? classLabel(r.cls) : 'All weapons') + '</span>' +
          '<span class="blocker-text">' + r.b.unlocks + ' needs <b style="color:' + r.b.tier.color + '">' + r.b.tier.label + '</b> on ' + names + more + '</span>' +
        '</div>';
      }).join('') + toggle;
  }

  function renderRow(w){
    const p = progress[w.name] || {};
    const pinned = grindList.includes(w.name);
    const swatchesHtml = CAMO_TIERS.map((t, i) => {
      const lockReason = tierLockReason(w, i, progress);
      const done = !!p[t.key];
      const locked = !!lockReason && !done;
      const chipStyle = done ? 'background:' + (t.swatch || t.color) + ';border-color:transparent;' : (locked ? '' : 'border-color:' + t.color + ';');
      const hint = tierHint(t, w);
      const title = locked ? lockReason : (hint ? t.label + ': ' + hint : '');
      return '<label class="tier-swatch'+(done ? ' tier-done' : '')+(locked ? ' tier-locked' : '')+'"'+(title ? ' title="'+title+'"' : '')+'>' +
        '<input class="sr-only" type="checkbox" data-name="'+w.name+'" data-tier="'+t.key+'"'+(done ? ' checked' : '')+(locked ? ' disabled' : '')+'>' +
        '<span class="swatch-chip'+(locked ? ' locked' : '')+'" style="'+chipStyle+'"></span>' +
        '<span class="swatch-label">'+t.label+'</span>' +
      '</label>';
    }).join('');
    // Optional Pyroclast row: ticked in order like the main tiers, but not
    // counted in any percentage or unlock rule.
    const prestigeDone = PRESTIGE_CAMOS.filter(c => p[c.key]).length;
    const prestigeHtml = '<div class="prestige-row">' +
      '<span class="prestige-label">Prestige</span>' +
      '<span class="prestige-chips">' +
        PRESTIGE_CAMOS.map((c, i) => {
          const done = !!p[c.key];
          const locked = !done && i > 0 && !p[PRESTIGE_CAMOS[i - 1].key];
          return '<label class="prestige-chip'+(done ? ' done' : '')+(locked ? ' locked' : '')+'" title="'+c.label+': '+c.req+(locked ? ' (needs '+PRESTIGE_CAMOS[i - 1].short+' first)' : '')+'" style="--chip:'+c.color+'">' +
            '<input class="sr-only" type="checkbox" data-prestige="'+c.key+'" data-name="'+w.name+'"'+(done ? ' checked' : '')+(locked ? ' disabled' : '')+'>' +
            '<span class="prestige-box"></span>' +
          '</label>';
        }).join('') +
      '</span>' +
      '<span class="prestige-count">'+prestigeDone+'/'+PRESTIGE_CAMOS.length+'</span>' +
    '</div>';
    const cardColor = highestOwnTierColor(w.name, progress);
    const cardStyle = cardColor ? ' style="--card-border:' + cardColor + '"' : '';
    return '<div class="weapon-card'+(pinned ? ' pinned' : '')+'" data-name="'+w.name+'" data-class="'+w.class+'"'+cardStyle+'>' +
      '<div class="card-inner">' +
        '<div class="weapon-name">'+w.name+'</div>' +
        '<div class="weapon-class">'+w.class+'</div>' +
        '<div class="swatch-row">'+swatchesHtml+'</div>' +
        prestigeHtml +
      '</div>' +
    '</div>';
  }

  function render(){
    const visible = visibleWeapons();
    const hasClassMatches = scopedWeapons().length > 0;
    listEl.innerHTML = visible.length
      ? visible.map(renderRow).join('')
      : '<div class="empty-note">' + (hasClassMatches ? 'No weapons match your search.' : 'No weapons in this class yet.') + '</div>';
    bindRowEvents();
    updateProgressBar();
    if(config.masteryElId) renderMasteryPanel(config.masteryElId, progress);
    updateFilterEmpty();
    renderClassFilterButtons();
  }

  function bindRowEvents(){
    // Tier swatches: change progress, don't trigger the card's pin click.
    listEl.querySelectorAll('.tier-swatch input').forEach(box => {
      box.addEventListener('change', () => {
        const name = box.getAttribute('data-name');
        const tier = box.getAttribute('data-tier');
        const checked = box.checked;
        const before = Object.assign({}, progress[name] || {});
        const oldColor = highestOwnTierColor(name, progress);
        if(!progress[name]) progress[name] = {};
        progress[name][tier] = checked;
        // Unchecking a tier also clears any tiers that come after it for
        // THIS weapon, since tiers are sequential per weapon.
        if(!checked){
          const idx = CAMO_TIERS.findIndex(t => t.key === tier);
          CAMO_TIERS.slice(idx + 1).forEach(t => { progress[name][t.key] = false; });
        }
        saveCamoProgress(progress);
        if(checked) logCamoChange(name, tier);
        renderGrindList(); // keep "Next: X" labels in the Grind List current
        render();
        animateCardChange(name, tier, checked, oldColor);

        // Unticking can clear up to three camos in one click, so offer an
        // undo. The change is already saved; Undo puts the weapon back
        // exactly as it was.
        if(!checked){
          const lost = CAMO_TIERS.filter(t => before[t.key]).map(t => t.label);
          if(lost.length){
            showUndoToast(
              (lost.length === 1 ? 'Removed ' + lost[0] : 'Removed ' + lost.length + ' camos') + ' from ' + name,
              () => {},
              () => {
                progress = loadCamoProgress();
                progress[name] = before;
                saveCamoProgress(progress);
                renderGrindList();
                render();
              }
            );
          }
        }
      });
    });
    listEl.querySelectorAll('.tier-swatch, .prestige-chip').forEach(label => {
      label.addEventListener('click', (e) => e.stopPropagation());
    });
    listEl.querySelectorAll('input[data-prestige]').forEach(box => {
      box.addEventListener('change', () => {
        const name = box.getAttribute('data-name');
        const key = box.getAttribute('data-prestige');
        if(!progress[name]) progress[name] = {};
        progress[name][key] = box.checked;
        // Same rule as the main tiers: unticking clears the ones after it.
        if(!box.checked){
          const idx = PRESTIGE_CAMOS.findIndex(c => c.key === key);
          PRESTIGE_CAMOS.slice(idx + 1).forEach(c => { progress[name][c.key] = false; });
        }
        saveCamoProgress(progress);
        render();
      });
    });

    // Clicking anywhere else on a weapon's card pins/unpins it.
    listEl.querySelectorAll('.weapon-card').forEach(card => {
      card.addEventListener('click', () => {
        togglePin(card.getAttribute('data-name'));
        render();
      });
    });
  }

  function updateFilterEmpty(){
    const filterEmpty = config.filterEmptyId ? document.getElementById(config.filterEmptyId) : null;
    if(filterEmpty) filterEmpty.style.display = scopedWeapons().length === 0 ? 'block' : 'none';
  }

  const classFilterEl = config.classFilterId ? document.getElementById(config.classFilterId) : null;

  // Builds/refreshes the class filter pills. Each button's border reflects
  // the highest tier that class has FULLY completed (every weapon in it) —
  // at 100% that's Nova, whose color is white, so the outline naturally
  // goes white with no special-casing needed.
  function renderClassFilterButtons(){
    if(!classFilterEl) return;
    classFilterEl.innerHTML = ['All', ...WEAPON_CLASSES].map(c => {
      const weaponsInScope = c === 'All' ? WEAPONS : WEAPONS.filter(w => w.class === c);
      const color = highestCompleteTierColor(weaponsInScope, progress);
      const styleAttr = color ? ' style="--tier-border:' + color + '"' : '';
      const classes = 'class-filter-btn' + (c === activeClass ? ' active' : '');
      return '<button class="'+classes+'" data-class="'+c+'" type="button"'+styleAttr+'>'+(c === 'All' ? 'All' : classLabel(c))+'</button>';
    }).join('');
  }

  if(classFilterEl){
    renderClassFilterButtons();
    classFilterEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.class-filter-btn');
      if(!btn) return;
      activeClass = btn.getAttribute('data-class');
      render();
    });
  }

  const searchInputEl = config.searchInputId ? document.getElementById(config.searchInputId) : null;
  if(searchInputEl){
    if(searchQuery) searchInputEl.value = searchQuery;
    searchInputEl.addEventListener('input', () => {
      searchQuery = searchInputEl.value.trim();
      render();
    });
  }

  // If progress changes elsewhere (e.g. a Next Camo click, or the Grind
  // List gets cleared), reflect it here without requiring a page reload.
  document.addEventListener('grindlist:changed', () => {
    progress = loadCamoProgress();
    render();
  });
  onDataSync(() => {
    progress = loadCamoProgress();
    render();
  });

  render();
}

// ---- Divergence + Mastery panel (camos.html) ----
// Divergence is worked out from weapon progress (Harmonic Break on every
// weapon), so it can't be ticked by hand. The current mode's three Mastery
// camos are ticked here, in order, once Divergence is in. Mastery progress
// is stored per mode: { mp: {...}, dmz: {...}, wz: {...} }.
const MASTERY_KEY = 'mw4camo-mastery';

function loadMastery(){
  try{
    const raw = localStorage.getItem(MASTERY_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}

function saveMastery(m){
  try{ localStorage.setItem(MASTERY_KEY, JSON.stringify(m)); }catch(e){}
}

function divergenceCount(progress){
  const last = CAMO_TIERS[CAMO_TIERS.length - 1].key;
  return WEAPONS.filter(w => (progress[w.name] || {})[last]).length;
}

function renderMasteryPanel(containerId, progress){
  const el = document.getElementById(containerId);
  if(!el) return;
  const modeKey = getCurrentMode();
  const mode = getModeInfo(modeKey);
  const camos = MASTERY_CAMOS[modeKey] || [];
  const all = loadMastery();
  const done = all[modeKey] || {};
  const hbCount = divergenceCount(progress);
  const hasDivergence = hbCount === WEAPONS.length;
  const lastTier = CAMO_TIERS[CAMO_TIERS.length - 1];

  function item(opts){
    const chipStyle = opts.done ? 'background:' + (opts.swatch || opts.color) + ';border-color:transparent;' : (opts.locked ? '' : 'border-color:' + opts.color + ';');
    return '<label class="mastery-item tier-swatch' + (opts.done ? ' tier-done' : '') + (opts.locked ? ' tier-locked' : '') + '"' + (opts.title ? ' title="' + opts.title + '"' : '') + '>' +
      (opts.key ? '<input class="sr-only" type="checkbox" data-mastery="' + opts.key + '"' + (opts.done ? ' checked' : '') + (opts.locked ? ' disabled' : '') + '>' : '') +
      '<span class="swatch-chip' + (opts.locked ? ' locked' : '') + '" style="' + chipStyle + '"></span>' +
      '<span class="swatch-label">' + opts.label + '</span>' +
      '<span class="mastery-req">' + opts.req + '</span>' +
    '</label>';
  }

  let html = item({
    label: DIVERGENCE.label,
    color: DIVERGENCE.color,
    swatch: DIVERGENCE.swatch,
    done: hasDivergence,
    locked: false,
    req: lastTier.label + ' on all ' + WEAPONS.length + ' weapons &middot; ' + hbCount + '/' + WEAPONS.length,
    title: 'Ticks itself once every weapon has ' + lastTier.label
  });
  camos.forEach((c, i) => {
    const isDone = !!done[c.key];
    let lockReason = '';
    if(mode.comingSoon) lockReason = 'Not available yet';
    else if(!hasDivergence) lockReason = 'Needs Divergence first';
    else if(i > 0 && !done[camos[i - 1].key]) lockReason = 'Needs ' + camos[i - 1].label + ' first';
    html += item({
      key: c.key,
      label: c.label,
      color: c.color,
      swatch: c.swatch,
      done: isDone,
      locked: !!lockReason && !isDone,
      title: lockReason,
      req: c.req || 'Requirement not published yet'
    });
  });

  el.innerHTML =
    '<div class="mastery-head">' +
      '<span class="mastery-title">' + mode.label + ' Mastery</span>' +
      '<span class="mastery-note">Weapon camos are shared across Multiplayer, DMZ and Warzone. Mastery camos are per mode.</span>' +
    '</div>' +
    (mode.comingSoon ? '<div class="mastery-soon">' + mode.comingSoon + '</div>' : '') +
    '<div class="mastery-row">' + html + '</div>';

  el.querySelectorAll('input[data-mastery]').forEach(box => {
    box.addEventListener('change', () => {
      const key = box.getAttribute('data-mastery');
      const checked = box.checked;
      const m = loadMastery();
      const before = Object.assign({}, m[modeKey] || {});
      if(!m[modeKey]) m[modeKey] = {};
      m[modeKey][key] = checked;
      const idx = camos.findIndex(c => c.key === key);
      if(!checked) camos.slice(idx + 1).forEach(c => { m[modeKey][c.key] = false; });
      saveMastery(m);
      if(checked){
        const c = camos[idx];
        const log = loadRecentLog();
        log.unshift({ name: c.label, class: mode.label + ' Mastery', tierKey: c.key, tierLabel: 'Mastery', color: c.color, ts: Date.now() });
        saveRecentLog(log.slice(0, RECENT_LOG_LIMIT));
      }
      renderMasteryPanel(containerId, progress);
      if(checked && !REDUCED_MOTION){
        const chip = el.querySelector('input[data-mastery="' + key + '"] + .swatch-chip');
        if(chip) chip.classList.add('chip-pop');
      }
      if(!checked){
        const lost = camos.filter(c => before[c.key]).map(c => c.label);
        if(lost.length){
          showUndoToast(
            lost.length === 1 ? 'Removed ' + lost[0] : 'Removed ' + lost.length + ' mastery camos',
            () => {},
            () => {
              const m2 = loadMastery();
              m2[modeKey] = before;
              saveMastery(m2);
              renderMasteryPanel(containerId, loadCamoProgress());
            }
          );
        }
      }
    });
  });
}
