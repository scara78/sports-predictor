import OpenAI from 'openai';
import { Game, Prediction, SPORTS, EnhancedAnalysis } from './types';
import { PredictionFactor } from './types';
import { TeamInjuryReport } from './data-sources/injuries';
import { getInjurySummaryForLLM } from './factors/injuries';
import { WeatherConditions } from './data-sources/weather';
import { getWeatherSummaryForLLM } from './factors/weather';
import { buildSportSpecificInstructions, getScoringContext } from './prompts';

// Initialize OpenAI-compatible client pointing to custom API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
  baseURL: process.env.OPENAI_BASE_URL || 'https://ruter1.scara.ovh/v1',
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

interface AnalysisResult {
  analysis: string;
  keyFactors: string[];
  confidenceAdjustment: number;
  riskFactors: string[];
}

interface EnhancedAnalysisResult {
  preview: string;
  bullets: string[];
  risks: string[];
  confidenceAdjustment: number;
  keyMatchup?: string;
  xFactor?: string;
  confidenceRationale?: string;
  injuryImpact?: string;
  weatherImpact?: string;
}

export interface GameAnalysisContext {
  homeStreak?: { type: 'win' | 'loss'; count: number };
  awayStreak?: { type: 'win' | 'loss'; count: number };
  homeRestDays?: number;
  awayRestDays?: number;
  homeLast5?: { wins: number; losses: number };
  awayLast5?: { wins: number; losses: number };
  homeAvgScore?: number;
  awayAvgScore?: number;
  factors?: PredictionFactor[];
  homeInjuries?: TeamInjuryReport;
  awayInjuries?: TeamInjuryReport;
  weather?: WeatherConditions;
}

/**
 * Call the custom OpenAI-compatible API
 */
