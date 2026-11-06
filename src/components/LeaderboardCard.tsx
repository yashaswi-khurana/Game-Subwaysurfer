import React from 'react';
import { Trophy, Coins, Crown, Sparkles } from 'lucide-react';
import { CHARACTER_SKINS, HighScoreEntry } from '../game/types';

interface LeaderboardCardProps {
  scores: HighScoreEntry[];
  highlightRank?: number | null;
  playerTag?: string;
  onTagChange?: (newTag: string) => void;
  compact?: boolean;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  scores,
  highlightRank = null,
  playerTag = '',
  onTagChange,
  compact = false,
}) => {
  const displayScores = compact ? scores.slice(0, 5) : scores.slice(0, 10);

  return (
    <div className="panel-arcade bg-slate-900/92 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 text-white w-full">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b-2 border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-slate-950 shadow">
            <Trophy className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-arcade text-sm sm:text-base tracking-wide text-amber-300 text-stroke-sm leading-none">
              TOP YARD SURFERS
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold">Local High-Score Board</p>
          </div>
        </div>
        {highlightRank && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 border-2 border-slate-950 animate-bounce">
            <Sparkles className="w-3 h-3" /> RANK #{highlightRank}
          </span>
        )}
      </div>

      {/* Inline Graffiti Tag customizer when player makes Top 10 */}
      {highlightRank && onTagChange && (
        <div className="mb-2.5 flex items-center justify-between gap-2 bg-amber-500/15 border border-amber-400/40 rounded-xl px-3 py-1.5">
          <span className="text-xs font-bold text-amber-200">YOUR GRAFFITI TAG:</span>
          <input
            type="text"
            maxLength={5}
            value={playerTag}
            onChange={(e) => onTagChange(e.target.value.toUpperCase())}
            placeholder="SURF"
            className="w-24 bg-slate-950 border-2 border-amber-400 rounded-lg px-2 py-0.5 text-center font-score font-extrabold text-sm text-amber-300 uppercase focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      )}

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
        {displayScores.map((entry, idx) => {
          const rank = idx + 1;
          const isHighlighted = highlightRank === rank;
          const skin = CHARACTER_SKINS.find((s) => s.id === entry.skinId) || CHARACTER_SKINS[0];

          const rankBadge =
            rank === 1
              ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950'
              : rank === 2
              ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950'
              : rank === 3
              ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white'
              : 'bg-slate-800 text-slate-300';

          return (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                isHighlighted
                  ? 'bg-gradient-to-r from-amber-500/25 via-pink-500/20 to-cyan-500/25 border-amber-400 shadow-md'
                  : 'bg-slate-800/65 border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg font-score text-xs font-extrabold flex items-center justify-center border border-slate-950 shrink-0 ${rankBadge}`}
                >
                  {rank === 1 ? <Crown className="w-3.5 h-3.5 stroke-[2.5]" /> : rank}
                </div>

                <span
                  className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${skin.badgeBg} shrink-0 ring-1 ring-white/40`}
                  title={skin.name}
                />

                <span
                  className={`font-arcade text-xs sm:text-sm tracking-wider truncate ${
                    isHighlighted ? 'text-amber-300' : 'text-white'
                  }`}
                >
                  {entry.tag}
                </span>

                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  {entry.distance}m
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300/90">
                  <Coins className="w-3 h-3 text-amber-400" />
                  {entry.coins}
                </span>
                <span className="font-score font-extrabold text-xs sm:text-sm text-cyan-300 min-w-[64px] text-right">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
