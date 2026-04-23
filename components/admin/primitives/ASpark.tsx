interface ASparkProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  /** stroke width in SVG user units */
  stroke?: number;
  className?: string;
  /** dashed line for secondary series */
  dashed?: boolean;
}

export default function ASpark({
  points,
  color = "#c49a3a",
  width = 140,
  height = 40,
  stroke = 1.5,
  dashed,
  className = "",
}: ASparkProps) {
  if (!points.length) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1 || 1)) * width;
      const y = height - ((p - min) / (max - min || 1)) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={dashed ? "3,3" : undefined}
      />
    </svg>
  );
}
