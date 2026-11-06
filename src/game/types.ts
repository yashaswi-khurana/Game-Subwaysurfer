export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export type PowerUpType = 'jetpack' | 'magnet' | 'sneakers' | 'multiplier' | 'hoverboard_pickup';

export interface CharacterSkin {
  id: string;
  name: string;
  tagline: string;
  hoodieColor: string;
  vestColor: string;
  pantsColor: string;
  capColor: string;
  shoeColor: string;
  boardColor: string;
  boardGlow: string;
  badgeBg: string;
}

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 'jake',
    name: 'JAKE',
    tagline: 'Original Yard Tagger',
    hoodieColor: '#f8fafc',
    vestColor: '#2563eb',
    pantsColor: '#1e3a8a',
    capColor: '#ef4444',
    shoeColor: '#22c55e',
    boardColor: '#f43f5e',
    boardGlow: '#38bdf8',
    badgeBg: 'from-red-500 to-blue-600',
  },
  {
    id: 'tricky',
    name: 'TRICKY',
    tagline: 'Beat-Break Stylist',
    hoodieColor: '#ef4444',
    vestColor: '#ffffff',
    pantsColor: '#2563eb',
    capColor: '#dc2626',
    shoeColor: '#facc15',
    boardColor: '#06b6d4',
    boardGlow: '#facc15',
    badgeBg: 'from-cyan-400 to-rose-500',
  },
  {
    id: 'fresh',
    name: 'FRESH',
    tagline: 'Boombox Funk King',
    hoodieColor: '#a855f7',
    vestColor: '#06b6d4',
    pantsColor: '#312e81',
    capColor: '#facc15',
    shoeColor: '#f97316',
    boardColor: '#eab308',
    boardGlow: '#c084fc',
    badgeBg: 'from-amber-400 to-purple-600',
  },
  {
    id: 'neon',
    name: 'NOVA',
    tagline: 'Midnight Cyber Surfer',
    hoodieColor: '#111827',
    vestColor: '#ec4899',
    pantsColor: '#1f2937',
    capColor: '#10b981',
    shoeColor: '#ec4899',
    boardColor: '#10b981',
    boardGlow: '#f472b6',
    badgeBg: 'from-emerald-400 to-pink-600',
  },
];

export interface HighScoreEntry {
  id: string;
  tag: string;
  score: number;
  coins: number;
  distance: number;
  skinId: string;
  date: string;
  isPlayer?: boolean;
}

export interface ActivePowerUpTimers {
  jetpack: number;      // seconds left (max 7.5)
  magnet: number;       // seconds left (max 11)
  sneakers: number;     // seconds left (max 11)
  multiplier: number;   // seconds left (max 12)
  hoverboard: number;   // seconds left (max 10)
}

export const POWERUP_DURATIONS = {
  jetpack: 7.5,
  magnet: 11,
  sneakers: 11,
  multiplier: 12,
  hoverboard: 10,
} as const;

export interface FloatingCallout {
  id: number;
  text: string;
  subtext?: string;
  color: string;
}

export interface GameHUDData {
  score: number;
  coins: number;
  distance: number;
  multiplier: number;
  speedKmh: number;
  hoverboardsLeft: number;
  hoverboardCooldown: number;
  stumbleTimer: number; // > 0 means Inspector is right on your tail!
  bestCombo: number;
  currentCoinStreak: number;
  crashReason: string;
  powerups: ActivePowerUpTimers;
}
