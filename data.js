// PLACEHOLDER DATA
// Modern Warfare 4 launches Oct 23, 2026 and its weapon roster / camo challenges
// haven't been revealed yet. Until they are, this tracker is seeded with the
// Black Ops 6 launch weapon list (33 weapons) purely as a stand-in structure.
// Swap WEAPONS and CAMO_TIERS below once real MW4 data is announced.

const WEAPONS = [
  // Assault Rifles
  { name: 'XM4', class: 'Assault Rifle' },
  { name: 'AK-74', class: 'Assault Rifle' },
  { name: 'AMES 85', class: 'Assault Rifle' },
  { name: 'GPR 91', class: 'Assault Rifle' },
  { name: 'Model L', class: 'Assault Rifle' },
  { name: 'Goblin Mk2', class: 'Assault Rifle' },
  { name: 'AS VAL', class: 'Assault Rifle' },
  // SMGs
  { name: 'C9', class: 'SMG' },
  { name: 'KSV', class: 'SMG' },
  { name: 'Tanto .22', class: 'SMG' },
  { name: 'PP-919', class: 'SMG' },
  { name: 'Jackal PDW', class: 'SMG' },
  { name: 'Kompakt 92', class: 'SMG' },
  // Shotguns
  { name: 'Marine SP', class: 'Shotgun' },
  { name: 'ASG-89', class: 'Shotgun' },
  // LMGs
  { name: 'XMG', class: 'LMG' },
  { name: 'PU-21', class: 'LMG' },
  { name: 'GPMG-7', class: 'LMG' },
  // Marksman Rifles
  { name: 'SWAT 5.56', class: 'Marksman Rifle' },
  { name: 'Tsarkov 7.62', class: 'Marksman Rifle' },
  { name: 'AEK-973', class: 'Marksman Rifle' },
  { name: 'DM-10', class: 'Marksman Rifle' },
  // Sniper Rifles
  { name: 'LW3A1 Frostline', class: 'Sniper Rifle' },
  { name: 'SVD', class: 'Sniper Rifle' },
  { name: 'LR 7.62', class: 'Sniper Rifle' },
  // Pistols
  { name: 'GS45', class: 'Pistol' },
  { name: '9mm PM', class: 'Pistol' },
  { name: 'Grekhova', class: 'Pistol' },
  { name: 'Stryder .22', class: 'Pistol' },
  // Launchers
  { name: 'Launcher (Lock-On)', class: 'Launcher' },
  { name: 'Launcher (Free-Fire)', class: 'Launcher' },
  // Melee
  { name: 'Combat Knife', class: 'Melee' },
  { name: 'Baseball Bat', class: 'Melee' }
];

// Sequential mastery tiers. "Onyx" and "Nova" are placeholder names standing
// in for whatever MW4's actual top-tier camos turn out to be called.
// `color` drives both the tier-line progress bar and the checklist styling —
// update it here (not in CSS) when real tier names/colors are announced.
const CAMO_TIERS = [
  { key: 'gold', label: 'Gold', color: 'var(--rust)' },
  { key: 'platinum', label: 'Platinum', color: '#c9f1f0' },
  { key: 'onyx', label: 'Onyx', color: '#a8a9ab' },
  { key: 'nova', label: 'Nova', color: '#a8a9ab' }
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
