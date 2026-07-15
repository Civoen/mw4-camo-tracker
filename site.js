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
const grindListPanel = document.getElementById('grindListPanel');
const grindListCount = document.getElementById('grindListCount');

function weaponLookup(name){
  return WEAPONS.find(w => w.name === name) || { name: name, class: '' };
}

function nextTierLabel(name){
  const progress = loadCamoProgress();
  const p = progress[name] || {};
  const next = CAMO_TIERS.find(t => !p[t.key]);
  return next ? 'Next: ' + next.label : 'All tiers complete';
}

function renderGrindList(){
  if(!grindListEl) return;
  grindListCount.textContent = grindList.length;
  grindListPanel.innerHTML = grindList.length
    ? grindList.map(name => {
        const w = weaponLookup(name);
        return '<div class="grind-item" data-name="'+name+'">' +
          '<span><span class="grind-item-name">'+w.name+'</span><br>' +
          '<span class="grind-item-sub">'+w.class+' &middot; '+nextTierLabel(name)+'</span></span>' +
          '<button class="grind-item-remove" data-name="'+name+'" type="button">Remove</button>' +
        '</div>';
      }).join('')
    : '<div class="grind-list-empty">No weapons pinned. Pin the ones you\'re currently grinding.</div>';
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
    if(typeof updatePinButtons === 'function') updatePinButtons();
  });
  grindListPanel.addEventListener('click', (e) => {
    const btn = e.target.closest('.grind-item-remove');
    if(!btn) return;
    const name = btn.getAttribute('data-name');
    grindList = grindList.filter(n => n !== name);
    saveGrindList(grindList);
    renderGrindList();
    if(typeof updatePinButtons === 'function') updatePinButtons();
  });
  renderGrindList();
}

function togglePin(name){
  if(grindList.includes(name)){
    grindList = grindList.filter(n => n !== name);
  }else{
    grindList.push(name);
  }
  saveGrindList(grindList);
  renderGrindList();
}

function loadCamoProgress(){
  try{
    const raw = localStorage.getItem('mw4camo-progress');
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}

// ---- Search ----
const searchInput = document.getElementById('taskSearch');
const searchResults = document.getElementById('searchResults');

function renderResults(query){
  const q = query.trim().toLowerCase();
  if(!q){ searchResults.classList.remove('open'); searchResults.innerHTML = ''; return; }
  const matches = WEAPONS.filter(w => w.name.toLowerCase().includes(q));
  searchResults.innerHTML = matches.length
    ? matches.map(w => '<div data-name="'+w.name+'">'+w.name+' <span style="opacity:.6">&middot; '+w.class+'</span></div>').join('')
    : '<div class="none">No weapons found</div>';
  searchResults.classList.add('open');
}

if(searchInput){
  searchInput.addEventListener('input', (e) => renderResults(e.target.value));
  searchInput.addEventListener('focus', (e) => renderResults(e.target.value));
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.search-wrap')) searchResults.classList.remove('open');
  });
  searchResults.addEventListener('click', (e) => {
    const row = e.target.closest('[data-name]');
    if(row) window.location.href = 'camos.html?w=' + encodeURIComponent(row.getAttribute('data-name'));
  });
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

  const mobileSearchBtn = document.createElement('button');
  mobileSearchBtn.type = 'button';
  mobileSearchBtn.className = 'mobile-search-btn';
  mobileSearchBtn.setAttribute('aria-label', 'Search weapons');
  mobileSearchBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  mobileSearchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wrap = document.querySelector('.search-wrap');
    if(!wrap) return;
    const open = wrap.classList.toggle('mobile-search-open');
    if(open) searchInput.focus();
  });
  topbarRightEl.appendChild(mobileSearchBtn);

  document.addEventListener('click', (e) => {
    if(!e.target.closest('.mobile-menu-wrap')) mobileMenuPanel.classList.remove('open');
    const wrap = document.querySelector('.search-wrap');
    if(wrap && !e.target.closest('.search-wrap') && !e.target.closest('.mobile-search-btn')){
      wrap.classList.remove('mobile-search-open');
    }
  });
}

// ---- Keyboard shortcuts (Space to search, Esc to close panels) ----
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;

  if(e.key === ' ' && !isTyping && searchInput){
    e.preventDefault();
    searchInput.focus();
  }

  if(e.key === 'Escape'){
    if(grindListEl) grindListEl.classList.remove('open');
    if(searchResults) searchResults.classList.remove('open');
    if(isTyping) document.activeElement.blur();
  }
});

