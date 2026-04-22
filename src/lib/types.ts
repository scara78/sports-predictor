// Sports and leagues
export type Sport = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'soccer';

export interface League {
  id: string;
  name: string;
  sport: Sport;
  country?: string;
}

export interface SportInfo {
  name: string;
  icon: string;
  color: string;
  logoUrl: string;
}

export const SPORTS: Record<Sport, SportInfo> = {
  nfl: {
    name: 'NFL',
    icon: '🏈',
    color: '#013369',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png',
  },
  nba: {
    name: 'NBA',
    icon: '🏀',
    color: '#C9082A',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
  },
  mlb: {
    name: 'MLB',
    icon: '⚾',
    color: '#002D72',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
  },
  nhl: {
    name: 'NHL',
    icon: '🏒',
    color: '#000000',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
  },
  soccer: {
    name: 'Soccer',
    icon: '⚽',
    color: '#326295',
    logoUrl: 'https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo-500.png',
  },
};

export const LEAGUES: League[] = [
  // NFL
  { id: 'nfl', name: 'NFL', sport: 'nfl', country: 'USA' },
  // NBA
  { id: 'nba', name: 'NBA', sport: 'nba', country: 'USA' },
  // MLB
  { id: 'mlb', name: 'MLB', sport: 'mlb', country: 'USA' },
  // NHL
  { id: 'nhl', name: 'NHL', sport: 'nhl', country: 'USA' },
  // Soccer
  { id: 'epl', name: 'Premier League', sport: 'soccer', country: 'England' },
  { id: 'laliga', name: 'La Liga', sport: 'soccer', country: 'Spain' },
  { id: 'bundesliga', name: 'Bundesliga', sport: 'soccer', country: 'Germany' },
  { id: 'seriea', name: 'Serie A', sport: 'soccer', country: 'Italy' },
  { id: 'mls', name: 'MLS', sport: 'soccer', country: 'USA' },
];

// Teams
export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  sport: Sport;
  leagueId: string;
  eloRating: number;
  logoUrl?: string;
  city?: string;
  primaryColor?: string;
  secondaryColor?: string;
  record?: {
    wins: number;
    losses: number;
    draws?: number;
  };
}

// Venues
export interface VenueInfo {
  name: string;
  city?: string;
  state?: string;
  imageUrl?: string;
  capacity?: number;
}

// Betting suggestion
export interface BettingSuggestion {
  tip: string;
  odds?: string;
  confidence: 'Scăzut' | 'Mediu' | 'Ridicat' | 'Foarte Ridicat';
  reasoning: string;
  value: 'Standard' | 'Valoare Bună' | 'Valoare Excelentă';
}

// Enhanced AI Analysis structure
export interface EnhancedAnalysis {
  preview: string;
  bullets: string[];
  risks: string[];
  // New enhanced fields
  keyMatchup?: string;           // "The key matchup will be..."
  xFactor?: string;              // Unexpected swing factor
  confidenceRationale?: string;  // Why confident/not
  injuryImpact?: string;         // Summary of injury impact
  weatherImpact?: string;        // Summary of weather impact
  // Betting suggestions
  bettingSuggestions?: BettingSuggestion[];
  bestBet?: BettingSuggestion;
}

// Games
export type GameStatus = 'scheduled' | 'live' | 'completed' | 'postponed';

export interface Game {
  id: string;
  sport: Sport;
  leagueId: string;
  homeTeam: Team;
  awayTeam: Team;
  startTime: Date;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
}

// Predictions
export interface PredictionFactor {
  name: string;
  value: number;
  description: string;
  weight: number;
}

export interface Prediction {
  id: string;
  gameId: string;
  game?: Game;
  predictedWinner: 'home' | 'away' | 'draw';
  predictedWinnerTeam?: Team;
  confidence: number; // 0-100
  mlProbability: number; // 0-1
  homeWinProbability: number;
  awayWinProbability: number;
  drawProbability?: number;
  llmAnalysis?: string;
  enhancedAnalysis?: EnhancedAnalysis;
  factors: PredictionFactor[];
  createdAt: Date;
  correct?: boolean | null;
}

// Historical stats
export interface PredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  bySport: Record<Sport, {
    total: number;
    correct: number;
    accuracy: number;
  }>;
  byConfidenceRange: {
    range: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  recentPerformance: {
    date: string;
    correct: number;
    total: number;
  }[];
}

// API response types
export interface GamesResponse {
  games: Game[];
  total: number;
}

export interface PredictionResponse {
  prediction: Prediction;
  game: Game;
}