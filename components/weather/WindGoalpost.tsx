import React from 'react';

const CARDINALS: Array<{ label: string; abbr: string }> = [
  { label: 'north', abbr: 'N' },
  { label: 'north-northeast', abbr: 'NNE' },
  { label: 'northeast', abbr: 'NE' },
  { label: 'east-northeast', abbr: 'ENE' },
  { label: 'east', abbr: 'E' },
  { label: 'east-southeast', abbr: 'ESE' },
  { label: 'southeast', abbr: 'SE' },
  { label: 'south-southeast', abbr: 'SSE' },
  { label: 'south', abbr: 'S' },
  { label: 'south-southwest', abbr: 'SSW' },
  { label: 'southwest', abbr: 'SW' },
  { label: 'west-southwest', abbr: 'WSW' },
  { label: 'west', abbr: 'W' },
  { label: 'west-northwest', abbr: 'WNW' },
  { label: 'northwest', abbr: 'NW' },
  { label: 'north-northwest', abbr: 'NNW' },
];

const CARDINAL_SEGMENT = 360 / CARDINALS.length;

const normalizeDegrees = (value: number): number => ((value % 360) + 360) % 360;

const cardinalFromDegrees = (deg: number): { label: string; abbr: string } => {
  const pivot = normalizeDegrees(deg);
  const index = Math.round(pivot / CARDINAL_SEGMENT) % CARDINALS.length;
  return CARDINALS[index];
};

export function abbreviateCardinal(cardinal: string | null | undefined): string | null {
  if (!cardinal) return null;
  const normalized = cardinal.toLowerCase();
  for (const entry of CARDINALS) {
    if (normalized.includes(entry.label)) {
      return entry.abbr;
    }
  }
  return null;
}

type WindDescription = {
  cardinal: string | null;
  target: string | null;
  toDegrees: number | null;
};

export function describeWindForGoal(directionFrom: number | null | undefined): WindDescription {
  if (directionFrom == null || !Number.isFinite(directionFrom)) {
    return { cardinal: null, target: null, toDegrees: null };
  }
  const fromDeg = normalizeDegrees(directionFrom as number);
  const toDeg = normalizeDegrees(fromDeg + 180);
  const fromCardinal = cardinalFromDegrees(fromDeg);
  const toCardinal = cardinalFromDegrees(toDeg);
  return {
    cardinal: `from the ${fromCardinal.label}`,
    target: `toward the ${toCardinal.label}`,
    toDegrees: toDeg,
  };
}

type WindGoalpostProps = {
  speed: number;
  directionFrom?: number | null;
  width?: number;
  height?: number;
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const WindGoalpost: React.FC<WindGoalpostProps> = ({
  speed,
  directionFrom,
  width = 160,
  height = 200,
  className,
}) => {
  const description = describeWindForGoal(directionFrom ?? null);
  const arrowAngle = description.toDegrees ?? 0;
  const centreX = width / 2;
  const crossbarY = height * 0.55;
  const arrowLength = height * 0.35;
  const rad = (arrowAngle * Math.PI) / 180;
  const arrowEndX = centreX + Math.sin(rad) * arrowLength;
  const arrowEndY = crossbarY - Math.cos(rad) * arrowLength;
  const arrowHeadSize = clamp(6 + speed * 0.4, 8, 16);
  const arrowColor = speed >= 18 ? '#f87171' : speed >= 12 ? '#facc15' : '#38bdf8';

  const baseX = arrowEndX - Math.sin(rad) * arrowHeadSize;
  const baseY = arrowEndY + Math.cos(rad) * arrowHeadSize;
  const leftAngle = rad + Math.PI / 2;
  const rightAngle = rad - Math.PI / 2;
  const sideLength = arrowHeadSize * 0.6;
  const leftX = baseX + Math.sin(leftAngle) * sideLength;
  const leftY = baseY - Math.cos(leftAngle) * sideLength;
  const rightX = baseX + Math.sin(rightAngle) * sideLength;
  const rightY = baseY - Math.cos(rightAngle) * sideLength;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Wind direction over goalpost"
    >
      <rect x={centreX - 6} y={crossbarY} width={12} height={height * 0.25} rx={3} fill="#fbbf24" />
      <rect x={centreX - width * 0.25} y={crossbarY - 8} width={width * 0.5} height={8} rx={4} fill="#facc15" />
      <rect x={centreX - 4} y={crossbarY - height * 0.4} width={8} height={height * 0.4} rx={3} fill="#fde68a" />

      <line
        x1={centreX}
        y1={crossbarY - height * 0.2}
        x2={arrowEndX}
        y2={arrowEndY}
        stroke={arrowColor}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <polygon
        points={`${arrowEndX},${arrowEndY} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={arrowColor}
      />
      <circle cx={centreX} cy={crossbarY - height * 0.2} r={4} fill="#e0f2fe" />
    </svg>
  );
};

export default WindGoalpost;
