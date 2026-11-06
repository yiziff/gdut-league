interface Props {
  className?: string;
}

/** 校园联赛标志：橙色底、白色 C、一颗黄球。 */
export default function BrandMark({ className = 'h-10 w-10' }: Props) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="校园联赛">
      <rect width="64" height="64" rx="16" fill="#f36c16" />
      <path
        d="M44 17.5a17.5 17.5 0 1 0 2.2 29"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="50" cy="31.5" r="7.2" fill="#ffe14a" />
      <circle cx="50" cy="31.5" r="7.2" fill="none" stroke="#111" strokeOpacity="0.16" strokeWidth="1.4" />
    </svg>
  );
}
