/**
 * Brand mark for Browser Agent Chaos.
 *
 * Two exports:
 *   - <LogoIcon size={32} />   the orb only, for nav bars — served from
 *     /logo.png so it picks up the same chrome+cursor render as the README.
 *   - <LogoFull height={64} /> the full "Browser Agent CHAOS" wordmark
 *     (kept inline SVG so the wordmark gradient stays sharp).
 */
import { useId } from 'react';

export function LogoIcon({
  size = 32,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', objectFit: 'contain', ...style }}
      alt="Browser Agent Chaos"
    />
  );
}


/**
 * Full wordmark — icon + "Browser Agent" + "CHAOS". For hero placements
 * where the brand should sing. Caller controls height; width is intrinsic.
 */
export function LogoFull({
  height = 90,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const id = (name: string) => `${name}-${uid}`;
  const width = (height * 680) / 180;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 680 180"
      className={className}
      style={style}
      aria-label="Browser Agent Chaos"
    >
      <defs>
        <linearGradient
          id={id('flare')}
          x1="20"
          y1="140"
          x2="140"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FF2A6D" />
          <stop offset="45%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#7C3BFF" />
        </linearGradient>
        <linearGradient
          id={id('cyanRim')}
          x1="38"
          y1="46"
          x2="118"
          y2="88"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#35F4FF" />
          <stop offset="100%" stopColor="#35F4FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={id('magentaRim')}
          x1="123"
          y1="96"
          x2="60"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FF2A6D" />
          <stop offset="100%" stopColor="#FF2A6D" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('coreGrad')} cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#05060A" />
          <stop offset="100%" stopColor="#1E0B33" />
        </radialGradient>
        <filter
          id={id('flareGlow')}
          x="-70%"
          y="-70%"
          width="240%"
          height="240%"
        >
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={id('softGlow')}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={id('coreClip')}>
          <circle cx="80" cy="80" r="48" />
        </clipPath>
        <linearGradient
          id={id('chaosTextGrad')}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#FF2A6D" />
          <stop offset="45%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#7C3BFF" />
        </linearGradient>
        <filter
          id={id('textGlow')}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="8"
            floodColor="#000000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      {/* Icon group. */}
      <g transform="translate(15, 10)">
        <circle
          cx="80"
          cy="80"
          r="58"
          fill={`url(#${id('flare')})`}
          opacity="0.45"
          filter={`url(#${id('flareGlow')})`}
        />
        <circle cx="80" cy="80" r="48" fill={`url(#${id('coreGrad')})`} />
        <circle
          cx="80"
          cy="80"
          r="47"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.08"
        />
        <path
          d="M35 74A46 46 0 0 1 114 45"
          fill="none"
          stroke={`url(#${id('cyanRim')})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          filter={`url(#${id('softGlow')})`}
        />
        <path
          d="M123 96A46 46 0 0 1 55 118"
          fill="none"
          stroke={`url(#${id('magentaRim')})`}
          strokeWidth="3"
          strokeLinecap="round"
          filter={`url(#${id('softGlow')})`}
        />
        <g clipPath={`url(#${id('coreClip')})`}>
          <path
            d="M24 92L56 74L74 85L98 62L138 47"
            fill="none"
            stroke={`url(#${id('flare')})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M26 106L63 87L84 97L108 75L140 62"
            fill="none"
            stroke="#FF8A00"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.85"
            filter={`url(#${id('softGlow')})`}
          />
          <circle
            cx="74"
            cy="85"
            r="3.5"
            fill="#35F4FF"
            filter={`url(#${id('softGlow')})`}
          />
        </g>
        <circle
          cx="122"
          cy="37"
          r="6"
          fill="#35F4FF"
          filter={`url(#${id('softGlow')})`}
        />
        <circle cx="122" cy="37" r="2" fill="#FFFFFF" />
        <circle
          cx="38"
          cy="102"
          r="4"
          fill="#FF2A6D"
          filter={`url(#${id('softGlow')})`}
        />
        <circle
          cx="123"
          cy="108"
          r="3.5"
          fill="#FF8A00"
          filter={`url(#${id('softGlow')})`}
        />
      </g>
      {/* Wordmark. */}
      <g transform="translate(195, 0)">
        <text
          x="0"
          y="64"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, sans-serif"
          fontWeight="600"
          fontSize="34"
          fill="#F0F0F5"
          letterSpacing="0.06em"
        >
          BROWSER AGENT
        </text>
        <text
          x="-2"
          y="138"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, sans-serif"
          fontWeight="900"
          fontSize="72"
          fill={`url(#${id('chaosTextGrad')})`}
          fontStyle="italic"
          letterSpacing="0.01em"
          filter={`url(#${id('textGlow')})`}
        >
          CHAOS
        </text>
      </g>
    </svg>
  );
}
