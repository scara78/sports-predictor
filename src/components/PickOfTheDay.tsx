'use client';

import { useState, useEffect, useRef } from 'react';
import { Prediction, SPORTS } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TeamLogo } from './TeamLogo';
import { ConfidenceBadge } from './ConfidenceMeter';
import { PickDistributionBar } from './PickDistributionBar';
import { useStreak } from '@/hooks/use-streak';
import { usePicks } from '@/hooks/use-picks';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Clock,
  Sparkles,
  Star,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';

interface PickOfTheDayProps {
  prediction: Prediction;
  className?: string;
  onViewDetails?: () => void;
}

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const targetTimeRef = useRef(targetDate.getTime());

  useEffect(() => {
    // Update ref if target date changes
    targetTimeRef.current = targetDate.getTime();

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetTimeRef.current - now.getTime();

      if (difference <= 0) {
        return null;
      }

      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

export function PickOfTheDay({
  prediction,
  className,
  onViewDetails,
}: PickOfTheDayProps) {
  const game = prediction.game;
  const { recordPick, hasPickedToday, currentStreak } = useStreak();
  const { getUserPick } = usePicks();

  if (!game) return null;

  const sportInfo = SPORTS[game.sport];
  const gameTime = new Date(game.startTime);
  const timeLeft = useCountdown(gameTime);
  const isLocked = !timeLeft; // Game has started
  const userPick = getUserPick(prediction.gameId);

  const predictedTeam =
    prediction.predictedWinner === 'home'
      ? game.homeTeam
      : prediction.predictedWinner === 'away'
        ? game.awayTeam
        : null;

  const handleMakePick = () => {
    if (!hasPickedToday) {
      recordPick();
      toast.success(
        currentStreak === 0
          ? 'Streak started!'
          : `${currentStreak + 1} day streak!`,
        {
          description: "You're on your way to becoming a prediction pro!",
        }
      );
    }
  };

  return (
    <Card
      className={cn(
        'overflow-hidden relative',
        'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50',
        'dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30',
        'border-2 border-amber-200 dark:border-amber-800',
        'shadow-lg shadow-amber-500/10',
        className
      )}
    >
      {/* Sparkle decorations */}
      <div className="absolute top-4 right-4 text-amber-400/50">
        <Sparkles className="h-8 w-8" />
      </div>
      <div className="absolute bottom-4 left-4 text-amber-400/30">
        <Star className="h-6 w-6" />
      </div>

      <CardContent className="p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="font-bold text-lg text-amber-800 dark:text-amber-200">
              Pick of the Day
            </span>
          </div>
          <Badge
            variant="secondary"
            className="font-medium"
            style={{ backgroundColor: sportInfo.color, color: 'white' }}
          >
            {sportInfo.icon} {sportInfo.name}
          </Badge>
        </div>

        {/* Matchup */}
        <div className="flex items-center justify-center gap-6 py-4">
          {/* Away Team */}
          <div
            className={cn(
              'flex flex-col items-center transition-opacity',
              prediction.predictedWinner === 'home' && 'opacity-60'
            )}
          >
            <TeamLogo team={game.awayTeam} size="xl" />
            <span className="font-semibold mt-2 text-center">
              {game.awayTeam.name}
            </span>
            {game.awayTeam.record && (
              <span className="text-sm text-muted-foreground">
                {game.awayTeam.record.wins}-{game.awayTeam.record.losses}
              </span>
            )}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-bold text-muted-foreground">@</span>
            {/* Countdown */}
            {timeLeft ? (
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                  {String(timeLeft.hours).padStart(2, '0')}:
                  {String(timeLeft.minutes).padStart(2, '0')}:
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>In Progress</span>
              </div>
            )}
          </div>

          {/* Home Team */}
          <div
            className={cn(
              'flex flex-col items-center transition-opacity',
              prediction.predictedWinner === 'away' && 'opacity-60'
            )}
          >
            <TeamLogo team={game.homeTeam} size="xl" />
            <span className="font-semibold mt-2 text-center">
              {game.homeTeam.name}
            </span>
            {game.homeTeam.record && (
              <span className="text-sm text-muted-foreground">
                {game.homeTeam.record.wins}-{game.homeTeam.record.losses}
              </span>
            )}
          </div>
        </div>

        {/* AI Prediction */}
        <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 mb-4 border border-amber-200/50 dark:border-amber-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">AI Prediction</p>
                <p className="text-xl font-bold">
                  {predictedTeam ? predictedTeam.name : 'Draw'}
                </p>
              </div>
            </div>
            <ConfidenceBadge confidence={prediction.confidence} className="text-base px-3 py-1" />
          </div>
        </div>

        {/* Pick Distribution */}
        <PickDistributionBar
          gameId={prediction.gameId}
          homeTeam={game.homeTeam.abbreviation}
          awayTeam={game.awayTeam.abbreviation}
          homeColor={game.homeTeam.primaryColor}
          awayColor={game.awayTeam.primaryColor}
          showDraw={prediction.drawProbability !== undefined && prediction.drawProbability > 0}
          interactive={!isLocked}
          onPick={handleMakePick}
          className="mb-4"
        />

        {/* Game Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{format(gameTime, 'EEEE, MMM d • h:mm a')}</span>
          {game.venue && <span>{game.venue}</span>}
        </div>

        {/* Action Button */}
        {onViewDetails && (
          <Button
            onClick={onViewDetails}
            variant="outline"
            className="w-full mt-4 group"
          >
            View Full Analysis
            <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}