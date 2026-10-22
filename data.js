// ============================================================
// MW4 WEAPON + CAMO DATA
// ============================================================
// Weapons: Activision's official launch list, all 33 (callofduty.com blog
// "Ready for Launch", Oct 2026). Adding weapons never affects progress.

const WEAPONS = [
  // Assault Rifles
  { name: 'Han 86', class: 'Assault Rifle' },
  { name: 'M4', class: 'Assault Rifle' },
  { name: 'Hyeon Burst', class: 'Assault Rifle' },
  { name: 'Patriot XMR', class: 'Assault Rifle' },
  { name: 'Kastov 762', class: 'Assault Rifle' },
  { name: 'Oden', class: 'Assault Rifle' },
  { name: 'Axion', class: 'Assault Rifle' },
  { name: 'Cronen Squall', class: 'Assault Rifle' },
  // SMGs
  { name: 'ISO Nightshade', class: 'SMG' },
  { name: 'VEL 46', class: 'SMG' },
  { name: 'Wz.55 Striga', class: 'SMG' },
  { name: 'PPSh-41', class: 'SMG' },
  { name: 'X-58 Nyx', class: 'SMG' },
  // Shotguns
  { name: 'Rezi 12', class: 'Shotgun' },
  { name: 'Warlord', class: 'Shotgun' },
  // LMGs
  { name: 'FiNN LMG', class: 'LMG' },
  { name: 'Type 73', class: 'LMG' },
  { name: 'APOC-338', class: 'LMG' },
  // Marksman Rifles
  { name: 'MAR-9', class: 'Marksman Rifle' },
  { name: 'Oris 8.6', class: 'Marksman Rifle' },
  { name: 'Mosin-Nagant', class: 'Marksman Rifle' },
  // Sniper Rifles
  { name: 'KG-7 Vulcan', class: 'Sniper Rifle' },
  { name: 'Astaroth .57', class: 'Sniper Rifle' },
  { name: 'Signal 50', class: 'Sniper Rifle' },
  // Pistols
  { name: 'SANG 9mm', class: 'Pistol' },
  { name: 'Krait P68', class: 'Pistol' },
  { name: '.50 GS', class: 'Pistol' },
  { name: 'Mojave .357', class: 'Pistol' },
  // Launchers
  { name: 'PILA', class: 'Launcher' },
  { name: 'RPG-8', class: 'Launcher' },
  { name: 'JOKR', class: 'Launcher' },
  { name: 'PM-40 Anvil', class: 'Launcher' },
  // Melee
  { name: 'FSS Carbon Edge 1095', class: 'Melee' }
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
// Each weapon has ONE Camo Track that progresses across Multiplayer, DMZ
// and Warzone (official: "Progress each weapon's Camo Track across all
// three experiences"). So weapon camos (CAMO_TIERS) are shared, and the
// mode only decides which set of Mastery camos (MASTERY_CAMOS) is shown.
//
// `accent` drives the mode switcher and eyebrow badge. All gold for now.
// `comingSoon` marks a mode whose mastery camos can't be earned yet.
const MODES = [
  { key: 'mp', label: 'Multiplayer', accent: 'var(--gold)' },
  { key: 'wz', label: 'Warzone', accent: 'var(--gold)', comingSoon: 'Warzone joins MW4 in Season 1 (Nov 6). Its Mastery camos unlock then.' },
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

// Builds a mode-namespaced storage key. No longer used for weapon progress
// (that's shared now) — kept for anything that genuinely differs by mode.
function modeStorageKey(baseKey){
  return baseKey + '-' + getCurrentMode();
}

// Applies the current mode's accent as a CSS custom property and keeps the
// eyebrow badge text in sync.
function applyModeAccent(){
  const mode = getModeInfo(getCurrentMode());
  document.documentElement.style.setProperty('--mode-accent', mode.accent);
  document.querySelectorAll('.mode-badge').forEach(el => { el.textContent = mode.label; });
}

// ============================================================
// WEAPON CAMOS (shared across every mode)
// ============================================================
// Each weapon's Camo Track: 8 Military camos (weapon level) and 3 Special
// camos (level + a challenge) come first, then the Completionist camos
// tracked here, in order: Gold -> Platinum -> Harmonic Break.
//
// Gold needs all of that weapon's Military + Special camos. Platinum and
// Harmonic Break are class-gated per launch guides: Platinum needs Gold on
// every weapon in the class, Harmonic Break needs Platinum on every weapon
// in the class. Set CLASS_GATED to false if the game turns out not to work
// that way — nothing else needs changing.
//
// Colours are picked for readability, not official. The top tier is white
// on purpose so a fully completed weapon/class reads the same everywhere.
const CAMO_TIERS = [
  { key: 'gold', label: 'Gold', color: '#fecf41' },
  { key: 'platinum', label: 'Platinum', color: '#9fb4c8' },
  { key: 'harmonic-break', label: 'Harmonic Break', color: '#ffffff' }
];
const CLASS_GATED = true;

// Optional per-weapon marker for "all 8 Military + 3 Special camos done",
// i.e. the weapon is ready for its Gold challenge. Purely a reminder: it
// doesn't count towards percentages or gate anything. Earning Gold implies
// it, so it shows as done once Gold is ticked.
const PREP_TICK = { key: 'military-special', label: 'Military & Special done' };

// ============================================================
// DIVERGENCE + MASTERY CAMOS (account-wide)
// ============================================================
// Divergence unlocks once every weapon has Harmonic Break. After that each
// mode has three Mastery camos, earned in order through long challenges
// that count kills with any weapon (so they're tracked once, not per gun).
// `req` is shown under each camo; null = not published yet.
const DIVERGENCE = { key: 'divergence', label: 'Divergence', color: '#ff5fa2' };

const MASTERY_CAMOS = {
  mp: [
    { key: 'mercurial-drift', label: 'Mercurial Drift', color: '#c3ccd6', req: '10 kills in a match, 250 times' },
    { key: 'polyatomic-reforged', label: 'Polyatomic Reforged', color: '#a77df2', req: '3 kills without taking damage, 300 times' },
    { key: 'orion-reforged', label: 'Orion Reforged', color: '#ffffff', req: '5 kills without dying, 500 times' }
  ],
  wz: [
    { key: 'parallax', label: 'Parallax', color: '#e8833a', req: null },
    { key: 'damascus-reforged', label: 'Damascus Reforged', color: '#9aa0a6', req: null },
    { key: 'empyros', label: 'Empyros', color: '#ffffff', req: null }
  ],
  dmz: [
    { key: 'chiral', label: 'Chiral', color: '#5cc8b8', req: null },
    { key: 'ripple-tide', label: 'Ripple Tide', color: '#4f8fe6', req: null },
    { key: 'helio', label: 'Helio', color: '#ffffff', req: '25,000 kills with Legendary weapons on a max-level Operator' }
  ]
};

// ============================================================
// ONE-TIME RESETS OF OUTDATED DATA
// ============================================================
// v2 cleared pre-launch placeholder data. v3 clears progress saved under
// the old model (three mastery camos ticked per weapon, per mode), which
// doesn't map onto the real Gold/Platinum/Harmonic Break track. Mapfam
// images and the chosen mode are kept. Bump only for changes that
// genuinely invalidate stored progress (adding weapons does not).
const DATA_VERSION = '3';
(function(){
  try{
    if(localStorage.getItem('mw4camo-data-version') === DATA_VERSION) return;
    ['mw4camo-progress', 'mw4camo-grindlist', 'mw4camo-recent', 'mw4camo-celebrated', 'mw4camo-mastery'].forEach(base => {
      localStorage.removeItem(base);
      MODES.forEach(m => localStorage.removeItem(base + '-' + m.key));
    });
    localStorage.setItem('mw4camo-data-version', DATA_VERSION);
  }catch(e){}
})();