// ---- Camo checklist renderer (per-weapon, sequential tiers) ----
// config = { listElId, classFilterId, filterInputId, filterEmptyId }
function initCamoChecklist(config){
  const listEl = document.getElementById(config.listElId);
  let progress = loadCamoProgress();
  let activeClass = 'All';

  function saveProgress(){
    try{ localStorage.setItem('mw4camo-progress', JSON.stringify(progress)); }catch(e){}
  }

  function weaponDone(name){
    const p = progress[name] || {};
    return CAMO_TIERS.every(t => p[t.key]);
  }

  function updateProgressBar(){
    const total = WEAPONS.length;
    const done = WEAPONS.filter(w => weaponDone(w.name)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('progressText').textContent = done + ' of ' + total + ' weapons mastered';
    document.getElementById('progressPct').textContent = pct + '%';
    const fill = document.getElementById('progressFill');
    fill.style.width = pct + '%';
    fill.style.background = pct >= 100 ? '#3cbf2d' : '';
  }

  window.updatePinButtons = function(){
    listEl.querySelectorAll('.weapon-pin').forEach(btn => {
      const name = btn.getAttribute('data-name');
      const pinned = grindList.includes(name);
      btn.textContent = pinned ? '\u2713 Pinned' : '+ Pin';
      btn.classList.toggle('pinned', pinned);
    });
  };

  function renderRow(w){
    const p = progress[w.name] || {};
    const tiersHtml = CAMO_TIERS.map((t, i) => {
      const prevDone = i === 0 || p[CAMO_TIERS[i - 1].key];
      const done = !!p[t.key];
      const locked = !prevDone && !done;
      return '<label class="tier-check'+(done ? ' tier-done' : '')+(locked ? ' tier-locked' : '')+'">' +
        '<input type="checkbox" data-name="'+w.name+'" data-tier="'+t.key+'"'+(done ? ' checked' : '')+(locked ? ' disabled' : '')+'>' +
        t.label +
      '</label>';
    }).join('');
    return '<div class="weapon-row'+(weaponDone(w.name) ? ' done' : '')+'" data-name="'+w.name+'" data-class="'+w.class+'">' +
      '<div class="weapon-head">' +
        '<span><span class="weapon-name">'+w.name+'</span><br><span class="weapon-class">'+w.class+'</span></span>' +
        '<button class="weapon-pin" data-name="'+w.name+'" type="button">+ Pin</button>' +
      '</div>' +
      '<div class="tier-row">'+tiersHtml+'</div>' +
    '</div>';
  }

  function render(){
    listEl.innerHTML = WEAPONS.length
      ? WEAPONS.map(renderRow).join('')
      : '<div class="empty-note">No weapons added yet.</div>';
    bindRowEvents();
    updatePinButtons();
    updateProgressBar();
    applyFilters();
  }

  function bindRowEvents(){
    listEl.querySelectorAll('.tier-check input').forEach(box => {
      box.addEventListener('change', () => {
        const name = box.getAttribute('data-name');
        const tier = box.getAttribute('data-tier');
        if(!progress[name]) progress[name] = {};
        progress[name][tier] = box.checked;
        // Unchecking a tier also clears any tiers that come after it.
        if(!box.checked){
          const idx = CAMO_TIERS.findIndex(t => t.key === tier);
          CAMO_TIERS.slice(idx + 1).forEach(t => { progress[name][t.key] = false; });
        }
        saveProgress();
        render();
      });
    });
    listEl.querySelectorAll('.weapon-pin').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        togglePin(btn.getAttribute('data-name'));
        updatePinButtons();
      });
    });
  }

  const filterInput = config.filterInputId ? document.getElementById(config.filterInputId) : null;
  const filterEmpty = config.filterEmptyId ? document.getElementById(config.filterEmptyId) : null;
  const classFilterEl = config.classFilterId ? document.getElementById(config.classFilterId) : null;

  function applyFilters(){
    const q = filterInput ? filterInput.value.trim().toLowerCase() : '';
    let visibleCount = 0;
    listEl.querySelectorAll('.weapon-row').forEach(row => {
      const name = row.getAttribute('data-name').toLowerCase();
      const cls = row.getAttribute('data-class');
      const matchesSearch = name.includes(q);
      const matchesClass = activeClass === 'All' || cls === activeClass;
      const visible = matchesSearch && matchesClass;
      row.style.display = visible ? '' : 'none';
      if(visible) visibleCount++;
    });
    if(filterEmpty) filterEmpty.style.display = visibleCount === 0 ? 'block' : 'none';
  }

  if(filterInput) filterInput.addEventListener('input', applyFilters);

  if(classFilterEl){
    classFilterEl.innerHTML = ['All', ...WEAPON_CLASSES].map(c =>
      '<button class="class-filter-btn'+(c === 'All' ? ' active' : '')+'" data-class="'+c+'" type="button">'+c+'</button>'
    ).join('');
    classFilterEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.class-filter-btn');
      if(!btn) return;
      activeClass = btn.getAttribute('data-class');
      classFilterEl.querySelectorAll('.class-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyFilters();
    });
  }

  render();

  // Deep-link support: camos.html?w=WeaponName scrolls to and highlights a weapon
  const params = new URLSearchParams(window.location.search);
  const target = params.get('w');
  if(target){
    const row = listEl.querySelector('.weapon-row[data-name="'+CSS.escape(target)+'"]');
    if(row){
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.borderColor = 'var(--amber)';
    }
  }
}
