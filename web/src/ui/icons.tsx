export const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

export const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)

export const BrandIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="2" /></svg>
)

const Stroke = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

export const CopyIcon = () => <Stroke d="M9 9h11v11H9zM5 15H4V4h11v1" />
export const MoveIcon = () => <Stroke d="M5 12h14M13 6l6 6-6 6" />
export const ClearIcon = () => <Stroke d="M6 6l12 12M18 6L6 18" />
export const TuneIcon = () => <Stroke d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2M14 4v4M8 10v4M16 16v4" />
export const ForceIcon = () => <Stroke d="M12 3v9M9 15a3 3 0 1 0 6 0a3 3 0 1 0-6 0M5 9c-1.5 1.5-1.5 4.5 0 6M19 9c1.5 1.5 1.5 4.5 0 6" />
export const ShowIcon = () => <Stroke d="M15 6l-6 6 6 6" size={14} />
export const HideIcon = () => <Stroke d="M9 6l6 6-6 6" size={14} />
export const TickIcon = () => <Stroke d="M5 12l5 5 9-10" size={12} />

export const KeyboardIcon = () => (
  <svg width="96" height="64" viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 10h80v44H8zM16 20h6M28 20h6M40 20h6M52 20h6M64 20h6M76 20h4M16 30h6M28 30h6M40 30h6M52 30h6M64 30h6M76 30h4M26 42h44" /></svg>
)

export const MouseIcon = () => (
  <svg width="96" height="64" viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M48 6c-12 0-18 8-18 20v14c0 10 7 18 18 18s18-8 18-18V26c0-12-6-20-18-20zM48 6v18M30 24h36" /></svg>
)
