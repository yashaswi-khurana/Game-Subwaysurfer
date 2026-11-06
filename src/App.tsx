import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Home,
  Volume2,
  VolumeX,
  Music,
  Coins,
  Crown,
  Trophy,
  Sparkles,
  Shield,
  Keyboard,
  Smartphone,
  Flame,
  MapPin,
} from 'lucide-react';
import {
  CHARACTER_SKINS,
  CharacterSkin,
  FloatingCallout,
  GameHUDData,
  GameState,
  HighScoreEntry,
} from './game/types';
import {
  addTotalCoins,
  loadAudioPrefs,
  loadHighScores,
  loadPlayerTag,
  loadSelectedSkinId,
  loadTotalCoins,
  saveAudioPrefs,
  saveHighScore,
  savePlayerTag,
  saveSelectedSkinId,
  updateSavedEntryTag,
} from './game/storage';
import { sound } from './game/audio';
import { SubwayEngine } from './game/SubwayEngine';
import { GameHUD } from './components/GameHUD';
import { LeaderboardCard } from './components/LeaderboardCard';

const INITIAL_HUD: GameHUDData = {
  score: 0,
  coins: 0,
  distance: 0,
  multiplier: 1,
  speedKmh: 74,
  hoverboardsLeft: 3,
  hoverboardCooldown: 0,
  stumbleTimer: 0,
  bestCombo: 0,
  currentCoinStreak: 0,
  crashReason: '',
  powerups: {
    jetpack: 0,
    magnet: 0,
    sneakers: 0,
    multiplier: 0,
    hoverboard: 0,
  },
};

