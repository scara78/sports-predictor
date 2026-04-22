'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Prediction, Sport, SPORTS } from '@/lib/types';
import { SportSelector } from '@/components/SportSelector';
import { AccuracyChart } from '@/components/AccuracyChart';
import { TeamLogo } from '@/components/TeamLogo';
import { ConfidenceBadge } from '@/components/ConfidenceMeter';
import { DateRangeFilter, DateRange, getDefaultDateRange } from '@/components/DateRangeFilter';
import { ErrorState } from '@/components/ErrorState';
import { Spinner } from '@/components/ui/spinner';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle, XCircle, TrendingUp, Target, Award, Trophy, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/components/DashboardLayout';
import { toast } from '@/components/ui/sonner';
import { AnimatedCounter, AnimatedPercentage } from '@/components/AnimatedCounter';
import { StreakBadge, calculateStreak } from '@/components/StreakBadge';

interface HistoryData {
  predictions: (Prediction & { wasCorrect: boolean })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    correct: number;
    accuracy: number;
  };
  sportStats: {
    sport: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  confidenceTiers: {
    name: string;
    min: number;
    max: number;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  dailyAccuracy: {
    date: string;
    accuracy: number;
    total: number;
  }[];
}

// Skeleton component for stats cards
function StatsCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// Skeleton for prediction row
function PredictionRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border animate-pulse">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-6 w-16 ml-auto" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { selectedSport: sidebarSport, setSelectedSport: setSidebarSport } = useDashboard();
  const [data, setData] = useState<HistoryData | null>(null);
  const [predictions, setPredictions] = useState<(Prediction & { wasCorrect: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  // Convert null to 'all' for the sport selector
  const selectedSport: Sport | 'all' = sidebarSport ?? 'all';

  const setSelectedSport = (sport: Sport | 'all') => {
    setSidebarSport(sport === 'all' ? null : sport);
  };

  // Fetch initial data - removed from useCallback to break dependency cycle
  const fetchHistory = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      setPage(1);
      pageRef.current = 1;
      setPredictions([]);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedSport !== 'all') {
        params.append('sport', selectedSport);
      }
      params.append('from', dateRange.from.toISOString());
      params.append('to', dateRange.to.toISOString());
      params.append('page', reset ? '1' : String(pageRef.current));
      params.append('limit', '20');

      const response = await fetch(`/api/history?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const result: HistoryData = await response.json();

      if (reset) {
        setData(result);
        setPredictions(result.predictions);
      } else {
        setPredictions(prev => [...prev, ...result.predictions]);
      }

      setHasMore(result.pagination.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      setError(message);
      toast.error('Error loading history', {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedSport, dateRange]);

  // Load more predictions for infinite scroll
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    pageRef.current += 1;
    setPage(pageRef.current);

    try {
      const params = new URLSearchParams();
      if (selectedSport !== 'all') {
        params.append('sport', selectedSport);
      }
      params.append('from', dateRange.from.toISOString());
      params.append('to', dateRange.to.toISOString());
      params.append('page', String(pageRef.current));
      params.append('limit', '20');

      const response = await fetch(`/api/history?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to load more predictions');
      }

      const result: HistoryData = await response.json();
      setPredictions(prev => [...prev, ...result.predictions]);
      setHasMore(result.pagination.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load more';
      toast.error('Error loading more predictions', {
        description: message,
      });
      // Revert page on error
      pageRef.current -= 1;
      setPage(pageRef.current);
    }
  }, [hasMore, loading, selectedSport, dateRange]);

  // Infinite scroll hook
  const { sentinelRef, isLoading: isLoadingMore } = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loading && !error,
  });

  useEffect(() => {
    fetchHistory(true);
  }, [fetchHistory]);

  // Get best performing sport safely
  const getBestSport = () => {
    if (!data?.sportStats?.length) return null;
    const sorted = [...data.sportStats].sort((a, b) => b.accuracy - a.accuracy);
    return sorted[0];
  };

  const bestSport = data ? getBestSport() : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prediction History</h1>
          <p className="text-muted-foreground">
            Track our prediction accuracy over time across all sports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button onClick={() => fetchHistory(true)} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sport Filter */}
      <SportSelector selectedSport={selectedSport} onSelect={setSelectedSport} />

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </div>
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <PredictionRowSkeleton />
              <PredictionRowSkeleton />
              <PredictionRowSkeleton />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <ErrorState
          title="Couldn't load history"
          message={error}
          onRetry={() => fetchHistory(true)}
        />
      )}

      {/* Stats Overview */}
      {!loading && !error && data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow card-interactive">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Predictions
                </CardTitle>
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-950">
                  <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <AnimatedCounter
                  value={data.stats.total}
                  className="text-3xl font-bold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {dateRange.label}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow card-interactive">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Accuracy
                </CardTitle>
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent>
                <AnimatedPercentage
                  value={data.stats.accuracy}
                  className="text-3xl font-bold text-emerald-600 dark:text-emerald-400"
                  delay={100}
                />
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {data.stats.correct} correct predictions
                  </p>
                  {predictions.length > 0 && (
                    <StreakBadge
                      {...calculateStreak(predictions.slice(0, 10).map(p => p.wasCorrect))}
                      size="sm"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow card-interactive">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Best Performing Sport
                </CardTitle>
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-950">
                  <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </CardHeader>
              <CardContent>
                {bestSport ? (
                  <>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <span className="text-3xl">
                        {SPORTS[bestSport.sport as Sport]?.icon}
                      </span>
                      {SPORTS[bestSport.sport as Sport]?.name}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <AnimatedPercentage value={bestSport.accuracy} delay={200} /> accuracy
                    </p>
                  </>
                ) : (
                  <div className="text-muted-foreground">No data yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <AccuracyChart
            dailyAccuracy={data.dailyAccuracy}
            sportStats={data.sportStats}
            confidenceTiers={data.confidenceTiers}
          />

          {/* Recent Predictions with Infinite Scroll */}
          {predictions.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Recent Predictions
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    Showing {predictions.length} of {data.pagination.total}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {predictions.map((prediction, index) => {
                    const game = prediction.game;
                    if (!game) return null;

                    const sportInfo = SPORTS[game.sport];
                    const predictedTeam =
                      prediction.predictedWinner === 'home'
                        ? game.homeTeam
                        : prediction.predictedWinner === 'away'
                          ? game.awayTeam
                          : null;

                    return (
                      <div
                        key={`${prediction.id}-${index}`}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          prediction.wasCorrect
                            ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 dark:hover:bg-emerald-950/40'
                            : 'bg-rose-50/50 border-rose-200 hover:bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 dark:hover:bg-rose-950/40'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Result Icon */}
                          <div className={`p-2 rounded-full ${
                            prediction.wasCorrect
                              ? 'bg-emerald-100 dark:bg-emerald-900'
                              : 'bg-rose-100 dark:bg-rose-900'
                          }`}>
                            {prediction.wasCorrect ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            )}
                          </div>

                          {/* Team Matchup with Logos */}
                          <div className="flex items-center gap-3">
                            <TeamLogo team={game.awayTeam} size="sm" />
                            <span className="text-sm text-muted-foreground">@</span>
                            <TeamLogo team={game.homeTeam} size="sm" />
                          </div>

                          {/* Details */}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                style={{ backgroundColor: sportInfo.color, color: 'white' }}
                                className="text-xs"
                              >
                                {sportInfo.icon}
                              </Badge>
                              <span className="font-medium text-sm">
                                {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">Pick:</span>
                              {predictedTeam && (
                                <TeamLogo team={predictedTeam} size="sm" className="scale-75" />
                              )}
                              <span className="text-xs font-medium">
                                {predictedTeam?.abbreviation || 'Draw'}
                              </span>
                              <ConfidenceBadge confidence={prediction.confidence} />
                            </div>
                          </div>
                        </div>

                        {/* Score & Date */}
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {game.awayScore} - {game.homeScore}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(prediction.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {/* Loading more indicator */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-6 gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-muted-foreground">Loading more predictions...</span>
                  </div>
                )}

                {/* End of list indicator */}
                {!hasMore && predictions.length > 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    You&apos;ve seen all {data.pagination.total} predictions
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <ErrorState
              variant="empty"
              title="No predictions yet"
              message="There are no predictions for the selected filters. Try adjusting the date range or sport filter."
            />
          )}
        </>
      )}

      {/* Empty data state */}
      {!loading && !error && !data && (
        <ErrorState
          variant="empty"
          title="No data available"
          message="Unable to load history data. Please try again."
          onRetry={() => fetchHistory(true)}
        />
      )}
    </div>
  );
}