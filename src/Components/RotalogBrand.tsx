interface RotalogBrandProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
}

export function RotalogBrand({
  className = '',
  iconClassName = 'h-16 w-16',
  textClassName = 'text-4xl',
  showWordmark = true,
}: RotalogBrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <svg
        viewBox="0 0 128 128"
        className={`${iconClassName} shrink-0`.trim()}
        role="img"
        aria-label="Logo da Rotalog"
      >
        <circle cx="64" cy="64" r="60" fill="#111418" stroke="#111418" strokeWidth="8" />
        <circle cx="64" cy="64" r="48" fill="none" stroke="#43d46b" strokeWidth="10" />
        <path
          d="M64 25C44 25 28 41 28 61c0 15 9 24 18 34 7 8 13 15 18 26 5-11 11-18 18-26 9-10 18-19 18-34 0-20-16-36-36-36Z"
          fill="#43d46b"
        />
        <path
          d="M52 114c-7 0-13-2-18-6 8 2 16 1 23-3 4-2 7-5 11-8-1 9-7 17-16 17Z"
          fill="#43d46b"
        />
        <g transform="translate(40 38)">
          <path
            d="M24 4 41 12 24 21 7 12 24 4Z"
            fill="#f5f7fa"
            stroke="#111418"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M7 12v24l17 10V21L7 12Z"
            fill="#ffffff"
            stroke="#111418"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M41 12v24L24 46V21l17-9Z"
            fill="#f0f2f5"
            stroke="#111418"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M24 21v11" stroke="#111418" strokeWidth="3" strokeLinecap="round" />
          <path d="M15 17v12" stroke="#111418" strokeWidth="3" strokeLinecap="round" />
          <path d="m24 21 17-9" stroke="#111418" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      {showWordmark && (
        <span className={`font-black tracking-tight leading-none ${textClassName}`.trim()}>
          <span className="text-[#43d46b]">Rota</span>
          <span className="text-[#43d46b]">Log</span>
        </span>
      )}
    </div>
  );
}