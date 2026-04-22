'use client';

import { useState } from 'react';
import { Prediction, SPORTS } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  AlertTriangle,
  BarChart3,
  Swords,
  Zap,
  Brain,
  HeartPulse,
  CloudRain,
  ChevronDown,
  Trophy,
  Coins,
} from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import { ConfidenceBadge } from './ConfidenceMeter';
import { VenueLink } from './VenueLink';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { ProbabilityBar } from './ProbabilityBar';
import { PickDistributionBar } from './PickDistributionBar';
import { ConnectedFavoriteButton } from './FavoriteButton';
import { ShareButton } from './ShareButton';
import { BettingSuggestionsSection } from './BettingSuggestionsSection';
import { useStreak } from '@/hooks/use-streak';
import { usePickHistory } from '@/hooks/use-pick-history';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

interface PredictionCardProps {
  prediction: Prediction;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  defaultExpanded?: boolean;
}

export function PredictionCard({
  prediction,
  onAnalyze,
  isAnalyzing = false,
  defaultExpanded = false,
}: PredictionCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(defaultExpanded);
  const [analysisOpen, setAnalysisOpen] = useState(defaultExpanded);
  const [bettingOpen, setBettingOpen] = useState(defaultExpanded);
  const { recordPick, hasPickedToday, currentStreak } = useStreak();
  const { addPick, getPick } = usePickHistory();

  const game = prediction.game;
  if (!game) return null;

  const userPick = getPick(prediction.gameId);

  const handleMakePick = () => {
    addPick({
      gameId: prediction.gameId,
      sport: game.sport,
      pick: 'home',
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      gameTime: new Date(game.startTime).getTime(),
      confidence: prediction.confidence,
    });

    if (!hasPickedToday) {
      recordPick();
      toast.success(
        currentStreak === 0
          ? '🔥 Serie pornită!'
          : `🔥 Serie de ${currentStreak + 1} zile!`,
        {
          description: 'Continuă să faci predicții zilnic pentru a-ți menține seria!',
        }
      );
    }
  };

  const sportInfo = SPORTS[game.sport];
  const hasAnalysis = prediction.enhancedAnalysis || prediction.llmAnalysis;
  const hasBettingSuggestions =
    prediction.enhancedAnalysis?.bestBet ||
    (prediction.enhancedAnalysis?.bettingSuggestions?.length ?? 0) > 0;

  const predictedTeam =
    prediction.predictedWinner === 'home'
      ? game.homeTeam
      : prediction.predictedWinner === 'away'
        ? game.awayTeam
        : null;

  const formatRecord = (team: typeof game.homeTeam) => {
    if (!team.record) return null;
    const { wins, losses, draws } = team.record;
    return draws !== undefined ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (confidence >= 55) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const homeColor = game.homeTeam.primaryColor || sportInfo.color;
  const awayColor = game.awayTeam.primaryColor || '#6b7280';
  const predictedTeamColor = predictedTeam?.primaryColor || sportInfo.color;
  const isHighConfidence = prediction.confidence >= 75;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300 animate-fade-in-up team-accent-left card-interactive',
        isHighConfidence && 'high-confidence-glow'
      )}
      style={{
        '--team-color': predictedTeamColor,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="font-medium"
            style={{ backgroundColor: sportInfo.color, color: 'white' }}
          >
            {sportInfo.icon} {sportInfo.name}
          </Badge>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-1">
              {format(new Date(game.startTime), 'MMM d, h:mm a')}
            </span>
            <ConnectedFavoriteButton predictionId={prediction.id} size="sm" />
            <ShareButton
              title={`${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} Predicție`}
              text={`Verifică această predicție ${sportInfo.name}: ${predictedTeam?.name || 'Egal'} cu ${prediction.confidence}% încredere!`}
              size="sm"
            />
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Matchup Display */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 py-2">
          {/* Away Team */}
          <div
            className={cn(
              'flex flex-col items-center transition-opacity',
              prediction.predictedWinner === 'home' && 'opacity-60'
            )}
          >
            <TeamLogo team={game.awayTeam} size="lg" />
            <span
              className={cn(
                'font-medium mt-1.5 text-center text-sm sm:text-base',
                prediction.predictedWinner === 'away' && 'font-bold'
              )}
            >
              {game.awayTeam.abbreviation}
            </span>
          </div>

          {/* VS Divider */}
          <span className="text-lg font-bold text-muted-foreground">@</span>

          {/* Home Team */}
          <div
            className={cn(
              'flex flex-col items-center transition-opacity',
              prediction.predictedWinner === 'away' && 'opacity-60'
            )}
          >
            <TeamLogo team={game.homeTeam} size="lg" />
            <span
              className={cn(
                'font-medium mt-1.5 text-center text-sm sm:text-base',
                prediction.predictedWinner === 'home' && 'font-bold'
              )}
            >
              {game.homeTeam.abbreviation}
            </span>
          </div>
        </div>

        {/* Prediction Summary */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/50 border">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="font-semibold">
            {predictedTeam ? predictedTeam.name : 'Egal'}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className={cn('font-bold', getConfidenceColor(prediction.confidence))}>
            {prediction.confidence}%
          </span>
        </div>

        {/* Community Picks */}
        <PickDistributionBar
          gameId={prediction.gameId}
          homeTeam={game.homeTeam.abbreviation}
          awayTeam={game.awayTeam.abbreviation}
          homeColor={homeColor}
          awayColor={awayColor}
          showDraw={prediction.drawProbability !== undefined && prediction.drawProbability > 0}
          onPick={handleMakePick}
        />

        {/* Details Section */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="text-muted-foreground">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Detalii
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 mt-2">
              {/* Win Probability Bar */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Probabilitate Victorie
                </p>
                <ProbabilityBar
                  homeTeam={game.homeTeam.abbreviation}
                  awayTeam={game.awayTeam.abbreviation}
                  homeWinProbability={prediction.homeWinProbability * 100}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  size="md"
                />
                {prediction.drawProbability && prediction.drawProbability > 0 && (
                  <div className="text-center p-1.5 rounded-md bg-muted/30 text-sm">
                    <span className="text-muted-foreground">Egal: </span>
                    <span className="font-bold">
                      {(prediction.drawProbability * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Records */}
              <div className="flex justify-around text-sm text-muted-foreground">
                <div className="text-center">
                  <span className="font-medium">{game.awayTeam.abbreviation}</span>
                  <p>{formatRecord(game.awayTeam) || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="font-medium">{game.homeTeam.abbreviation}</span>
                  <p>{formatRecord(game.homeTeam) || 'N/A'}</p>
                </div>
              </div>

              {/* Key Factors */}
              {prediction.factors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Factori Cheie
                  </p>
                  <div className="space-y-1">
                    {prediction.factors.slice(0, 3).map((factor, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {factor.value > 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        ) : factor.value < 0 ? (
                          <TrendingDown className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground">{factor.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Venue */}
              {game.venue && (
                <div className="pt-2 border-t">
                  <VenueLink venueName={game.venue} sport={game.sport} />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* AI Analysis Section */}
        <Collapsible open={analysisOpen} onOpenChange={setAnalysisOpen}>
          <CollapsibleTrigger className="text-muted-foreground">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Analiză AI
              {!hasAnalysis && !isAnalyzing && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Click pentru generare
                </Badge>
              )}
              {isAnalyzing && <Spinner size="sm" className="ml-2" />}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 mt-2">
              {/* Show analyze button if no analysis */}
              {!hasAnalysis && !isAnalyzing && onAnalyze && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnalyze();
                  }}
                  className="w-full py-2.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors flex items-center justify-center gap-2 border border-dashed"
                >
                  <Sparkles className="h-4 w-4" />
                  Generează Analiză AI
                </button>
              )}

              {/* Loading state */}
              {isAnalyzing && (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                  <Spinner size="md" />
                  <span className="text-sm">Se analizează meciul...</span>
                </div>
              )}

              {/* Enhanced Analysis Display */}
              {hasAnalysis && prediction.enhancedAnalysis && (
                <div className="space-y-3">
                  {/* Preview */}
                  <p className="text-sm text-foreground leading-relaxed">
                    {prediction.enhancedAnalysis.preview}
                  </p>

                  {/* Key Insights */}
                  {prediction.enhancedAnalysis.bullets.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          Insight-uri Cheie
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {prediction.enhancedAnalysis.bullets.map((bullet, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {prediction.enhancedAnalysis.risks.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          Atenție
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {prediction.enhancedAnalysis.risks.map((risk, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500"
                          >
                            <span className="mt-1">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Matchup */}
                  {prediction.enhancedAnalysis.keyMatchup && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Swords className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-400 uppercase">
                          Duelul Cheie
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {prediction.enhancedAnalysis.keyMatchup}
                      </p>
                    </div>
                  )}

                  {/* X-Factor */}
                  {prediction.enhancedAnalysis.xFactor && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">
                          Factorul X
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {prediction.enhancedAnalysis.xFactor}
                      </p>
                    </div>
                  )}

                  {/* Confidence Rationale */}
                  {prediction.enhancedAnalysis.confidenceRationale && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain className="h-3.5 w-3.5 text-cyan-600" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          De Ce Această Încredere
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {prediction.enhancedAnalysis.confidenceRationale}
                      </p>
                    </div>
                  )}

                  {/* Injury & Weather Impact */}
                  <div className="space-y-2">
                    {prediction.enhancedAnalysis.injuryImpact && (
                      <div className="flex items-start gap-2 text-sm">
                        <HeartPulse className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            Accidentați:
                          </span>{' '}
                          {prediction.enhancedAnalysis.injuryImpact}
                        </span>
                      </div>
                    )}
                    {prediction.enhancedAnalysis.weatherImpact && (
                      <div className="flex items-start gap-2 text-sm">
                        <CloudRain className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            Vreme:
                          </span>{' '}
                          {prediction.enhancedAnalysis.weatherImpact}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fallback to plain text analysis */}
              {hasAnalysis && !prediction.enhancedAnalysis && prediction.llmAnalysis && (
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {prediction.llmAnalysis}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Betting Suggestions Section */}
        {(hasAnalysis && hasBettingSuggestions) && (
          <Collapsible open={bettingOpen} onOpenChange={setBettingOpen}>
            <CollapsibleTrigger className="text-muted-foreground">
              <span className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-500" />
                Sugestii Pariuri
                <Badge variant="secondary" className="ml-1 text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                  Nou
                </Badge>
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2">
                <BettingSuggestionsSection
                  bettingSuggestions={prediction.enhancedAnalysis?.bettingSuggestions}
                  bestBet={prediction.enhancedAnalysis?.bestBet}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Show betting button if analysis exists but no suggestions yet */}
        {hasAnalysis && !hasBettingSuggestions && onAnalyze && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze();
            }}
            className="w-full py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-md transition-colors flex items-center justify-center gap-2 border border-dashed border-emerald-300"
          >
            <Coins className="h-4 w-4" />
            Generează Sugestii Pariuri
          </button>
        )}
      </CardContent>
    </Card>
  );
}