import fs from 'fs';
import path from 'path';

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="tunelyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00e5ff" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Glowing Minimalist Soundwave Equalizer Bars -->
  <g filter="url(#glow)">
    <rect x="110" y="210" width="28" height="92" rx="14" fill="url(#tunelyGrad)" opacity="0.8" />
    <rect x="166" y="150" width="28" height="212" rx="14" fill="url(#tunelyGrad)" opacity="0.9" />
    <rect x="222" y="90" width="28" height="332" rx="14" fill="url(#tunelyGrad)" />
    <rect x="278" y="160" width="28" height="192" rx="14" fill="url(#tunelyGrad)" opacity="0.9" />
    <rect x="334" y="220" width="28" height="72" rx="14" fill="url(#tunelyGrad)" opacity="0.8" />
  </g>

  <!-- Sleek Curved Music Wave Accent -->
  <path d="M 90 256 C 180 140, 332 370, 422 256" fill="none" stroke="url(#tunelyGrad)" stroke-width="14" stroke-linecap="round" opacity="0.75" />
</svg>`;

const targetSvg = 'C:/Users/adity/Desktop/Project - S/public/logo.svg';
const targetFavicon = 'C:/Users/adity/Desktop/Project - S/public/favicon.svg';

fs.writeFileSync(targetSvg, svgContent);
fs.writeFileSync(targetFavicon, svgContent);

console.log('Transparent minimalist SVG logo created successfully!');