async function callLLM(prompt: string, maxTokens: number = 1024): Promise<string> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in LLM response');
  }
  return content;
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJsonFromResponse<T>(text: string): T {
  // Remove markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

/**
 * Generate LLM analysis for a game matchup
 */
export async function analyzeMatchup(
  game: Game,
  prediction: Prediction
): Promise<AnalysisResult> {
  const sportInfo = SPORTS[game.sport];
  const homeRecord = game.homeTeam.record;
  const awayRecord = game.awayTeam.record;

  const homeWinPct = homeRecord
    ? ((homeRecord.wins + (homeRecord.draws || 0) * 0.5) /
        (homeRecord.wins + homeRecord.losses + (homeRecord.draws || 0))) * 100
    : 50;
  const awayWinPct = awayRecord
    ? ((awayRecord.wins + (awayRecord.draws || 0) * 0.5) /
        (awayRecord.wins + awayRecord.losses + (awayRecord.draws || 0))) * 100
    : 50;

  const prompt = `You are an expert ${sportInfo.name} analyst. Analyze this matchup using ONLY the data provided. Be accurate and data-driven.

MATCHUP:
${game.homeTeam.name} (Home) vs ${game.awayTeam.name} (Away)
Date: ${game.startTime.toLocaleDateString()}
Venue: ${game.venue || 'TBD'}

CURRENT SEASON RECORDS:
- ${game.homeTeam.name}: ${homeRecord?.wins || 0}W - ${homeRecord?.losses || 0}L${homeRecord?.draws ? ` - ${homeRecord.draws}D` : ''} (${homeWinPct.toFixed(1)}% win rate)
- ${game.awayTeam.name}: ${awayRecord?.wins || 0}W - ${awayRecord?.losses || 0}L${awayRecord?.draws ? ` - ${awayRecord.draws}D` : ''} (${awayWinPct.toFixed(1)}% win rate)

STATISTICAL PREDICTION:
- Predicted Winner: ${prediction.predictedWinner === 'home' ? game.homeTeam.name : prediction.predictedWinner === 'away' ? game.awayTeam.name : 'Draw'}
- ${game.homeTeam.name} Win Probability: ${(prediction.homeWinProbability * 100).toFixed(1)}%
- ${game.awayTeam.name} Win Probability: ${(prediction.awayWinProbability * 100).toFixed(1)}%
${prediction.drawProbability ? `- Draw Probability: ${(prediction.drawProbability * 100).toFixed(1)}%` : ''}
- Model Confidence: ${prediction.confidence}%

Respond in JSON format only:
{
  "analysis": "2-3 sentence analysis based on the records and matchup",
  "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "confidenceAdjustment": 0,
  "riskFactors": ["Risk 1", "Risk 2"]
}`;

  try {
    const text = await callLLM(prompt);
    return parseJsonFromResponse<AnalysisResult>(text);
  } catch (error) {
    console.error('LLM analysis error:', error);

    const favored = prediction.homeWinProbability > prediction.awayWinProbability
      ? game.homeTeam
      : game.awayTeam;
    const winPctDiff = Math.abs(homeWinPct - awayWinPct);

    return {
      analysis: `Based on season records, ${favored.name} has the statistical advantage. ${
        winPctDiff > 20
          ? `The ${winPctDiff.toFixed(0)}% difference in win rates is significant.`
          : 'Both teams have comparable records, making this a competitive matchup.'
      } Home field advantage also factors into the prediction.`,
      keyFactors: [
        `${game.homeTeam.name} is ${homeWinPct.toFixed(0)}% on the season`,
        `${game.awayTeam.name} is ${awayWinPct.toFixed(0)}% on the season`,
        `Home advantage for ${game.homeTeam.name}`,
      ],
      confidenceAdjustment: 0,
      riskFactors: [
        'Any game can produce unexpected results',
        'Season records may not reflect current team form',
      ],
    };
  }
}

/**
 * Generate enhanced LLM analysis with game-specific stats and insights
 */
export async function analyzeMatchupEnhanced(
  game: Game,
  prediction: Prediction,
  context: GameAnalysisContext
): Promise<EnhancedAnalysisResult> {
  const sportInfo = SPORTS[game.sport];
  const homeRecord = game.homeTeam.record;
  const awayRecord = game.awayTeam.record;

  const homeContext = buildTeamContext(game.homeTeam.name, homeRecord, {
    streak: context.homeStreak,
    restDays: context.homeRestDays,
    last5: context.homeLast5,
    avgScore: context.homeAvgScore,
  });

  const awayContext = buildTeamContext(game.awayTeam.name, awayRecord, {
    streak: context.awayStreak,
    restDays: context.awayRestDays,
    last5: context.awayLast5,
    avgScore: context.awayAvgScore,
  });

  const factorsSummary = context.factors?.length
    ? context.factors.map((f) => `- ${f.name}: ${f.description}`).join('\n')
    : 'No additional factors available';

  const injurySummary = getInjurySummaryForLLM(context.homeInjuries, context.awayInjuries);
  const weatherSummary = getWeatherSummaryForLLM(context.weather);
  const sportInstructions = buildSportSpecificInstructions(game.sport);
  const scoringContext = getScoringContext(game.sport);

  const prompt = `You are an expert ${sportInfo.name} analyst. Generate a UNIQUE, game-specific analysis using the data provided.

MATCHUP: ${game.awayTeam.name} @ ${game.homeTeam.name}
Date: ${game.startTime.toLocaleDateString()}
Venue: ${game.venue || 'TBD'}

HOME TEAM PROFILE: ${game.homeTeam.name}
${homeContext}

AWAY TEAM PROFILE: ${game.awayTeam.name}
${awayContext}

MODEL PREDICTION:
- Favored: ${prediction.predictedWinner === 'home' ? game.homeTeam.name : prediction.predictedWinner === 'away' ? game.awayTeam.name : 'Draw'}
- ${game.homeTeam.name} Win Probability: ${(prediction.homeWinProbability * 100).toFixed(1)}%
- ${game.awayTeam.name} Win Probability: ${(prediction.awayWinProbability * 100).toFixed(1)}%
- Confidence: ${prediction.confidence}%

PREDICTION FACTORS:
${factorsSummary}

INJURY REPORT:
${injurySummary}

${weatherSummary}

SPORT-SPECIFIC ANALYSIS GUIDANCE:
${sportInstructions}

${scoringContext}

Respond in JSON format only:
{
  "preview": "2-sentence game preview with specific stats",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "risks": ["Risk 1", "Risk 2"],
  "keyMatchup": "The key matchup that will decide this game",
  "xFactor": "An unexpected element that could swing the outcome",
  "confidenceRationale": "Why this prediction is confident or uncertain",
  "injuryImpact": "How injuries affect this game (if applicable)",
  "weatherImpact": "How weather affects this game (if applicable)",
  "confidenceAdjustment": 0
}`;

  try {
    const text = await callLLM(prompt);
    return parseJsonFromResponse<EnhancedAnalysisResult>(text);
  } catch (error) {
    console.error('Enhanced LLM analysis error:', error);
    return generateFallbackEnhancedAnalysis(game, prediction, context);
  }
}

/**
 * Build team context string from available data
 */
function buildTeamContext(
  teamName: string,
  record: { wins: number; losses: number; draws?: number } | undefined,
  context: {
    streak?: { type: 'win' | 'loss'; count: number };
    restDays?: number;
    last5?: { wins: number; losses: number };
    avgScore?: number;
  }
): string {
  const lines: string[] = [];

  if (record) {
    const winPct = ((record.wins + (record.draws || 0) * 0.5) /
      (record.wins + record.losses + (record.draws || 0))) * 100;
    lines.push(`- Record: ${record.wins}-${record.losses}${record.draws ? `-${record.draws}` : ''} (${winPct.toFixed(1)}%)`);
  }

  if (context.streak) {
    lines.push(`- Current Streak: ${context.streak.count} ${context.streak.type}${context.streak.count > 1 ? 's' : ''}`);
  }

  if (context.last5) {
    lines.push(`- Last 5 Games: ${context.last5.wins}-${context.last5.losses}`);
  }

  if (context.restDays !== undefined) {
    if (context.restDays === 0) {
      lines.push(`- Rest: Back-to-back (0 days rest)`);
    } else if (context.restDays === 1) {
      lines.push(`- Rest: 1 day rest`);
    } else {
      lines.push(`- Rest: ${context.restDays} days rest`);
    }
  }

  if (context.avgScore !== undefined) {
    lines.push(`- Avg Score: ${context.avgScore.toFixed(1)} ppg`);
  }

  return lines.length > 0 ? lines.join('\n') : '- No additional context available';
}

/**
 * Generate fallback enhanced analysis when LLM fails
 */
function generateFallbackEnhancedAnalysis(
  game: Game,
  prediction: Prediction,
  context: GameAnalysisContext
): EnhancedAnalysisResult {
  const favored = prediction.predictedWinner === 'home' ? game.homeTeam : game.awayTeam;
  const bullets: string[] = [];
  const risks: string[] = [];

  let preview = `${favored.name} enters as the favorite with a ${(Math.max(prediction.homeWinProbability, prediction.awayWinProbability) * 100).toFixed(0)}% win probability. `;

  if (context.homeStreak || context.awayStreak) {
    const homeStreakText = context.homeStreak
      ? `${game.homeTeam.name} on a ${context.homeStreak.count}-game ${context.homeStreak.type} streak`
      : '';
    preview += homeStreakText || `${game.awayTeam.name} on a ${context.awayStreak?.count}-game ${context.awayStreak?.type} streak` || '';
  } else {
    preview += 'Both teams looking to build momentum in this matchup.';
  }

  if (game.homeTeam.record && game.awayTeam.record) {
    bullets.push(
      `${game.homeTeam.name} is ${game.homeTeam.record.wins}-${game.homeTeam.record.losses}, ` +
      `${game.awayTeam.name} is ${game.awayTeam.record.wins}-${game.awayTeam.record.losses}`
    );
  }

  if (context.homeLast5) {
    bullets.push(`${game.homeTeam.name} is ${context.homeLast5.wins}-${context.homeLast5.losses} in last 5 games`);
  }
  if (context.awayLast5) {
    bullets.push(`${game.awayTeam.name} is ${context.awayLast5.wins}-${context.awayLast5.losses} in last 5 games`);
  }

  bullets.push(`Home advantage factors into ${game.homeTeam.name}'s probability`);

  if (prediction.confidence < 65) {
    risks.push('Close matchup - either team can win');
  }
  risks.push('Any game can produce unexpected results');

  return {
    preview,
    bullets: bullets.slice(0, 4),
    risks: risks.slice(0, 2),
    confidenceAdjustment: 0,
  };
}

/**
 * Enrich a prediction with LLM analysis
 */
export async function enrichPredictionWithAnalysis(
  game: Game,
  prediction: Prediction,
  context?: GameAnalysisContext
): Promise<Prediction> {
  if (context) {
    const enhanced = await analyzeMatchupEnhanced(game, prediction, context);

    const adjustedConfidence = Math.max(
      50,
      Math.min(90, prediction.confidence + enhanced.confidenceAdjustment)
    );

    const llmAnalysis = `${enhanced.preview}\n\nKey Insights:\n${enhanced.bullets.map((b) => `• ${b}`).join('\n')}\n\nRisk Factors:\n${enhanced.risks.map((r) => `• ${r}`).join('\n')}`;

    const enhancedAnalysis: EnhancedAnalysis = {
      preview: enhanced.preview,
      bullets: enhanced.bullets,
      risks: enhanced.risks,
      keyMatchup: enhanced.keyMatchup,
      xFactor: enhanced.xFactor,
      confidenceRationale: enhanced.confidenceRationale,
      injuryImpact: enhanced.injuryImpact,
      weatherImpact: enhanced.weatherImpact,
    };

    return {
      ...prediction,
      confidence: adjustedConfidence,
      llmAnalysis,
      enhancedAnalysis,
    };
  }

  const analysis = await analyzeMatchup(game, prediction);

  const adjustedConfidence = Math.max(
    50,
    Math.min(90, prediction.confidence + analysis.confidenceAdjustment)
  );

  const llmAnalysis = `${analysis.analysis}\n\nKey Factors:\n${analysis.keyFactors.map((f) => `• ${f}`).join('\n')}\n\nRisk Factors:\n${analysis.riskFactors.map((r) => `• ${r}`).join('\n')}`;

  return {
    ...prediction,
    confidence: adjustedConfidence,
    llmAnalysis,
  };
}

/**
 * Generate quick summary for multiple predictions
 */
export async function generatePredictionsSummary(predictions: Prediction[]): Promise<string> {
  const highConfidence = predictions.filter((p) => p.confidence >= 75);
  const tossups = predictions.filter((p) => p.confidence < 60);

  const prompt = `Summarize these sports predictions briefly and accurately:

High Confidence Picks (${highConfidence.length}):
${highConfidence.map((p) => `- ${p.game?.homeTeam.name} vs ${p.game?.awayTeam.name}: ${p.predictedWinner === 'home' ? p.game?.homeTeam.name : p.game?.awayTeam.name} (${p.confidence}%)`).join('\n')}

Toss-ups (${tossups.length}):
${tossups.map((p) => `- ${p.game?.homeTeam.name} vs ${p.game?.awayTeam.name}: ${p.confidence}% confidence`).join('\n')}

Provide a 2-3 sentence factual summary. Respond with plain text only.`;

  try {
    return await callLLM(prompt, 256);
  } catch (error) {
    console.error('Summary generation error:', error);
    return `Today's slate includes ${highConfidence.length} games where one team is clearly favored, and ${tossups.length} closely matched games.`;
  }
}