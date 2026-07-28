import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * Line icons only, geometry copied from the prototype so stroke weights and
 * proportions match the design exactly. All are 24×24 viewBox and take their
 * color from `color`.
 */

type P = { size?: number; color?: string; strokeWidth?: number };

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24' });
const stroke = (color: string, w: number) => ({
  fill: 'none' as const,
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function SunIcon({ size = 26, color = '#ffd84d', strokeWidth = 2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Circle cx={12} cy={12} r={4.2} {...s} />
      <Line x1={12} y1={1.6} x2={12} y2={4} {...s} />
      <Line x1={12} y1={20} x2={12} y2={22.4} {...s} />
      <Line x1={1.6} y1={12} x2={4} y2={12} {...s} />
      <Line x1={20} y1={12} x2={22.4} y2={12} {...s} />
      <Line x1={4.6} y1={4.6} x2={6.3} y2={6.3} {...s} />
      <Line x1={17.7} y1={17.7} x2={19.4} y2={19.4} {...s} />
      <Line x1={4.6} y1={19.4} x2={6.3} y2={17.7} {...s} />
      <Line x1={17.7} y1={6.3} x2={19.4} y2={4.6} {...s} />
    </Svg>
  );
}

export function WifiOffIcon({ size = 17, color = '#12100a', strokeWidth = 2.2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Line x1={2} y1={2} x2={22} y2={22} {...s} />
      <Path d="M8.6 16.5a5 5 0 0 1 6.8 0" {...s} />
      <Path d="M5 12.6a10 10 0 0 1 4.6-2.4" {...s} />
      <Path d="M19.7 12.6a10 10 0 0 0-4.3-2.5" {...s} />
      <Line x1={12} y1={20} x2={12.01} y2={20} {...s} />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 22, color = '#fff', strokeWidth = 2.2 }: P) {
  return (
    <Svg {...base(size)}>
      <Polyline points="9 18 15 12 9 6" {...stroke(color, strokeWidth)} />
    </Svg>
  );
}

export function CameraIcon({ size = 27, color = '#fff', strokeWidth = 2.1 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" {...s} />
      <Circle cx={12} cy={13} r={3.2} {...s} />
    </Svg>
  );
}

/** The switch-code glyph: two arrows exchanging places. */
export function SwitchIcon({ size = 24, color = '#fff', strokeWidth = 2.2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Polyline points="17 1 21 5 17 9" {...s} />
      <Path d="M3 11V9a4 4 0 0 1 4-4h14" {...s} />
      <Polyline points="7 23 3 19 7 15" {...s} />
      <Path d="M21 13v2a4 4 0 0 1-4 4H3" {...s} />
    </Svg>
  );
}

/** Filled square — stop. */
export function StopIcon({ size = 22, color = '#0e1113' }: P) {
  return (
    <Svg {...base(size)}>
      <Rect x={5} y={5} width={14} height={14} rx={2} fill={color} />
    </Svg>
  );
}

export function ClockIcon({ size = 26, color = '#fff', strokeWidth = 2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Circle cx={12} cy={12} r={9.4} {...s} />
      <Polyline points="12 6.6 12 12 15.8 14" {...s} />
    </Svg>
  );
}

export function UserCheckIcon({ size = 24, color = '#fff', strokeWidth = 2.2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...s} />
      <Circle cx={9} cy={7} r={4} {...s} />
      <Polyline points="17 10 19.5 12.5 23 8" {...s} />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = '#fff', strokeWidth = 2.2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Line x1={12} y1={5} x2={12} y2={19} {...s} />
      <Line x1={5} y1={12} x2={19} y2={12} {...s} />
    </Svg>
  );
}

export function MinusIcon({ size = 22, color = '#fff', strokeWidth = 2.6 }: P) {
  return (
    <Svg {...base(size)}>
      <Line x1={5} y1={12} x2={19} y2={12} {...stroke(color, strokeWidth)} />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = '#fff', strokeWidth = 2.4 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Line x1={6} y1={6} x2={18} y2={18} {...s} />
      <Line x1={18} y1={6} x2={6} y2={18} {...s} />
    </Svg>
  );
}

export function SendIcon({ size = 23, color = '#fff', strokeWidth = 2.2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Line x1={22} y1={2} x2={11} y2={13} {...s} />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" {...s} />
    </Svg>
  );
}

/** The day-log tab glyph: a checked list. */
export function LogIcon({ size = 26, color = '#fff', strokeWidth = 2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Line x1={10} y1={6} x2={21} y2={6} {...s} />
      <Line x1={10} y1={12} x2={21} y2={12} {...s} />
      <Line x1={10} y1={18} x2={21} y2={18} {...s} />
      <Polyline points="3 6 4.2 7.2 6.4 5" {...s} />
      <Polyline points="3 12 4.2 13.2 6.4 11" {...s} />
      <Polyline points="3 18 4.2 19.2 6.4 17" {...s} />
    </Svg>
  );
}

export function VideoIcon({ size = 26, color = '#fff', strokeWidth = 2 }: P) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg {...base(size)}>
      <Polygon points="23 7 16 12 23 17 23 7" {...s} />
      <Rect x={1} y={5} width={15} height={14} rx={2} {...s} />
    </Svg>
  );
}
