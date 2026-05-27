import siteMetadata from '../static/site-metadata'

interface BrandingBarProps {
  className?: string
}

export function BrandingBar({ className = '' }: BrandingBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={siteMetadata.logo} alt="avatar" className="w-7 h-7 rounded-full" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold">WORKOUT LOG</span>
        <span className="text-[10px] text-[var(--color-muted)]">https://github.com/zhaohongxuan/workouts</span>
      </div>
    </div>
  )
}
