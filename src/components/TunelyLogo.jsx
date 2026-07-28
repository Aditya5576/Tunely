export default function TunelyLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={`tunely-logo-svg ${className}`}
      style={{ flexShrink: 0 }}
    >
      <defs>
        {/* Background Gradient */}
        <linearGradient id="tunelyBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0b0f19" />
          <stop offset="50%" stopColor="#070912" />
          <stop offset="100%" stop-color="#0e0818" />
        </linearGradient>

        {/* Glowing Accent Gradient */}
        <linearGradient id="tunelyNeonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary, #00e5ff)" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>

        {/* Border Glow Gradient */}
        <linearGradient id="tunelyBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary, #00e5ff)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.4" />
        </linearGradient>

        {/* Drop Shadow Filter */}
        <filter id="tunelyGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Squircle Container Badge */}
      <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#tunelyBgGrad)" stroke="url(#tunelyBorderGrad)" strokeWidth="12" />

      {/* Inner Subtle Ring */}
      <rect x="38" y="38" width="436" height="436" rx="94" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="3" />

      {/* Minimalist Neon Soundwave & Note Icon */}
      <g filter="url(#tunelyGlow)">
        {/* Equalizer Sound Bars */}
        <rect x="136" y="210" width="28" height="92" rx="14" fill="url(#tunelyNeonGrad)" opacity="0.85" />
        <rect x="188" y="150" width="28" height="212" rx="14" fill="url(#tunelyNeonGrad)" opacity="0.95" />
        <rect x="240" y="96" width="28" height="320" rx="14" fill="url(#tunelyNeonGrad)" />
        <rect x="292" y="160" width="28" height="192" rx="14" fill="url(#tunelyNeonGrad)" opacity="0.95" />
        <rect x="344" y="220" width="28" height="72" rx="14" fill="url(#tunelyNeonGrad)" opacity="0.85" />

        {/* Connecting Music Wave Arc */}
        <path d="M 116 256 C 200 130, 312 382, 396 256" fill="none" stroke="url(#tunelyNeonGrad)" strokeWidth="14" strokeLinecap="round" opacity="0.85" />
      </g>
    </svg>
  );
}
