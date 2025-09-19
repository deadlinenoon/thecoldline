import { teamLogoUrl } from '@/lib/logos';
import normalizeTeam from '@/libs/nfl/teams';
import { TEAM_CITY } from '@/lib/nflTeams';

const SHORT_NAME_OVERRIDES: Record<string, string> = {
  'Green Bay Packers': 'Packers',
  'New York Giants': 'Giants',
  'New York Jets': 'Jets',
  'San Francisco 49ers': '49ers',
  'Tampa Bay Buccaneers': 'Buccaneers',
  'Washington Commanders': 'Commanders',
};

export type TeamTagProps = {
  team?: string;
  teamId?: string;
  displayName?: string;
  className?: string;
  logoSize?: number;
  showCity?: boolean;
  logos?: string[];
};

function toShortName(name: string): string {
  if (!name) return '';
  if (SHORT_NAME_OVERRIDES[name]) return SHORT_NAME_OVERRIDES[name];
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return name;
  return parts[parts.length - 1];
}

export function TeamTag({ team, teamId, displayName, className, logoSize = 20, showCity = false, logos }: TeamTagProps) {
  const rawInput = (teamId ?? team ?? displayName ?? '').trim();
  const canonical = rawInput ? normalizeTeam(rawInput) : rawInput;
  const label = displayName ?? toShortName(canonical || rawInput);
  const city = showCity && canonical ? TEAM_CITY[canonical]?.city ?? null : null;
  const primaryLogo = (() => {
    if (Array.isArray(logos)) {
      const candidate = logos.map(src => (typeof src === 'string' ? src.trim() : '')).find(Boolean);
      if (candidate) return candidate;
    }
    return (canonical || rawInput) ? teamLogoUrl(canonical || rawInput) : '';
  })();

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
      {primaryLogo ? (
        <img
          src={primaryLogo}
          alt={`${canonical || label || 'Team'} logo`}
          width={logoSize}
          height={logoSize}
          loading="lazy"
          className="rounded-full border border-slate-700 bg-black/30 object-contain"
          style={{ width: logoSize, height: logoSize }}
        />
      ) : null}
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-slate-200">{label || canonical || rawInput || '—'}</span>
        {city ? <span className="text-[11px] text-slate-400">{city}</span> : null}
      </span>
    </span>
  );
}

export default TeamTag;
