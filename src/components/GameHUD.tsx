import React from 'react';
import {
  Pause,
  Volume2,
  VolumeX,
  Music,
  Shield,
  Zap,
  Magnet,
  Star,
  Rocket,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import { FloatingCallout, GameHUDData, POWERUP_DURATIONS } from '../game/types';

interface GameHUDProps {
  hud: GameHUDData;
  highScore: number;
  callouts: FloatingCallout[];
  sfxOn: boolean;
  musicOn: boolean;
  onPause: () => void;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onActivateHoverboard: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  highScore,
  callouts,
  sfxOn,
  musicOn,
  onPause,
  onToggleSfx,
  onToggleMusic,
  onActivateHoverboard,
}) => {
  const activePowerupList = [
    {
      key: 'jetpack',
      label: 'SPRAY JETPACK',
      time: hud.powerups.jetpack,
      max: POWERUP_DURATIONS.jetpack,
      color: 'from-cyan-400 to-orange-500',
      icon: Rocket,
    },
    {
      key: 'hoverboard',
      label: 'CRASH SHIELD',
      time: hud.powerups.hoverboard,
      max: POWERUP_DURATIONS.hoverboard,
      color: 'from-pink-500 to-cyan-400',
      icon: Shield,
    },
    {
      key: 'magnet',
      label: 'COIN MAGNET',
      time: hud.powerups.magnet,
      max: POWERUP_DURATIONS.magnet,
      color: 'from-red-500 to-rose-400',
      icon: Magnet,
    },
    {
      key: 'sneakers',
      label: 'SUPER SNEAKERS',
      time: hud.powerups.sneakers,
      max: POWERUP_DURATIONS.sneakers,
      color: 'from-lime-400 to-emerald-500',
      icon: Zap,
    },
    {
      key: 'multiplier',
      label: '2X SCORE STAR',
      time: hud.powerups.multiplier,
      max: POWERUP_DURATIONS.multiplier,
      color: 'from-purple-500 to-amber-400',
      icon: Star,
    },
  ].filter((p) => p.time > 0.05);

  const canUseBoard =
    hud.hoverboardsLeft > 0 &&
    hud.powerups.hoverboard <= 0 &&
    hud.powerups.jetpack <= 0 &&
    hud.hoverboardCooldown <= 0;

  const isBeatingRecord = hud.score > highScore && highScore > 0;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Orange edge danger vignette when Inspector is right behind you after a Stumble */}
      {hud.stumbleTimer > 0 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            boxShadow: 'inset 0 0 85px rgba(249, 115, 22, 0.55)',
          }}
        />
      )}

      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left Controls & Inspector Warning */}
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onPause}
              title="Pause (P / Esc)"
              className="btn-arcade w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 border-2 border-slate-950 flex items-center justify-center text-slate-950 cursor-pointer"
            >
              <Pause className="w-5 h-5 fill-slate-950 stroke-[2.5]" />
            </button>

            <button
              onClick={onToggleSfx}
              title={sfxOn ? 'Mute SFX' : 'Enable SFX'}
              className={`btn-arcade w-10 h-10 rounded-xl border-2 border-slate-950 flex items-center justify-center cursor-pointer ${
                sfxOn
                  ? 'bg-slate-800/90 text-cyan-300'
                  : 'bg-slate-900/90 text-slate-500'
              }`}
            >
              {sfxOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onToggleMusic}
              title={musicOn ? 'Mute Funk Beat' : 'Enable Funk Beat'}
              className={`btn-arcade w-10 h-10 rounded-xl border-2 border-slate-950 flex items-center justify-center cursor-pointer ${
                musicOn
                  ? 'bg-slate-800/90 text-pink-400'
                  : 'bg-slate-900/90 text-slate-500'
              }`}
            >
              <Music className="w-4 h-4" />
            </button>
          </div>

          {hud.stumbleTimer > 0 && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 border-2 border-slate-950 rounded-xl px-3 py-1.5 shadow-lg animate-pulse">
              <AlertTriangle className="w-4 h-4 text-yellow-200 shrink-0" />
              <span className="font-arcade text-xs text-yellow-100 tracking-wide">
                INSPECTOR CLOSE! {hud.stumbleTimer.toFixed(1)}s
              </span>
            </div>
          )}
        </div>

        {/* Top-Right Score, Multiplier & Coins */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {/* Multiplier Badge */}
            <div
              className={`px-3 py-1.5 rounded-2xl border-2 border-slate-950 shadow-lg flex items-center gap-1 font-arcade text-sm sm:text-base ${
                hud.powerups.multiplier > 0
                  ? 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-amber-400 text-white animate-pulse'
                  : 'bg-gradient-to-b from-amber-300 to-orange-500 text-slate-950'
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
              <span>x{hud.multiplier}</span>
            </div>

            {/* Main Score Pill */}
            <div className="panel-arcade bg-slate-900/90 backdrop-blur-md rounded-2xl px-4 py-1.5 flex flex-col items-end min-w-[132px] sm:min-w-[164px]">
              <div className="flex items-center gap-1.5">
                {isBeatingRecord && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                    NEW BEST
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  SCORE
                </span>
              </div>
              <span className="font-score font-extrabold text-xl sm:text-2xl text-white leading-tight tracking-tight">
                {hud.score.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Coins & Distance Row */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-900/88 border-2 border-slate-950 rounded-xl px-3 py-1 flex items-center gap-1.5 shadow">
              <span className="text-xs font-bold text-slate-400">{hud.distance}m</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-bold text-cyan-300">{hud.speedKmh} km/h</span>
            </div>

            <div className="bg-slate-900/90 border-2 border-slate-950 rounded-xl px-3 py-1 flex items-center gap-1.5 shadow">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 border border-slate-950 flex items-center justify-center">
                <Coins className="w-3 h-3 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="font-score font-extrabold text-sm sm:text-base text-amber-300">
                {hud.coins}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING JUICY CALLOUTS (Upper Center) */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 pointer-events-none z-30 w-full max-w-md px-4">
        {callouts.map((c) => (
          <div
            key={c.id}
            className="animate-callout absolute left-1/2 top-0 flex flex-col items-center text-center whitespace-nowrap"
          >
            <span
              className="font-arcade text-xl sm:text-3xl text-stroke-md tracking-wide"
              style={{ color: c.color }}
            >
              {c.text}
            </span>
            {c.subtext && (
              <span className="mt-0.5 px-2.5 py-0.5 rounded-full bg-slate-950/85 text-xs font-bold text-white border border-white/15">
                {c.subtext}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* BOTTOM BAR: Active Power-Up Timers & Hoverboard Trigger */}
      <div className="flex items-end justify-between gap-3">
        {/* Active Power-Up Gauges */}
        <div className="flex flex-col gap-2 w-48 sm:w-56">
          {activePowerupList.map((item) => {
            const Icon = item.icon;
            const pct = Math.min(100, Math.max(4, (item.time / item.max) * 100));
            return (
              <div
                key={item.key}
                className="bg-slate-900/90 backdrop-blur-md border-2 border-slate-950 rounded-xl p-2 shadow-lg"
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-white">
                    <Icon className="w-3.5 h-3.5 text-amber-300" />
                    {item.label}
                  </span>
                  <span className="font-score text-amber-300">{item.time.toFixed(1)}s</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-950">
                  <div
                    className={`h-full bg-gradient-to-r ${item.color} transition-all duration-75`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom-Right Hoverboard Quick Button */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <button
            onClick={onActivateHoverboard}
            disabled={!canUseBoard}
            className={`btn-arcade relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 border-slate-950 font-arcade text-xs sm:text-sm tracking-wide cursor-pointer ${
              hud.powerups.hoverboard > 0
                ? 'bg-gradient-to-r from-pink-500 to-cyan-500 text-white ring-2 ring-pink-300'
                : canUseBoard
                ? 'bg-gradient-to-b from-pink-500 to-rose-600 text-white'
                : 'bg-slate-800/80 text-slate-400 opacity-75 cursor-not-allowed'
            }`}
          >
            <Shield className="w-5 h-5" />
            <div className="flex flex-col items-start leading-tight">
              <span>
                {hud.powerups.hoverboard > 0
                  ? 'SHIELD ACTIVE'
                  : hud.hoverboardCooldown > 0
                  ? `RECHARGING ${hud.hoverboardCooldown}s`
                  : 'HOVERBOARD'}
              </span>
              <span className="font-sans text-[10px] font-bold opacity-85">
                SPACE / 2x TAP
              </span>
            </div>
            <span className="ml-1 px-2 py-0.5 rounded-lg bg-slate-950 text-amber-300 font-score text-xs font-extrabold">
              x{hud.hoverboardsLeft}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
