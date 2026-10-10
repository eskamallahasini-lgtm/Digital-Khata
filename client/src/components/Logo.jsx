// The Digital Khata logo: an open ledger book with a rupee symbol.
// It is drawn with SVG, so no image download is needed.
// Props:
//   size    - icon size in pixels (default 40)
//   showText - show the name and tagline beside the icon (default true)
//   light   - use white text (for dark/navy backgrounds like the sidebar)
//   tagline - show the tagline under the name (default true)

export function LogoIcon({ size = 40 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label="Digital Khata logo"
    >
      <rect width="48" height="48" rx="11" fill="#15803d" />
      <path
        d="M8 13 Q16 10 24 14 Q32 10 40 13 V37 Q32 34 24 38 Q16 34 8 37 Z"
        fill="#ffffff"
      />
      <path
        d="M18.5 18 H29.5 M18.5 23 H29.5 M20.5 18 C28 18 28 28 20.5 28 L29.5 34"
        fill="none"
        stroke="#0f2742"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ size = 40, showText = true, light = false, tagline = true }) {
  return (
    <div className={`logo ${light ? 'logo-light' : ''}`}>
      <LogoIcon size={size} />
      {showText && (
        <div className="logo-text">
          <span className="logo-name">Digital Khata</span>
          {tagline && <span className="logo-tagline">Simple Credit. Clear Records.</span>}
        </div>
      )}
    </div>
  );
}