export function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SubwayEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [hud, setHud] = useState<GameHUDData>(INITIAL_HUD);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);

  const [selectedSkin, setSelectedSkin] = useState<CharacterSkin>(() => {
    const savedId = loadSelectedSkinId();
    return CHARACTER_SKINS.find((s) => s.id === savedId) || CHARACTER_SKINS[0];
  });

  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() => loadHighScores());
  const [totalCoins, setTotalCoins] = useState<number>(() => loadTotalCoins());
  const [playerTag, setPlayerTag] = useState<string>(() => loadPlayerTag());
  const [lastRunRank, setLastRunRank] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [showFullBoardOnMenu, setShowFullBoardOnMenu] = useState<boolean>(false);

  const [sfxOn, setSfxOn] = useState<boolean>(() => loadAudioPrefs().sfx);
  const [musicOn, setMusicOn] = useState<boolean>(() => loadAudioPrefs().music);

  // Keep refs to current skin & playerTag for engine game-over callback
  const selectedSkinRef = useRef(selectedSkin);
  selectedSkinRef.current = selectedSkin;
  const playerTagRef = useRef(playerTag);
  playerTagRef.current = playerTag;

  useEffect(() => {
    sound.setPrefs(sfxOn, musicOn);
    saveAudioPrefs(sfxOn, musicOn);
  }, [sfxOn, musicOn]);

  const handleGameOver = useCallback((finalHud: GameHUDData) => {
    const updatedBank = addTotalCoins(finalHud.coins);
    setTotalCoins(updatedBank);

    const result = saveHighScore({
      tag: playerTagRef.current,
      score: finalHud.score,
      coins: finalHud.coins,
      distance: finalHud.distance,
      skinId: selectedSkinRef.current.id,
    });

    setHighScores(result.scores);
    setLastRunRank(result.rank);
    setIsNewBest(result.isNewBest);
  }, []);

  const handleCallout = useCallback((callout: FloatingCallout) => {
    setCallouts((prev) => [...prev.slice(-3), callout]);
    window.setTimeout(() => {
      setCallouts((prev) => prev.filter((item) => item.id !== callout.id));
    }, 1200);
  }, []);

  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new SubwayEngine(canvasContainerRef.current, selectedSkinRef.current, {
      onStateChange: (nextState) => {
        setGameState(nextState);
        if (nextState === 'playing') {
          setLastRunRank(null);
          setIsNewBest(false);
        }
      },
      onHUDUpdate: (nextHud) => {
        setHud(nextHud);
      },
      onCallout: handleCallout,
      onGameOver: handleGameOver,
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleCallout, handleGameOver]);

  const handleSelectSkin = (skin: CharacterSkin) => {
    setSelectedSkin(skin);
    saveSelectedSkinId(skin.id);
    engineRef.current?.setSkin(skin);
  };

  const handleStartGame = () => {
    setCallouts([]);
    engineRef.current?.startGame();
  };

  const handleTogglePause = () => {
    engineRef.current?.togglePause();
  };

  const handleReturnToMenu = () => {
    setCallouts([]);
    engineRef.current?.returnToMenu();
  };

  const handleTagEdit = (rawTag: string) => {
    const cleaned = rawTag.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5);
    setPlayerTag(cleaned);
    savePlayerTag(cleaned || 'SURF');
    if (lastRunRank !== null) {
      const updated = updateSavedEntryTag(highScores, lastRunRank, cleaned || 'SURF');
      setHighScores(updated);
    }
  };

  const toggleSfx = () => {
    sound.unlock();
    setSfxOn((prev) => !prev);
  };

  const toggleMusic = () => {
    sound.unlock();
    setMusicOn((prev) => {
      const next = !prev;
      if (next && gameState === 'playing') {
        window.setTimeout(() => sound.startMusic(), 20);
      }
      return next;
    });
  };

  const topScore = highScores.length > 0 ? highScores[0].score : 0;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Live 60fps Three.js 3D Subway World Canvas */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full" />

      {/* ==================== START SCREEN (MENU) ==================== */}
      {gameState === 'menu' && (
        <div className="relative z-20 w-full h-full flex flex-col justify-between p-3.5 sm:p-6 pointer-events-none">
          {/* Top Bar: Logo + Stash Stats + Audio Toggles */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Iconic Street-Art Logo Block */}
            <div className="pointer-events-auto flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 border-2 border-slate-950 shadow mb-1 -rotate-2">
                <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                <span className="font-arcade text-[11px] text-slate-950 tracking-wider">
                  3D ENDLESS RAIL RUNNER
                </span>
              </div>
              <h1 className="font-arcade text-3xl sm:text-5xl md:text-6xl leading-[0.95] tracking-tight text-stroke-lg">
                <span className="bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-500 bg-clip-text text-transparent pr-2">
                  SUBWAY
                </span>
                <span className="bg-gradient-to-b from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
                  SURFERS
                </span>
              </h1>
              <span className="mt-1 font-arcade text-xs sm:text-sm text-pink-400 text-stroke-sm tracking-widest pl-1">
                METRO DASH EDITION
              </span>
            </div>

            {/* Top-Right Stash, Record & Sound Buttons */}
            <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end">
              <div className="panel-arcade bg-slate-900/90 backdrop-blur-md rounded-2xl px-3.5 py-1.5 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">BEST</span>
                  <span className="font-score font-extrabold text-sm text-white">
                    {topScore.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="panel-arcade bg-slate-900/90 backdrop-blur-md rounded-2xl px-3.5 py-1.5 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">STASH</span>
                  <span className="font-score font-extrabold text-sm text-amber-300">
                    {totalCoins.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowFullBoardOnMenu((v) => !v)}
                title="View Top 10 High Scores"
                className={`btn-arcade h-11 px-3 rounded-2xl border-2 border-slate-950 flex items-center gap-1.5 font-arcade text-xs cursor-pointer ${
                  showFullBoardOnMenu
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800/95 text-amber-300'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">RANKS</span>
              </button>

              <button
                onClick={toggleSfx}
                title={sfxOn ? 'Mute Sound Effects' : 'Enable Sound Effects'}
                className={`btn-arcade w-11 h-11 rounded-2xl border-2 border-slate-950 flex items-center justify-center cursor-pointer ${
                  sfxOn ? 'bg-slate-800/95 text-cyan-300' : 'bg-slate-900/90 text-slate-500'
                }`}
              >
                {sfxOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleMusic}
                title={musicOn ? 'Mute Funk Beat' : 'Enable Funk Beat'}
                className={`btn-arcade w-11 h-11 rounded-2xl border-2 border-slate-950 flex items-center justify-center cursor-pointer ${
                  musicOn ? 'bg-slate-800/95 text-pink-400' : 'bg-slate-900/90 text-slate-500'
                }`}
              >
                <Music className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom / Split Dock: Leaderboard on Left (Desktop always, Mobile on RANKS toggle) + Crew & Play on Right */}
          <div className="mt-auto pt-2 flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-4">
            <div
              className={`pointer-events-auto w-full lg:max-w-sm ${
                showFullBoardOnMenu ? 'block' : 'hidden lg:block'
              }`}
            >
              <LeaderboardCard scores={highScores} compact={!showFullBoardOnMenu} />
            </div>

            {/* Right-side Controls & Crew Picker Dock */}
            <div className="pointer-events-auto w-full lg:max-w-md flex flex-col gap-3">
              {/* Surfer Crew Picker */}
              <div className="panel-arcade bg-slate-900/90 backdrop-blur-md rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-arcade text-xs text-cyan-300 tracking-wider">
                    SELECT SURFER & BOARD
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    {selectedSkin.tagline}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {CHARACTER_SKINS.map((skin) => {
                    const active = skin.id === selectedSkin.id;
                    return (
                      <button
                        key={skin.id}
                        onClick={() => handleSelectSkin(skin)}
                        className={`relative rounded-xl p-2 border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          active
                            ? 'bg-slate-800 border-amber-400 scale-105 shadow-lg'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${skin.badgeBg} border-2 border-slate-950 shadow`}
                        />
                        <span
                          className={`font-arcade text-[11px] tracking-wide ${
                            active ? 'text-amber-300' : 'text-slate-300'
                          }`}
                        >
                          {skin.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Controls Legend */}
              <div className="bg-slate-900/85 backdrop-blur-md border-2 border-slate-950 rounded-2xl px-3.5 py-2.5 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-lg">
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong className="text-white">WASD / Arrows</strong> Move, Jump & Roll
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    <strong className="text-white">Swipe</strong> &{' '}
                    <strong className="text-pink-400">Space / 2x Tap</strong> Shield
                  </span>
                </div>
              </div>

              {/* Giant Juicy PLAY Button */}
              <button
                onClick={handleStartGame}
                className="btn-arcade w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-lime-300 via-emerald-400 to-green-600 border-3 border-slate-950 flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Play className="w-7 h-7 text-slate-950 fill-slate-950 transition-transform group-hover:scale-110" />
                <span className="font-arcade text-2xl sm:text-3xl text-white text-stroke-md tracking-wider">
                  TAP TO PLAY!
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== IN-GAME HUD ==================== */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <GameHUD
          hud={hud}
          highScore={topScore}
          callouts={callouts}
          sfxOn={sfxOn}
          musicOn={musicOn}
          onPause={handleTogglePause}
          onToggleSfx={toggleSfx}
          onToggleMusic={toggleMusic}
          onActivateHoverboard={() => engineRef.current?.activateHoverboard()}
        />
      )}

      {/* ==================== PAUSE MODAL ==================== */}
      {gameState === 'paused' && (
        <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="panel-arcade bg-slate-900 rounded-3xl p-6 w-full max-w-sm text-center space-y-5">
            <div>
              <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-arcade text-xs mb-1">
                GAME PAUSED
              </span>
              <h2 className="font-arcade text-3xl text-white text-stroke-md">TAKE A BREATHER</h2>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-950/80 rounded-2xl p-3 border border-slate-800">
              <div>
                <div className="text-[10px] font-bold text-slate-400">SCORE</div>
                <div className="font-score font-extrabold text-base text-cyan-300">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">COINS</div>
                <div className="font-score font-extrabold text-base text-amber-300">
                  {hud.coins}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">DISTANCE</div>
                <div className="font-score font-extrabold text-base text-white">
                  {hud.distance}m
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleTogglePause}
                className="btn-arcade w-full py-3.5 rounded-2xl bg-gradient-to-b from-lime-300 to-green-500 border-2 border-slate-950 font-arcade text-xl text-white text-stroke-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-white" />
                RESUME RUN
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleStartGame}
                  className="btn-arcade py-3 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 border-2 border-slate-950 font-arcade text-sm text-slate-950 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                  RESTART
                </button>

                <button
                  onClick={handleReturnToMenu}
                  className="btn-arcade py-3 rounded-2xl bg-slate-800 border-2 border-slate-950 font-arcade text-sm text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  YARD MENU
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GAME OVER MODAL ==================== */}
      {gameState === 'gameover' && (
        <div className="fixed inset-0 z-40 bg-slate-950/78 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Left Column: Run Summary & Instant Replay */}
            <div className="md:col-span-7 panel-arcade bg-slate-900/95 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="text-center">
                {isNewBest ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 text-slate-950 font-arcade text-xs border-2 border-slate-950 mb-1.5 animate-gold-glow">
                    <Crown className="w-4 h-4 fill-slate-950" />
                    NEW ALL-TIME HIGH SCORE!
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs mb-1">
                    BUSTED IN THE YARD
                  </div>
                )}

                <h2 className="font-arcade text-3xl sm:text-4xl text-white text-stroke-md tracking-wide">
                  {isNewBest ? 'YARD KING!' : 'RUN OVER!'}
                </h2>
                {hud.crashReason && (
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold mt-1">
                    {hud.crashReason}
                  </p>
                )}
              </div>

              {/* Hero Final Score Banner */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-2 border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  FINAL SCORE
                </div>
                <div className="font-score font-extrabold text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-cyan-300 mt-0.5">
                  {hud.score.toLocaleString()}
                </div>
              </div>

              {/* 3 Stat Pills */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-800/75 border border-slate-700/70 rounded-2xl p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                    <Coins className="w-3.5 h-3.5 text-amber-400" /> COINS
                  </div>
                  <div className="font-score font-extrabold text-lg text-amber-300">
                    +{hud.coins}
                  </div>
                </div>

                <div className="bg-slate-800/75 border border-slate-700/70 rounded-2xl p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" /> DISTANCE
                  </div>
                  <div className="font-score font-extrabold text-lg text-white">
                    {hud.distance}m
                  </div>
                </div>

                <div className="bg-slate-800/75 border border-slate-700/70 rounded-2xl p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                    <Flame className="w-3.5 h-3.5 text-orange-400" /> STREAK
                  </div>
                  <div className="font-score font-extrabold text-lg text-orange-300">
                    {hud.bestCombo}
                  </div>
                </div>
              </div>

              {/* Pro Tip reminder */}
              <div className="flex items-center gap-2 bg-pink-500/10 border border-pink-500/25 rounded-xl px-3 py-2 text-xs text-pink-200">
                <Shield className="w-4 h-4 text-pink-400 shrink-0" />
                <span>
                  <strong>Pro Tip:</strong> Press <strong>SPACE</strong> or{' '}
                  <strong>Double-Tap</strong> to ride your Hoverboard Shield & smash straight
                  through trains!
                </span>
              </div>

              {/* Instant Action Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleReturnToMenu}
                  title="Back to Yard Menu"
                  className="btn-arcade px-4 py-3.5 rounded-2xl bg-slate-800 border-2 border-slate-950 font-arcade text-sm text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Home className="w-5 h-5" />
                  <span className="hidden sm:inline">YARD</span>
                </button>

                <button
                  onClick={handleStartGame}
                  className="btn-arcade flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-b from-lime-300 via-emerald-400 to-green-600 border-2 border-slate-950 font-arcade text-xl sm:text-2xl text-white text-stroke-sm flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <RotateCcw className="w-6 h-6 stroke-[2.8]" />
                  PLAY AGAIN
                </button>
              </div>
              <div className="text-center text-[11px] font-bold text-slate-400">
                Press <span className="text-amber-300">SPACE</span> or{' '}
                <span className="text-amber-300">ENTER</span> for instant restart
              </div>
            </div>

            {/* Right Column: Persistent Local Top-10 High-Score Table */}
            <div className="md:col-span-5">
              <LeaderboardCard
                scores={highScores}
                highlightRank={lastRunRank}
                playerTag={playerTag}
                onTagChange={handleTagEdit}
                compact={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
