import { HighScoreEntry } from './types';

const STORAGE_KEYS = {
  HIGH_SCORES: 'metro_surfers_highscores_v1',
  TOTAL_COINS: 'metro_surfers_total_coins_v1',
  SELECTED_SKIN: 'metro_surfers_skin_v1',
  PLAYER_TAG: 'metro_surfers_tag_v1',
  SOUND_ENABLED: 'metro_surfers_sound_v1',
  MUSIC_ENABLED: 'metro_surfers_music_v1',
};

const DEFAULT_SCORES: HighScoreEntry[] = [
  {
    id: 'seed-1',
    tag: 'JAKE',
    score: 18500,
    coins: 210,
    distance: 1120,
    skinId: 'jake',
    date: 'Yard Legend',
  },
  {
    id: 'seed-2',
    tag: 'TRKY',
    score: 12400,
    coins: 155,
    distance: 840,
    skinId: 'tricky',
    date: 'Crew Pro',
  },
  {
    id: 'seed-3',
    tag: 'FRSH',
    score: 7800,
    coins: 98,
    distance: 560,
    skinId: 'fresh',
    date: 'Beat King',
  },
  {
    id: 'seed-4',
    tag: 'NOVA',
    score: 4200,
    coins: 64,
    distance: 340,
    skinId: 'neon',
    date: 'Night Run',
  },
  {
    id: 'seed-5',
    tag: 'ROOK',
    score: 1500,
    coins: 28,
    distance: 145,
    skinId: 'jake',
    date: 'First Tag',
  },
];

export function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(DEFAULT_SCORES));
      return [...DEFAULT_SCORES];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 10);
    }
  } catch {
    // fallback if storage blocked
  }
  return [...DEFAULT_SCORES];
}

export function saveHighScore(entry: Omit<HighScoreEntry, 'id' | 'date'>): {
  scores: HighScoreEntry[];
  rank: number | null;
  isNewBest: boolean;
} {
  const existing = loadHighScores();
  const prevBest = existing.length > 0 ? existing[0].score : 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const newEntry: HighScoreEntry = {
    ...entry,
    tag: (entry.tag || 'YOU').toUpperCase().slice(0, 5),
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: dateStr,
    isPlayer: true,
  };

  const merged = [...existing, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const idx = merged.findIndex((item) => item.id === newEntry.id);
  const rank = idx !== -1 ? idx + 1 : null;

  try {
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }

  return {
    scores: merged,
    rank,
    isNewBest: entry.score > prevBest && entry.score > 0,
  };
}

export function updateSavedEntryTag(scores: HighScoreEntry[], rank: number, newTag: string): HighScoreEntry[] {
  const clean = (newTag.trim() || 'YOU').toUpperCase().slice(0, 5);
  const updated = scores.map((s, idx) => (idx === rank - 1 ? { ...s, tag: clean } : s));
  try {
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEYS.PLAYER_TAG, clean);
  } catch {
    // ignore
  }
  return updated;
}

export function loadTotalCoins(): number {
  try {
    const val = Number(localStorage.getItem(STORAGE_KEYS.TOTAL_COINS));
    return Number.isFinite(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function addTotalCoins(amount: number): number {
  const next = loadTotalCoins() + Math.max(0, Math.floor(amount));
  try {
    localStorage.setItem(STORAGE_KEYS.TOTAL_COINS, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadSelectedSkinId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_SKIN) || 'jake';
  } catch {
    return 'jake';
  }
}

export function saveSelectedSkinId(skinId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_SKIN, skinId);
  } catch {
    // ignore
  }
}

export function loadPlayerTag(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.PLAYER_TAG) || 'SURF';
  } catch {
    return 'SURF';
  }
}

export function savePlayerTag(tag: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_TAG, (tag.trim() || 'SURF').toUpperCase().slice(0, 5));
  } catch {
    // ignore
  }
}

export function loadAudioPrefs(): { sfx: boolean; music: boolean } {
  try {
    const sfx = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    const music = localStorage.getItem(STORAGE_KEYS.MUSIC_ENABLED);
    return {
      sfx: sfx === null ? true : sfx === 'true',
      music: music === null ? true : music === 'true',
    };
  } catch {
    return { sfx: true, music: true };
  }
}

export function saveAudioPrefs(sfx: boolean, music: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(sfx));
    localStorage.setItem(STORAGE_KEYS.MUSIC_ENABLED, String(music));
  } catch {
    // ignore
  }
}
