// ============================================================
// MW4 WEAPON + CAMO DATA
// ============================================================
// Source: Activision's official Modern Warfare 4 Open Beta Weapons Guide
// (callofduty.com/guides/mw4/open-beta-weapons). MW4 launches with 33
// weapons; 22 are officially named so far. The remaining 11 are added here
// once they're revealed at launch (Oct 23, 2026) — just append them to
// WEAPONS below. Adding weapons never affects existing progress.

const WEAPONS = [
  // Assault Rifles
  { name: 'Han 86', class: 'Assault Rifle' },
  { name: 'M4', class: 'Assault Rifle' },
  { name: 'Hyeon Burst', class: 'Assault Rifle' },
  { name: 'Kastov 762', class: 'Assault Rifle' },
  { name: 'Patriot XMR', class: 'Assault Rifle' },
  { name: 'Axion', class: 'Assault Rifle' },
  // SMGs
  { name: 'ISO Nightshade', class: 'SMG' },
  { name: 'PPSh-41', class: 'SMG' },
  { name: 'X-58 Nyx', class: 'SMG' },
  { name: 'Wz. 55 Striga', class: 'SMG' },
  // Shotguns
  { name: 'Rezi 12', class: 'Shotgun' },
  // LMGs
  { name: 'FiNN LMG', class: 'LMG' },
  { name: 'Type 73', class: 'LMG' },
  // Marksman Rifles
  { name: 'MAR-9', class: 'Marksman Rifle' },
  { name: 'Oris 8.6', class: 'Marksman Rifle' },
  // Sniper Rifles
  { name: 'KG-7 Vulcan', class: 'Sniper Rifle' },
  { name: 'Signal .50', class: 'Sniper Rifle' },
  // Pistols
  { name: 'Karit P68', class: 'Pistol' },
  { name: '.50 GS', class: 'Pistol' },
  { name: 'Sang 9mm', class: 'Pistol' },
  // Launchers
  { name: 'PILA', class: 'Launcher' },
  // Melee
  { name: 'Combat Knife', class: 'Melee' }
];

const WEAPON_CLASSES = [...new Set(WEAPONS.map(w => w.class))];

// Display label (usually plural) shown on the homepage class tiles.
// Falls back to "<class>s" for any class not listed here, so adding a new
// weapon class in the future doesn't require touching this map.
const CLASS_LABELS = {
  'Assault Rifle': 'Assault Rifles',
  'SMG': 'SMGs',
  'Shotgun': 'Shotguns',
  'LMG': 'LMGs',
  'Marksman Rifle': 'Marksman Rifles',
  'Sniper Rifle': 'Sniper Rifles',
  'Pistol': 'Pistols',
  'Launcher': 'Launchers',
  'Melee': 'Melee'
};

function classLabel(cls){
  return CLASS_LABELS[cls] || (cls + 's');
}

// ============================================================
// TRACKER MODES
// ============================================================
// Multiplayer, Warzone, and DMZ are tracked as fully independent progress
// tracks. They share the same weapon roster but each has its own three
// Mastery Camos (MODE_TIERS below).
//
// `accent` drives the mode switcher, the eyebrow badge background, and any
// other mode-specific UI coloring. All three use the site gold for now.
const MODES = [
  { key: 'mp', label: 'Multiplayer', accent: 'var(--gold)' },
  { key: 'wz', label: 'Warzone', accent: 'var(--gold)' },
  { key: 'dmz', label: 'DMZ', accent: 'var(--gold)' }
];

const MODE_KEY_STORAGE = 'mw4camo-mode';

function getCurrentMode(){
  try{
    const stored = localStorage.getItem(MODE_KEY_STORAGE);
    if(MODES.some(m => m.key === stored)) return stored;
  }catch(e){}
  return MODES[0].key; // Multiplayer is the default
}

function setCurrentMode(modeKey){
  try{ localStorage.setItem(MODE_KEY_STORAGE, modeKey); }catch(e){}
}

function getModeInfo(modeKey){
  return MODES.find(m => m.key === modeKey) || MODES[0];
}

// Builds a mode-namespaced storage key, e.g. modeStorageKey('mw4camo-progress')
// -> 'mw4camo-progress-wz' when Warzone is the active mode. Used for every
// piece of data that's tracked per-mode (progress, grind list, recent log).
function modeStorageKey(baseKey){
  return baseKey + '-' + getCurrentMode();
}

// Applies the current mode's accent as a CSS custom property so any element
// referencing var(--mode-accent) picks it up, and keeps every open tab's
// eyebrow badge in sync if the mode changes elsewhere.
function applyModeAccent(){
  const mode = getModeInfo(getCurrentMode());
  document.documentElement.style.setProperty('--mode-accent', mode.accent);
  document.querySelectorAll('.mode-badge').forEach(el => { el.textContent = mode.label; });
}

// ============================================================
// MASTERY CAMOS (per mode)
// ============================================================
// Names and order are official (revealed at Call of Duty: NEXT, Aug 2026);
// each weapon's camos unlock in this order within a mode. The challenge
// requirements aren't published yet — they go live at launch.
//
// Colors are NOT official: they're picked to suggest each camo and stay
// readable on the dark UI. The top tier in every mode is white on purpose,
// so a fully mastered weapon/class/scope reads the same everywhere.
//
// Not tracked yet: the shared per-weapon Camo Track that comes before
// mastery (contents unpublished) and the Prestige camos (Pyroclast etc.).
const MODE_TIERS = {
  mp: [
    { key: 'mercurial-drift', label: 'Mercurial Drift', color: '#c3ccd6' },
    { key: 'polyatomic-reforged', label: 'Polyatomic Reforged', color: '#a77df2' },
    { key: 'orion-reforged', label: 'Orion Reforged', color: '#ffffff' }
  ],
  wz: [
    { key: 'parallax', label: 'Parallax', color: '#e8833a' },
    { key: 'damascus-reforged', label: 'Damascus Reforged', color: '#9aa0a6' },
    { key: 'empyros', label: 'Empyros', color: '#ffffff' }
  ],
  dmz: [
    { key: 'chiral', label: 'Chiral', color: '#5cc8b8' },
    { key: 'ripple-tide', label: 'Ripple Tide', color: '#4f8fe6' },
    { key: 'helio', label: 'Helio', color: '#ffffff' }
  ]
};

// The active mode's tiers. Switching mode reloads the page, so resolving
// this once at load is enough — every page reads CAMO_TIERS directly.
const CAMO_TIERS = MODE_TIERS[getCurrentMode()];

// ============================================================
// ONE-TIME RESET OF PLACEHOLDER DATA
// ============================================================
// Before launch data existed, progress was stored against Black Ops 6
// weapon names and Gold/Platinum/Onyx/Nova tiers. None of that matches the
// real MW4 data, so it's cleared once. Mapfam images and the chosen mode
// are kept. Bump DATA_VERSION only for changes that genuinely invalidate
// stored progress (adding weapons does not).
const DATA_VERSION = '2';
(function(){
  try{
    if(localStorage.getItem('mw4camo-data-version') === DATA_VERSION) return;
    ['mw4camo-progress', 'mw4camo-grindlist', 'mw4camo-recent'].forEach(base => {
      localStorage.removeItem(base);
      MODES.forEach(m => localStorage.removeItem(base + '-' + m.key));
    });
    localStorage.setItem('mw4camo-data-version', DATA_VERSION);
  }catch(e){}
})();
