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
// Unlock rules, from Activision's "Ready for Launch: Progression and
// Prestige" post (Oct 2026). `gate` is what the tier needs on OTHER weapons,
// on top of the tier before it on this weapon:
//   Gold           - this weapon's 3 Special (weapon-specific) challenges
//   Platinum       - Gold on every weapon in the same class      ('class')
//   Harmonic Break - Platinum on all weapons in the game          ('all')
// `hint` is the challenge shown when hovering a tier, per mode.
//
// `color` is the accent used for bars, outlines and tile borders; `swatch`
// is the filled chip once earned, matched to the in-game camo previews.
const CAMO_TIERS = [
  { key: 'gold', label: 'Gold', color: '#fecf41', gate: null,
    swatch: 'linear-gradient(135deg, #e0b04a 0%, #b7862f 55%, #8c6420 100%)',
    hint: { mp: '15 player kills in a single match', dmz: '100 kills in a single DMZ match' } },
  { key: 'platinum', label: 'Platinum', color: '#b8bbbe', gate: 'class',
    swatch: 'linear-gradient(135deg, #d4d6d8 0%, #9c9fa2 55%, #75787b 100%)', hint: null },
  { key: 'harmonic-break', label: 'Harmonic Break', color: '#e8435a', gate: 'all',
    swatch: 'linear-gradient(115deg, #34343a 0 32%, #e8435a 32% 48%, #ff8a98 48% 51%, #e8435a 51% 68%, #34343a 68%)', hint: null }
];

// Platinum and Harmonic Break challenges for each weapon class, as shown
// in-game (Multiplayer wording). A missing entry just shows no hint.
const CLASS_CHALLENGES = {
  'Assault Rifle': { 'platinum': '50 headshots against players', 'harmonic-break': '25 double kills against players' },
  'SMG': { 'platinum': '25 player kills from behind', 'harmonic-break': '50 hipfire kills against players' },
  'Shotgun': { 'platinum': '50 hipfire kills against players', 'harmonic-break': '2 player kills without reloading, 25 times' },
  'LMG': { 'platinum': '3 player kills without dying, 15 times', 'harmonic-break': '2 player kills without releasing the trigger, 25 times' },
  'Marksman Rifle': { 'platinum': '75 player kills while prone', 'harmonic-break': '75 one-shot kills against players' },
  'Sniper Rifle': { 'platinum': '75 player kills while prone', 'harmonic-break': '75 one-shot kills against players' },
  'Pistol': { 'platinum': '20 player kills from behind', 'harmonic-break': '40 hipfire kills against players' },
  'Launcher': { 'platinum': '2 player kills without taking damage, 15 times', 'harmonic-break': '10 player kills in a match, 7 times' },
  'Melee': { 'platinum': '3 kills without dying against players, 15 times', 'harmonic-break': '25 player kills from behind' }
};

// Per-weapon Weapon Prestige camos (official). Optional extra track: shown
// on each card but not counted in any percentage or unlock rule.
const PRESTIGE_CAMOS = [
  { key: 'pyroclast', label: 'Pyroclast', short: 'Pyroclast', req: 'Weapon Prestige 1, level 1', color: '#5d6b4a' },
  { key: 'pyroclast-terminus', label: 'Pyroclast Terminus', short: 'Terminus', req: 'Weapon Prestige 1, max level', color: '#6f8f3a' },
  { key: 'pyroclast-scatter', label: 'Pyroclast Scatter', short: 'Scatter', req: 'Prestige Master level 150', color: '#8fbf45' },
  { key: 'pyroclast-cascade', label: 'Pyroclast Cascade', short: 'Cascade', req: 'Prestige Master level 250', color: '#c8f08a' }
];

// The challenge text for a tier in the current mode (Warzone has no camo
// challenges until Season 1, so it shows the Multiplayer and DMZ ones).
// Class challenges are Multiplayer figures, so they're labelled as such
// in other modes.
function tierHint(tier, weapon){
  const cls = weapon && CLASS_CHALLENGES[weapon.class];
  if(cls && cls[tier.key]){
    return cls[tier.key] + (getCurrentMode() === 'mp' ? '' : ' (Multiplayer)');
  }
  if(!tier.hint) return '';
  const mode = getCurrentMode();
  if(tier.hint[mode]) return tier.hint[mode];
  return Object.keys(tier.hint).map(k => tier.hint[k]).join(' or ');
}

// ============================================================
// DIVERGENCE + MASTERY CAMOS (account-wide)
// ============================================================
// Divergence unlocks once every weapon has Harmonic Break. After that each
// mode has three Mastery camos, earned in order through long challenges
// that count kills with any weapon (so they're tracked once, not per gun).
// `color` is the accent (outline, Recent dot); `swatch` is the filled look
// once earned, matched to the in-game camo previews.
// `req` is shown under each camo (official for Multiplayer and DMZ);
// null = not published yet (Warzone, until Season 1).
const DIVERGENCE = { key: 'divergence', label: 'Divergence', color: '#4fb3e8',
  swatch: 'radial-gradient(circle, #3fa9e0 0 2px, transparent 2.5px) 0 0/14px 11px, radial-gradient(circle, #f2c230 0 1.5px, transparent 2px) 5px 4px/17px 13px, radial-gradient(circle, #5cc860 0 2px, transparent 2.5px) 9px 7px/21px 15px, radial-gradient(circle, #e0453a 0 1.5px, transparent 2px) 3px 9px/19px 12px, radial-gradient(circle, #3a6fd8 0 1.5px, transparent 2px) 11px 2px/23px 17px, #121316' };

