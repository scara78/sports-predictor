'use client';

import { BettingSuggestion } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TrendingUp, Star, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BettingConfidenceBadgeProps {
  confidence: BettingSuggestion['confidence'];
}

function BettingConfidenceBadge({ confidence }: BettingConfidenceBadgeProps) {
  const config = {
    'Scăzut': 'bg-rose-100 text-rose-700 border-rose-200',
    'Mediu': 'bg-amber-100 text-amber-700 border-amber-200',
    'Ridicat': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Foarte Ridicat': 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
      config[confidence]
    )}>
      {confidence}
    </span>
  );
}

interface BettingValueBadgeProps {
  value: BettingSuggestion['value'];
}

function BettingValueBadge({ value }: BettingValueBadgeProps) {
  const config = {
    'Standard': { cls: 'bg-muted text-muted-foreground', icon: null },
    'Valoare Bună': { cls: 'bg-amber-100 text-amber-700 border border-amber-200', icon: '⭐' },
    'Valoare Excelentă': { cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: '🔥' },
  };

  const { cls, icon } = config[value];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
      cls
    )}>
      {icon && <span>{icon}</span>}
      {value}
    </span>
  );
}

interface BestBetCardProps {
  bet: BettingSuggestion;
}

export function BestBetCard({ bet }: BestBetCardProps) {
  return (
    <div className={cn(
      'rounded-xl p-4 border-2 border-emerald-400',
      'bg-gradient-to-br from-emerald-50 to-green-50',
      'dark:from-emerald-950/40 dark:to-green-950/40 dark:border-emerald-600',
      'shadow-md shadow-emerald-500/10'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-emerald-600 fill-emerald-600" />
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
          🏆 Cel Mai Bun Pariu
        </span>
        <BettingValueBadge value={bet.value} />
      </div>

      <p className="font-bold text-base text-foreground mb-1">{bet.tip}</p>

      <div className="flex items-center gap-2 mb-2">
        <BettingConfidenceBadge confidence={bet.confidence} />
        {bet.odds && (
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            Cote: {bet.odds}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {bet.reasoning}
      </p>
    </div>
  );
}

interface BettingSuggestionItemProps {
  bet: BettingSuggestion;
  index: number;
}

function BettingSuggestionItem({ bet, index }: BettingSuggestionItemProps) {
  return (
    <div className={cn(
      'rounded-lg p-3 border transition-colors',
      'bg-card hover:bg-muted/30'
    )}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm flex-1">{bet.tip}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <BettingValueBadge value={bet.value} />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <BettingConfidenceBadge confidence={bet.confidence} />
        {bet.odds && (
          <span className="text-xs font-semibold text-primary">
            Cote: {bet.odds}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {bet.reasoning}
      </p>
    </div>
  );
}

interface BettingsuggestionsSectionProps {
  bettingSuggestions?: BettingSuggestion[];
  bestBet?: BettingSuggestion;
}

export function BettingSuggestionsSection({ bettingSuggestions, bestBet }: BettingsSuggestionsSectionProps) {
  const hasSuggestions = (bettingSuggestions && bettingSuggestions.length > 0) || bestBet;

  if (!hasSuggestions) return null;

  return (
    <div className="space-y-3">
      {/* Best Bet highlight */}
      {bestBet && <BestBetCard bet={bestBet} />}

      {/* Other suggestions */}
      {bettingSuggestions && bettingSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Alte Sugestii de Pariuri
            </span>
          </div>
          <div className="space-y-2">
            {bettingSuggestions.map((bet, i) => (
              <BettingSuggestionItem key={i} bet={bet} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>Sugestiile de pariuri sunt doar în scop informativ. Pariați responsabil.</span>
      </div>
    </div>
  );
}

// Fix typo in interface name
interface BettingsSuggestionsSectionProps {
  bettingSuggestions?: BettingSuggestion[];
  bestBet?: BettingSuggestion;
}