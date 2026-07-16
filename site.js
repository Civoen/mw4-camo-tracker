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

// True once every weapon in `cls` has tier `tierKey` checked. Mastery camo
// tiers beyond Gold are gated at the class level (e.g. no weapon can start
// Platinum until every weapon in its class has Gold) rather than per-weapon.
function classTierComplete(cls, tierKey, progress){
  const weapons = WEAPONS.filter(w => w.class === cls);
  return weapons.length > 0 && weapons.every(w => (progress[w.name] || {})[tierKey]);
}

// Whether a given tier is unlocked for a specific weapon right now.
function tierUnlocked(weapon, tierIndex, progress){
  if(tierIndex === 0) return true; // Gold has no prerequisite
  const prevTier = CAMO_TIERS[tierIndex - 1];
  return classTierComplete(weapon.class, prevTier.key, progress);
}

function nextTierLabel(name){
  const progress = loadCamoProgress();
  const p = progress[name] || {};
  const next = CAMO_TIERS.find(t => !p[t.key]);
  return next ? 'Next: ' + next.label : 'All tiers complete';
}

// Checks the next available tier for a weapon (used by the "Next Camo"
// button in the Grind List). No-ops if the tier is locked or already maxed.
function advanceNextTier(name){
  const weapon = weaponLookup(name);
  const progress = loadCamoProgress();
  const p = progress[name] || {};
  const nextIndex = CAMO_TIERS.findIndex(t => !p[t.key]);
  if(nextIndex === -1) return; // already fully mastered
  if(!tierUnlocked(weapon, nextIndex, progress)) return; // gated, can't skip ahead
  if(!progress[name]) progress[name] = {};
  progress[name][CAMO_TIERS[nextIndex].key] = true;
  saveCamoProgress(progress);
  renderGrindList();
  document.dispatchEvent(new CustomEvent('grindlist:changed'));
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
// Expands the Grind List panel to fill the available vertical space and
// scales item text based on how much room each pinned weapon gets.
function applyFullscreenSizing(){
  if(!grindListEl.classList.contains('fullscreen')) return;
  const header = document.querySelector('header');
  const barHeight = grindListEl.querySelector('.grind-list-bar').getBoundingClientRect().height;
  const panelHeight = header
    ? Math.max(200, window.innerHeight - header.getBoundingClientRect().top - barHeight)
    : Math.max(200, window.innerHeight - barHeight - 40);
  grindListPanel.style.height = panelHeight + 'px';

  const budget = panelHeight / Math.max(1, grindList.length);
  grindListEl.classList.remove('fs-lg', 'fs-md', 'fs-sm');
  grindListEl.classList.add(budget >= 90 ? 'fs-lg' : budget >= 60 ? 'fs-md' : 'fs-sm');
}

function renderGrindList(){
  if(!grindListEl) return;
  applyFullscreenSizing();
  grindListCount.textContent = grindList.length;
  grindListPanel.innerHTML = grindList.length
    ? grindList.map(name => {
        const w = weaponLookup(name);
        return '<div class="grind-item" data-name="'+name+'">' +
          '<span><span class="grind-item-name">'+w.name+'</span><br>' +
          '<span class="grind-item-sub">'+w.class+' &middot; '+nextTierLabel(name)+'</span></span>' +
          '<span class="grind-item-actions">' +
            '<button class="grind-item-next" data-name="'+name+'" type="button">Next Camo</button>' +
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
      if(active){
        grindListEl.classList.add('open');
      }else{
        grindListEl.classList.remove('open', 'fs-lg', 'fs-md', 'fs-sm');
        grindListPanel.style.height = '';
      }
      grindListFullscreen.textContent = active ? 'Exit Full Screen' : 'Full Screen';
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
    { name: 'Manage Data', url: 'import.html' }
  ];

  mobileMenuPanel.innerHTML = staticLinks.map(l => '<a href="'+l.url+'">'+l.name+'</a>').join('');

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
function renderClassSummary(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const progress = loadCamoProgress();

  function tile(label, count, total, href){
    return '<a class="class-tile" href="'+href+'">' +
      '<div class="class-tile-name">'+label+'</div>' +
      '<div class="class-tile-count">'+count+'/'+total+'</div>' +
    '</a>';
  }

  const allDone = WEAPONS.filter(w => isWeaponMastered(w.name, progress)).length;
  let html = tile('All Weapons', allDone, WEAPONS.length, 'camos.html');

  WEAPON_CLASSES.forEach(cls => {
    const weapons = WEAPONS.filter(w => w.class === cls);
    const done = weapons.filter(w => isWeaponMastered(w.name, progress)).length;
    html += tile(classLabel(cls), done, weapons.length, 'camos.html?class=' + encodeURIComponent(cls));
  });

  el.innerHTML = html;
}

// ---- Camo checklist renderer (per-weapon, sequential/class-gated tiers) ----
// config = { listElId, classFilterId, filterEmptyId }
function initCamoChecklist(config){
  const listEl = document.getElementById(config.listElId);
  let progress = loadCamoProgress();

  const params = new URLSearchParams(window.location.search);
  const requestedClass = params.get('class');
  let activeClass = (requestedClass && WEAPON_CLASSES.includes(requestedClass)) ? requestedClass : 'All';

  function scopedWeapons(){
    return activeClass === 'All' ? WEAPONS : WEAPONS.filter(w => w.class === activeClass);
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
    const goldPct = tierStats[0] ? tierStats[0].pct : 0;
    if(bigPct){
      bigPct.innerHTML = goldPct + '%<span>' + label + ' &middot; Gold</span>';
    }
    if(bars){
      bars.innerHTML = tierStats.map(s =>
        '<div class="bar-row">' +
          '<div class="bar-label">' + s.tier.label + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + s.pct + '%;background:' + s.tier.color + ';"></div></div>' +
          '<div class="bar-count">' + s.done + '/' + total + '</div>' +
        '</div>'
      ).join('');
    }
  }

  function renderRow(w){
    const p = progress[w.name] || {};
    const pinned = grindList.includes(w.name);
    const swatchesHtml = CAMO_TIERS.map((t, i) => {
      const unlocked = tierUnlocked(w, i, progress);
      const done = !!p[t.key];
      const locked = !unlocked && !done;
      const chipStyle = done ? 'background:' + t.color + ';border-color:transparent;' : (locked ? '' : 'border-color:' + t.color + ';');
      return '<label class="tier-swatch'+(done ? ' tier-done' : '')+(locked ? ' tier-locked' : '')+'">' +
        '<input class="sr-only" type="checkbox" data-name="'+w.name+'" data-tier="'+t.key+'"'+(done ? ' checked' : '')+(locked ? ' disabled' : '')+'>' +
        '<span class="swatch-chip'+(locked ? ' locked' : '')+'" style="'+chipStyle+'"></span>' +
        '<span class="swatch-label">'+t.label+'</span>' +
      '</label>';
    }).join('');
    return '<div class="weapon-card'+(isWeaponMastered(w.name, progress) ? ' mastered' : '')+(pinned ? ' pinned' : '')+'" data-name="'+w.name+'" data-class="'+w.class+'">' +
      '<div class="weapon-name">'+w.name+'</div>' +
      '<div class="weapon-class">'+w.class+'</div>' +
      '<div class="swatch-row">'+swatchesHtml+'</div>' +
    '</div>';
  }

  function render(){
    const scope = scopedWeapons();
    listEl.innerHTML = scope.length
      ? scope.map(renderRow).join('')
      : '<div class="empty-note">No weapons in this class yet.</div>';
    bindRowEvents();
    updateProgressBar();
    updateFilterEmpty();
  }

  function bindRowEvents(){
    // Tier swatches: change progress, don't trigger the card's pin click.
    listEl.querySelectorAll('.tier-swatch input').forEach(box => {
      box.addEventListener('change', () => {
        const name = box.getAttribute('data-name');
        const tier = box.getAttribute('data-tier');
        if(!progress[name]) progress[name] = {};
        progress[name][tier] = box.checked;
        // Unchecking a tier also clears any tiers that come after it for
        // THIS weapon, since tiers are sequential per weapon.
        if(!box.checked){
          const idx = CAMO_TIERS.findIndex(t => t.key === tier);
          CAMO_TIERS.slice(idx + 1).forEach(t => { progress[name][t.key] = false; });
        }
        saveCamoProgress(progress);
        renderGrindList(); // keep "Next: X" labels in the Grind List current
        render();
      });
    });
    listEl.querySelectorAll('.tier-swatch').forEach(label => {
      label.addEventListener('click', (e) => e.stopPropagation());
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
  if(classFilterEl){
    classFilterEl.innerHTML = ['All', ...WEAPON_CLASSES].map(c =>
      '<button class="class-filter-btn'+(c === activeClass ? ' active' : '')+'" data-class="'+c+'" type="button">'+(c === 'All' ? 'All' : classLabel(c))+'</button>'
    ).join('');
    classFilterEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.class-filter-btn');
      if(!btn) return;
      activeClass = btn.getAttribute('data-class');
      classFilterEl.querySelectorAll('.class-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
  }

  // If progress changes elsewhere (e.g. a Next Camo click, or the Grind
  // List gets cleared), reflect it here without requiring a page reload.
  document.addEventListener('grindlist:changed', () => {
    progress = loadCamoProgress();
    render();
  });

  render();
}