const MASTERY_CAMOS = {
  mp: [
    { key: 'mercurial-drift', label: 'Mercurial Drift', color: '#f0569a', swatch: 'linear-gradient(135deg, #f7d23a 0%, #f58a3c 30%, #f0569a 60%, #9b3bd6 100%)', req: '10 kills in a match, 250 times' },
    { key: 'polyatomic-reforged', label: 'Polyatomic Reforged', color: '#8c8fe0', swatch: 'linear-gradient(135deg, #2f3388 0%, #9da0ea 35%, #4a4fb0 60%, #c6c4f2 80%, #2a2d6e 100%)', req: '3 kills without taking damage, 300 times' },
    { key: 'orion-reforged', label: 'Orion Reforged', color: '#d0452e', swatch: 'radial-gradient(circle at 65% 55%, #e0603a 0%, #8a1d24 30%, #2a0a10 65%, #0d0507 100%)', req: '5 kills without dying, 500 times' }
  ],
  wz: [
    { key: 'parallax', label: 'Parallax', color: '#e8833a', req: null },
    { key: 'damascus-reforged', label: 'Damascus Reforged', color: '#9aa0a6', req: null },
    { key: 'empyros', label: 'Empyros', color: '#ffffff', req: null }
  ],
  dmz: [
    { key: 'chiral', label: 'Chiral', color: '#c0182a', swatch: 'radial-gradient(circle at 40% 40%, #d0202f 0%, #7a0b14 45%, #2e0407 100%)', req: '2,500 Tier 3+ enemy kills' },
    { key: 'ripple-tide', label: 'Ripple Tide', color: '#d6a531', swatch: 'linear-gradient(160deg, #1a1408 10%, #e0b445 40%, #6b4f14 60%, #1a1408 90%)', req: 'Exfil 2 lieutenant dog tags in one deployment, 50 times' },
    { key: 'helio', label: 'Helio', color: '#ff3b47', swatch: 'linear-gradient(150deg, #6a0d12 0%, #9c1a1f 44%, #ff6b70 50%, #9c1a1f 56%, #4a080c 100%)', req: '25,000 kills with Legendary weapons on a max-level Operator' }
  ]
};

// ============================================================
// KEEPING PROGRESS SAFE
// ============================================================
// Progress is never cleared because the site's data or rules change:
//   - Unlock rules (`gate`, the tier order) only decide what can be ticked
//     NEXT. A camo that's already ticked always stays ticked and shown as
//     earned, even if a rule changes so that it would now count as locked.
//   - Stored progress is never pruned. Data for a weapon or camo the site
//     no longer lists stays in storage, and comes back if it's re-added.
//   - Renamed weapons: add 'Old Name': 'New Name' to WEAPON_RENAMES and the
//     progress is moved across on the next visit (merged, never overwritten).
//   - Camo `key`s (e.g. 'harmonic-break') are what's stored. Labels can be
//     changed freely; keys must never change.
//   - Only the user's own actions clear anything (unticking, with Undo;
//     Reset; loading a code or file, which saves a restore point first).
//
// DATA_VERSION only marks the data layout. Never bump it to clear
// progress; add a migration below instead.
const DATA_VERSION = '3';
const WEAPON_RENAMES = {
  // 'Old Name': 'New Name',
};

function migrateProgressData(){
  // Moves progress saved under an old weapon name to the new name.
  function renameIn(key, kind){
    const raw = localStorage.getItem(key);
    if(!raw) return;
    let data;
    try{ data = JSON.parse(raw); }catch(e){ return; }
    let changed = false;
    Object.keys(WEAPON_RENAMES).forEach(oldName => {
      const newName = WEAPON_RENAMES[oldName];
      if(kind === 'progress' && data[oldName]){
        data[newName] = Object.assign({}, data[oldName], data[newName] || {});
        Object.keys(data[oldName]).forEach(k => { if(data[oldName][k]) data[newName][k] = true; });
        delete data[oldName];
        changed = true;
      }else if(kind === 'list' && Array.isArray(data) && data.includes(oldName)){
        data = data.map(n => n === oldName ? newName : n).filter((n, i, arr) => arr.indexOf(n) === i);
        changed = true;
      }else if(kind === 'log' && Array.isArray(data)){
        data.forEach(e => { if(e && e.name === oldName){ e.name = newName; changed = true; } });
      }
    });
    if(changed) localStorage.setItem(key, JSON.stringify(data));
  }
  renameIn('mw4camo-progress', 'progress');
  renameIn('mw4camo-grindlist', 'list');
  renameIn('mw4camo-recent', 'log');
}

(function(){
  try{
    const stored = localStorage.getItem('mw4camo-data-version');
    // The one historical reset: data from before launch (no version, or v1-2)
    // used placeholder weapons/camos that don't exist in MW4. It's archived
    // rather than deleted. Nothing saved since launch (v3+) is ever touched.
    if(stored !== null && Number(stored) < 3){
      const archive = {};
      ['mw4camo-progress', 'mw4camo-grindlist', 'mw4camo-recent', 'mw4camo-celebrated', 'mw4camo-mastery'].forEach(base => {
        [base].concat(MODES.map(m => base + '-' + m.key)).forEach(k => {
          const v = localStorage.getItem(k);
          if(v !== null){ archive[k] = v; localStorage.removeItem(k); }
        });
      });
      if(Object.keys(archive).length) localStorage.setItem('mw4camo-archive-prelaunch', JSON.stringify(archive));
    }
    if(stored === null || Number(stored) < Number(DATA_VERSION)){
      localStorage.setItem('mw4camo-data-version', DATA_VERSION);
    }
    migrateProgressData();
  }catch(e){}
})();
