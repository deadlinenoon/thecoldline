import type { NextApiRequest, NextApiResponse } from 'next';

const MODEL = 'gpt-5';

type ReportSuccess = {
  ok: true;
  report: string;
  contextSummary: {
    hasInjuries: boolean;
    hasWeather: boolean;
    hasOdds: boolean;
  };
};

type ReportError = {
  error: string;
  details?: unknown;
};

type InjuriesPayload = unknown;

type WeatherPayload = unknown;
type OddsPayload = unknown;

type ProviderResult<T> = {
  data: T | null;
  error: string | null;
  available: boolean;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildInternalUrl(req: NextApiRequest, pathname: string, searchParams: Record<string, string | null | undefined>): URL {
  const protocol = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
  const host = req.headers.host ?? 'localhost:3000';
  const url = new URL(pathname, `${protocol}://${host}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

async function fetchProvider<T>(url: URL, options: { optional?: boolean } = {}): Promise<ProviderResult<T>> {
  try {
    const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const text = await response.text();
    let payload: any = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      if (options.optional && response.status === 404) {
        return { data: null, error: null, available: false };
      }
      const errorMessage = typeof payload?.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
      return { data: null, error: errorMessage, available: true };
    }

    return { data: payload as T, error: null, available: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.optional) {
      return { data: null, error: message, available: true };
    }
    return { data: null, error: message, available: true };
  }
}

function buildSystemPrompt(): string {
  return [
    'You are The Cold Line\'s NFL-only analyst.',
    'Use ONLY the JSON provided in the user message.',
    'If anything is missing or null, explicitly note that it is unavailable.',
    'Focus on NFL; do not mention other leagues such as the NBA.',
    'Produce a crisp report covering: matchup overview, notable injuries, weather impact, market/odds notes, and key uncertainties.',
    'Do not add placeholders or speculate beyond the JSON.',
  ].join(' ');
}

type OpenAIResponse = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

async function callOpenAI(context: unknown): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            { type: 'text', text: buildSystemPrompt() },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: JSON.stringify(context) },
          ],
        },
      ],
    }),
  });

  const json = (await response.json()) as OpenAIResponse;
  if (!response.ok) {
    const message = json?.error?.message ?? `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }

  const parts = json?.output ?? [];
  const text = parts
    .flatMap(part => part.content ?? [])
    .filter(content => content.type === 'output_text' || content.type === 'text')
    .map(content => content.text ?? '')
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('No content from model');
  }

  return text;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ReportSuccess | ReportError>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { homeAbbr, awayAbbr, kickoffISO, angle } = req.body ?? {};
  if (!isNonEmptyString(homeAbbr) || !isNonEmptyString(awayAbbr) || !isNonEmptyString(kickoffISO)) {
    return res.status(400).json({ error: 'homeAbbr, awayAbbr, and kickoffISO are required' });
  }

  const injuriesUrl = buildInternalUrl(req, '/api/injuries', {
    teamA: homeAbbr,
    teamB: awayAbbr,
  });

  const weatherUrl = buildInternalUrl(req, '/api/weather', {
    home: homeAbbr,
    away: awayAbbr,
    kickoff: kickoffISO,
  });

  const oddsUrl = buildInternalUrl(req, '/api/odds', {
    home: homeAbbr,
    away: awayAbbr,
    kickoff: kickoffISO,
  });

  const [injuriesResult, weatherResult, oddsResult] = await Promise.all([
    fetchProvider<InjuriesPayload>(injuriesUrl),
    fetchProvider<WeatherPayload>(weatherUrl, { optional: true }),
    fetchProvider<OddsPayload>(oddsUrl, { optional: true }),
  ]);

  if (injuriesResult.error) {
    return res.status(502).json({
      error: `Injuries fetch failed: ${injuriesResult.error}`,
      details: { injuries: injuriesResult },
    });
  }

  if (weatherResult.error && weatherResult.available) {
    return res.status(502).json({
      error: `Weather fetch failed: ${weatherResult.error}`,
      details: { weather: weatherResult },
    });
  }

  if (oddsResult.error && oddsResult.available) {
    return res.status(502).json({
      error: `Odds fetch failed: ${oddsResult.error}`,
      details: { odds: oddsResult },
    });
  }

  const context = {
    angle: isNonEmptyString(angle) ? angle : null,
    kickoffISO,
    teams: { home: homeAbbr, away: awayAbbr },
    injuries: injuriesResult.data,
    weather: weatherResult.available ? weatherResult.data : null,
    weatherUnavailable: weatherResult.available ? null : 'weather endpoint unavailable',
    odds: oddsResult.available ? oddsResult.data : null,
    oddsUnavailable: oddsResult.available ? null : 'odds endpoint unavailable',
  };

  try {
    const report = await callOpenAI(context);
    return res.status(200).json({
      ok: true,
      report,
      contextSummary: {
        hasInjuries: Boolean(injuriesResult.data),
        hasWeather: Boolean(weatherResult.data),
        hasOdds: Boolean(oddsResult.data),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report generation failed';
    if (message === 'No content from model') {
      return res.status(502).json({ error: message });
    }
    return res.status(502).json({ error: message });
  }
}
