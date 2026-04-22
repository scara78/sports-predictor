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

export interface BettingSuggestion {
  tip: string;
  odds?: string;
  confidence: 'Scăzut' | 'Mediu' | 'Ridicat' | 'Foarte Ridicat';
  reasoning: string;
  value: 'Standard' | 'Valoare Bună' | 'Valoare Excelentă';
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
  bettingSuggestions?: BettingSuggestion[];
  bestBet?: BettingSuggestion;
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
async function callLLM(prompt: string, maxTokens: number = 1500): Promise<string> {
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

  const prompt = `Ești un analist expert în ${sportInfo.name}. Analizează acest meci folosind DOAR datele furnizate. Fii precis și bazat pe date. RĂSPUNDE EXCLUSIV ÎN LIMBA ROMÂNĂ.

MECIUL:
${game.homeTeam.name} (Acasă) vs ${game.awayTeam.name} (Deplasare)
Data: ${game.startTime.toLocaleDateString('ro-RO')}
Stadion: ${game.venue || 'Nedeterminat'}

STATISTICI SEZON CURENT:
- ${game.homeTeam.name}: ${homeRecord?.wins || 0}V - ${homeRecord?.losses || 0}Î${homeRecord?.draws ? ` - ${homeRecord.draws}E` : ''} (${homeWinPct.toFixed(1)}% rată victorii)
- ${game.awayTeam.name}: ${awayRecord?.wins || 0}V - ${awayRecord?.losses || 0}Î${awayRecord?.draws ? ` - ${awayRecord.draws}E` : ''} (${awayWinPct.toFixed(1)}% rată victorii)

PREDICȚIE STATISTICĂ:
- Câștigător prezis: ${prediction.predictedWinner === 'home' ? game.homeTeam.name : prediction.predictedWinner === 'away' ? game.awayTeam.name : 'Egal'}
- Probabilitate victorie ${game.homeTeam.name}: ${(prediction.homeWinProbability * 100).toFixed(1)}%
- Probabilitate victorie ${game.awayTeam.name}: ${(prediction.awayWinProbability * 100).toFixed(1)}%
${prediction.drawProbability ? `- Probabilitate egal: ${(prediction.drawProbability * 100).toFixed(1)}%` : ''}
- Încredere model: ${prediction.confidence}%

Răspunde NUMAI în format JSON:
{
  "analysis": "Analiză de 2-3 propoziții în română bazată pe statistici și meciuri",
  "keyFactors": ["Factor 1 în română", "Factor 2 în română", "Factor 3 în română"],
  "confidenceAdjustment": 0,
  "riskFactors": ["Risc 1 în română", "Risc 2 în română"]
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
      analysis: `Pe baza statisticilor sezonului, ${favored.name} are avantajul statistic. ${
        winPctDiff > 20
          ? `Diferența de ${winPctDiff.toFixed(0)}% în ratele de victorie este semnificativă.`
          : 'Ambele echipe au statistici comparabile, ceea ce face acest meci competitiv.'
      } Avantajul terenului propriu este, de asemenea, un factor important.`,
      keyFactors: [
        `${game.homeTeam.name} are ${homeWinPct.toFixed(0)}% rată de victorie în acest sezon`,
        `${game.awayTeam.name} are ${awayWinPct.toFixed(0)}% rată de victorie în acest sezon`,
        `Avantaj teren propriu pentru ${game.homeTeam.name}`,
      ],
      confidenceAdjustment: 0,
      riskFactors: [
        'Orice meci poate produce rezultate neașteptate',
        'Statisticile sezonului pot să nu reflecte forma actuală a echipei',
      ],
    };
  }
}

/**
 * Get sport-specific betting markets
 */
function getBettingMarketsForSport(sport: string): string {
  switch (sport) {
    case 'soccer':
      return `Piețe disponibile pentru pariuri:
- 1X2 (Victorie echipă acasă / Egal / Victorie echipă deplasare)
- Ambele echipe marchează (Da/Nu)
- Peste/Sub 0.5, 1.5, 2.5, 3.5 goluri
- Handicap asiatic
- Câștigătoare primă repriză
- Rezultat corect
- Număr de cartonașe (Peste/Sub 3.5, 4.5)
- Cartonaș roșu în meci (Da/Nu)
- Număr de cornere (Peste/Sub 8.5, 9.5, 10.5)
- Primul marcator
- Marcator oricând`;
    case 'nfl':
      return `Piețe disponibile pentru pariuri:
- Câștigător meci (cu/fără handicap)
- Totale puncte (Peste/Sub 40.5, 45.5, 50.5)
- Handicap puncte (-3, -6, -7, -10)
- Prima repriză: câștigător și total
- Touchdown-uri marcate (Peste/Sub 5.5)
- Yarduri trecere QB
- Prima echipă care marchează`;
    case 'nba':
      return `Piețe disponibile pentru pariuri:
- Câștigător meci (cu/fără handicap)
- Totale puncte (Peste/Sub 215.5, 220.5, 225.5)
- Handicap puncte
- Prima repriză: câștigător și total
- Triple-double (Da/Nu pentru jucători cheie)
- Puncte jucător stea (Peste/Sub)`;
    case 'mlb':
      return `Piețe disponibile pentru pariuri:
- Câștigător meci (Moneyline)
- Total puncte (Peste/Sub 7.5, 8.5, 9.5 alergări)
- Handicap alergări (-1.5)
- Prima repriză: câștigător și total
- Eliminări pitcher (Peste/Sub)`;
    case 'nhl':
      return `Piețe disponibile pentru pariuri:
- Câștigător meci (cu/fără prelungiri)
- Total goluri (Peste/Sub 5.5, 6.5)
- Handicap goluri (-1.5)
- Ambele echipe marchează (Da/Nu)
- Prima echipă care marchează
- Goluri în prima perioadă`;
    default:
      return `Piețe disponibile: câștigător meci, total puncte/goluri, handicap`;
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
    : 'Nu există factori suplimentari disponibili';

  const injurySummary = getInjurySummaryForLLM(context.homeInjuries, context.awayInjuries);
  const weatherSummary = getWeatherSummaryForLLM(context.weather);
  const sportInstructions = buildSportSpecificInstructions(game.sport);
  const scoringContext = getScoringContext(game.sport);
  const bettingMarkets = getBettingMarketsForSport(game.sport);

  const prompt = `Ești un analist sportiv expert și consilier de pariuri profesionist. Analizează acest meci și oferă sugestii de pariuri profitabile. RĂSPUNDE EXCLUSIV ÎN LIMBA ROMÂNĂ.

MECIUL: ${game.awayTeam.name} @ ${game.homeTeam.name}
Data: ${game.startTime.toLocaleDateString('ro-RO')}
Stadion: ${game.venue || 'Nedeterminat'}
Sport: ${sportInfo.name}

PROFIL ECHIPĂ GAZDĂ: ${game.homeTeam.name}
${homeContext}

PROFIL ECHIPĂ OASPEȚI: ${game.awayTeam.name}
${awayContext}

PREDICȚIE MODEL:
- Favorit: ${prediction.predictedWinner === 'home' ? game.homeTeam.name : prediction.predictedWinner === 'away' ? game.awayTeam.name : 'Egal'}
- Probabilitate victorie ${game.homeTeam.name}: ${(prediction.homeWinProbability * 100).toFixed(1)}%
- Probabilitate victorie ${game.awayTeam.name}: ${(prediction.awayWinProbability * 100).toFixed(1)}%
${prediction.drawProbability ? `- Probabilitate egal: ${(prediction.drawProbability * 100).toFixed(1)}%` : ''}
- Încredere: ${prediction.confidence}%

FACTORI PREDICȚIE:
${factorsSummary}

RAPORT ACCIDENTAȚI:
${injurySummary}

${weatherSummary}

${bettingMarkets}

INSTRUCȚIUNI SPECIFICE SPORTULUI:
${sportInstructions}

${scoringContext}

INSTRUCȚIUNI IMPORTANTE:
1. Toate textele trebuie să fie în ROMÂNĂ
2. Analizează toate piețele de pariuri disponibile
3. Identifică pariurile cu CEA MAI BUNĂ VALOARE (nu neapărat cele mai sigure)
4. Explică raționamentul pentru fiecare sugestie
5. "bestBet" trebuie să fie CEL MAI PROFITABIL pariu identificat

Răspunde NUMAI în format JSON valid:
{
  "preview": "2 propoziții despre meci în română cu statistici specifice",
  "bullets": ["Insight 1 în română", "Insight 2 în română", "Insight 3 în română", "Insight 4 în română"],
  "risks": ["Risc 1 în română", "Risc 2 în română"],
  "keyMatchup": "Duelul cheie care va decide meciul (în română)",
  "xFactor": "Elementul surpriză care ar putea schimba rezultatul (în română)",
  "confidenceRationale": "De ce predicția are această încredere (în română)",
  "injuryImpact": "Cum afectează accidentările acest meci (în română, sau null dacă nu e cazul)",
  "weatherImpact": "Cum afectează vremea acest meci (în română, sau null dacă nu e cazul)",
  "confidenceAdjustment": 0,
  "bettingSuggestions": [
    {
      "tip": "Numele pariului (ex: Ambele echipe marchează - Da)",
      "confidence": "Ridicat",
      "reasoning": "Explicație detaliată în română de ce acest pariu are valoare",
      "value": "Valoare Bună"
    },
    {
      "tip": "Al doilea pariu sugerat",
      "confidence": "Mediu",
      "reasoning": "Explicație în română",
      "value": "Standard"
    },
    {
      "tip": "Al treilea pariu sugerat",
      "confidence": "Ridicat",
      "reasoning": "Explicație în română",
      "value": "Valoare Excelentă"
    }
  ],
  "bestBet": {
    "tip": "CEL MAI PROFITABIL pariu identificat",
    "confidence": "Foarte Ridicat",
    "reasoning": "Explicație detaliată în română de ce acesta este cel mai bun pariu",
    "value": "Valoare Excelentă"
  }
}`;

  try {
    const text = await callLLM(prompt, 2000);
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
    lines.push(`- Palmares: ${record.wins}V-${record.losses}Î${record.draws ? `-${record.draws}E` : ''} (${winPct.toFixed(1)}%)`);
  }

  if (context.streak) {
    lines.push(`- Formă curentă: Serie de ${context.streak.count} ${context.streak.type === 'win' ? 'victorii' : 'înfrângeri'}`);
  }

  if (context.last5) {
    lines.push(`- Ultimele 5 meciuri: ${context.last5.wins}V-${context.last5.losses}Î`);
  }

  if (context.restDays !== undefined) {
    if (context.restDays === 0) {
      lines.push(`- Odihnă: Meci consecutiv (0 zile odihnă)`);
    } else if (context.restDays === 1) {
      lines.push(`- Odihnă: 1 zi de odihnă`);
    } else {
      lines.push(`- Odihnă: ${context.restDays} zile de odihnă`);
    }
  }

  if (context.avgScore !== undefined) {
    lines.push(`- Medie puncte/goluri marcate: ${context.avgScore.toFixed(1)} per meci`);
  }

  return lines.length > 0 ? lines.join('\n') : '- Nu există context suplimentar disponibil';
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

  let preview = `${favored.name} intră ca favorit cu o probabilitate de victorie de ${(Math.max(prediction.homeWinProbability, prediction.awayWinProbability) * 100).toFixed(0)}%. `;

  if (context.homeStreak || context.awayStreak) {
    const homeStreakText = context.homeStreak
      ? `${game.homeTeam.name} se află pe o serie de ${context.homeStreak.count} ${context.homeStreak.type === 'win' ? 'victorii' : 'înfrângeri'}`
      : '';
    preview += homeStreakText || `${game.awayTeam.name} este pe o serie de ${context.awayStreak?.count} ${context.awayStreak?.type === 'win' ? 'victorii' : 'înfrângeri'}` || '';
  } else {
    preview += 'Ambele echipe caută să construiască un impuls pozitiv în acest meci.';
  }

  if (game.homeTeam.record && game.awayTeam.record) {
    bullets.push(
      `${game.homeTeam.name} are ${game.homeTeam.record.wins} victorii și ${game.homeTeam.record.losses} înfrângeri, ` +
      `${game.awayTeam.name} are ${game.awayTeam.record.wins} victorii și ${game.awayTeam.record.losses} înfrângeri`
    );
  }

  if (context.homeLast5) {
    bullets.push(`${game.homeTeam.name} are ${context.homeLast5.wins}V-${context.homeLast5.losses}Î în ultimele 5 meciuri`);
  }
  if (context.awayLast5) {
    bullets.push(`${game.awayTeam.name} are ${context.awayLast5.wins}V-${context.awayLast5.losses}Î în ultimele 5 meciuri`);
  }

  bullets.push(`Avantajul terenului propriu contează pentru ${game.homeTeam.name}`);

  if (prediction.confidence < 65) {
    risks.push('Meci echilibrat - oricare echipă poate câștiga');
  }
  risks.push('Orice meci poate produce rezultate neașteptate');

  const isSoccer = game.sport === 'soccer';
  const avgTotal = (context.homeAvgScore || 1.5) + (context.awayAvgScore || 1.2);

  const bettingSuggestions: BettingSuggestion[] = [
    {
      tip: `Victorie ${favored.name} (1X2)`,
      confidence: prediction.confidence >= 70 ? 'Ridicat' : 'Mediu',
      reasoning: `Favoritul statistic cu ${prediction.confidence}% încredere bazat pe statisticile sezonului`,
      value: prediction.confidence >= 75 ? 'Valoare Bună' : 'Standard',
    },
    ...(isSoccer ? [
      {
        tip: avgTotal >= 2.5 ? 'Peste 2.5 goluri' : 'Sub 2.5 goluri',
        confidence: 'Mediu' as const,
        reasoning: `Media golurilor per meci sugerează ${avgTotal >= 2.5 ? 'un meci cu goluri multe' : 'un meci echilibrat defensiv'}`,
        value: 'Standard' as const,
      },
    ] : []),
  ];

  const bestBet: BettingSuggestion = {
    tip: `Victorie ${favored.name}`,
    confidence: 'Ridicat',
    reasoning: `Cel mai sigur pariu bazat pe datele disponibile. ${favored.name} are avantaj statistic clar.`,
    value: 'Valoare Bună',
  };

  return {
    preview,
    bullets: bullets.slice(0, 4),
    risks: risks.slice(0, 2),
    confidenceAdjustment: 0,
    bettingSuggestions,
    bestBet,
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

    const llmAnalysis = `${enhanced.preview}\n\nInsight-uri Cheie:\n${enhanced.bullets.map((b) => `• ${b}`).join('\n')}\n\nFactori de Risc:\n${enhanced.risks.map((r) => `• ${r}`).join('\n')}`;

    const enhancedAnalysis: EnhancedAnalysis & {
      bettingSuggestions?: BettingSuggestion[];
      bestBet?: BettingSuggestion;
    } = {
      preview: enhanced.preview,
      bullets: enhanced.bullets,
      risks: enhanced.risks,
      keyMatchup: enhanced.keyMatchup,
      xFactor: enhanced.xFactor,
      confidenceRationale: enhanced.confidenceRationale,
      injuryImpact: enhanced.injuryImpact,
      weatherImpact: enhanced.weatherImpact,
      bettingSuggestions: enhanced.bettingSuggestions,
      bestBet: enhanced.bestBet,
    };

    return {
      ...prediction,
      confidence: adjustedConfidence,
      llmAnalysis,
      enhancedAnalysis: enhancedAnalysis as EnhancedAnalysis,
    };
  }

  const analysis = await analyzeMatchup(game, prediction);

  const adjustedConfidence = Math.max(
    50,
    Math.min(90, prediction.confidence + analysis.confidenceAdjustment)
  );

  const llmAnalysis = `${analysis.analysis}\n\nFactori Cheie:\n${analysis.keyFactors.map((f) => `• ${f}`).join('\n')}\n\nFactori de Risc:\n${analysis.riskFactors.map((r) => `• ${r}`).join('\n')}`;

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

  const prompt = `Rezumă aceste predicții sportive pe scurt și precis. RĂSPUNDE EXCLUSIV ÎN ROMÂNĂ.

Pariuri cu Încredere Ridicată (${highConfidence.length}):
${highConfidence.map((p) => `- ${p.game?.homeTeam.name} vs ${p.game?.awayTeam.name}: ${p.predictedWinner === 'home' ? p.game?.homeTeam.name : p.game?.awayTeam.name} (${p.confidence}%)`).join('\n')}

Meciuri Incerte (${tossups.length}):
${tossups.map((p) => `- ${p.game?.homeTeam.name} vs ${p.game?.awayTeam.name}: ${p.confidence}% încredere`).join('\n')}

Oferă un rezumat de 2-3 propoziții în română. Răspunde cu text simplu, fără JSON.`;

  try {
    return await callLLM(prompt, 256);
  } catch (error) {
    console.error('Summary generation error:', error);
    return `Tabloul de azi include ${highConfidence.length} meciuri unde o echipă este clar favorită și ${tossups.length} meciuri foarte echilibrate.`;
  }
}