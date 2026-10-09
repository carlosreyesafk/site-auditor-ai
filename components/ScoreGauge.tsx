'use client';

export default function ScoreGauge({ score, label, size = 130 }: { score: number; label: string; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 90 ? '#34d399' : score >= 70 ? '#a3e635' : score >= 50 ? '#fbbf24' : '#f87171';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}
