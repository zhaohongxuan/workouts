import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity } from '../types'
import { parseMovingTime } from '../hooks/useActivities'
import { useLocale } from '../hooks/useLocale'

const STORAGE_KEY = 'highlight_pinned_ids'

interface HighlightActivitiesProps {
  activities: Activity[]
  onSelect: (a: Activity) => void
  selectedActivity?: Activity | null
}

interface HighlightItem {
  activity: Activity
  // Milestone badges (auto). Empty for user-pinned items.
  badges: { icon: string; labelZh: string; labelEn: string }[]
}

// Paces outside this range are treated as GPS drift (same bounds as PersonalBest).
const PACE_MIN = 180
const PACE_MAX = 480

const DISTANCE_BESTS: { key: string; min: number; max: number; icon: string; zh: string; en: string }[] = [
  { key: '5k', min: 4.8, max: 5.5, icon: '🥇', zh: '最快 5K', en: 'Fastest 5K' },
  { key: '10k', min: 9.5, max: 11, icon: '🥇', zh: '最快 10K', en: 'Fastest 10K' },
  { key: 'half', min: 20, max: 22.5, icon: '🥇', zh: '最快半马', en: 'Fastest Half' },
  { key: 'full', min: 41, max: 44, icon: '🥇', zh: '最快全马', en: 'Fastest Full' },
]

function isValidPace(a: Activity): boolean {
  if (a.type !== 'Run' || !(a.average_speed > 0)) return false
  const pace = 1000 / a.average_speed
  return pace >= PACE_MIN && pace <= PACE_MAX
}

function fmtPace(a: Activity): string {
  if (!(a.average_speed > 0)) return ''
  const secPerKm = 1000 / a.average_speed
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

function fmtDate(a: Activity, locale: string): string {
  const d = new Date(a.start_date_local)
  return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function typeIcon(type: string): string {
  const icons: Record<string, string> = { Run: '🏃', Ride: '🚴', Hike: '🥾', Swim: '🏊' }
  return icons[type] ?? '📌'
}

// Build automatic milestone highlights from the given activity set.
function buildMilestones(activities: Activity[]): HighlightItem[] {
  const byId = new Map<number, HighlightItem>()

  const ensure = (a: Activity): HighlightItem => {
    const existing = byId.get(a.run_id)
    if (existing) return existing
    const item: HighlightItem = { activity: a, badges: [] }
    byId.set(a.run_id, item)
    return item
  }

  const nonGym = activities.filter(a => a.distance > 0 || parseMovingTime(a.moving_time) > 0)

  // Longest distance
  const longest = nonGym
    .filter(a => a.distance > 0)
    .reduce<Activity | null>((best, a) => (!best || a.distance > best.distance ? a : best), null)
  if (longest) {
    ensure(longest).badges.push({ icon: '🏆', labelZh: '最长距离', labelEn: 'Longest' })
  }

  // Max elevation gain
  const climber = nonGym
    .filter(a => (a.elevation_gain ?? 0) > 0)
    .reduce<Activity | null>((best, a) => (!best || (a.elevation_gain ?? 0) > (best.elevation_gain ?? 0) ? a : best), null)
  if (climber) {
    ensure(climber).badges.push({ icon: '⛰️', labelZh: '最大爬升', labelEn: 'Most Climb' })
  }

  // Fastest pace (valid runs only)
  const fastest = nonGym
    .filter(isValidPace)
    .reduce<Activity | null>((best, a) => (!best || a.average_speed > best.average_speed ? a : best), null)
  if (fastest) {
    ensure(fastest).badges.push({ icon: '⚡', labelZh: '最快配速', labelEn: 'Fastest Pace' })
  }

  // Longest streak
  const streak = nonGym
    .filter(a => (a.streak ?? 0) > 0)
    .reduce<Activity | null>((best, a) => (!best || (a.streak ?? 0) > (best.streak ?? 0) ? a : best), null)
  if (streak) {
    ensure(streak).badges.push({ icon: '🔥', labelZh: `连续 ${streak.streak} 天`, labelEn: `${streak.streak}-day streak` })
  }

  // Distance PRs
  for (const d of DISTANCE_BESTS) {
    const best = nonGym
      .filter(a => a.type === 'Run' && a.distance / 1000 >= d.min && a.distance / 1000 <= d.max && isValidPace(a))
      .reduce<Activity | null>((b, a) => (!b || a.average_speed > b.average_speed ? a : b), null)
    if (best) {
      ensure(best).badges.push({ icon: d.icon, labelZh: d.zh, labelEn: d.en })
    }
  }

  return [...byId.values()]
}

export function HighlightActivities({ activities, onSelect, selectedActivity }: HighlightActivitiesProps) {
  const { locale } = useLocale()
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as number[]) : []
    } catch {
      return []
    }
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  // Persist pinned ids
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds))
    } catch {
      /* ignore quota errors */
    }
  }, [pinnedIds])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  const byId = useMemo(() => new Map(activities.map(a => [a.run_id, a])), [activities])

  const milestones = useMemo(() => buildMilestones(activities), [activities])

  // Pinned activities resolved against the FULL activity list is not available here;
  // resolve against `activities`; ids not in the current filter are skipped.
  const pinnedItems = useMemo<HighlightItem[]>(() => {
    const items: HighlightItem[] = []
    for (const id of pinnedIds) {
      const a = byId.get(id)
      if (a) items.push({ activity: a, badges: [] })
    }
    return items
  }, [pinnedIds, byId])

  // Merge: milestones first, then pinned that aren't already present.
  const combined = useMemo(() => {
    const seen = new Set(milestones.map(m => m.activity.run_id))
    const extra = pinnedItems.filter(p => !seen.has(p.activity.run_id))
    return { milestones, pinned: extra }
  }, [milestones, pinnedItems])

  const pinnedSet = new Set(pinnedIds)
  const togglePin = (a: Activity) => {
    setPinnedIds(prev => prev.includes(a.run_id) ? prev.filter(id => id !== a.run_id) : [...prev, a.run_id])
  }

  // Picker results
  const pickerResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? activities.filter(a => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q))
      : activities
    return [...list]
      .sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())
      .slice(0, 60)
  }, [activities, query])

  const hasAny = combined.milestones.length > 0 || combined.pinned.length > 0

  const renderCard = (item: HighlightItem, pinnable: boolean) => {
    const a = item.activity
    const isSelected = selectedActivity?.run_id === a.run_id
    const isPinned = pinnedSet.has(a.run_id)
    return (
      <div
        key={a.run_id}
        onClick={() => onSelect(a)}
        className={`group relative cursor-pointer rounded-lg border p-2.5 transition-all ${
          isSelected
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60 bg-[var(--color-bg)]'
        }`}
      >
        {/* Badges */}
        {item.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {item.badges.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                <span>{b.icon}</span>
                {locale === 'zh' ? b.labelZh : b.labelEn}
              </span>
            ))}
          </div>
        )}
        {item.badges.length === 0 && pinnable && (
          <div className="flex items-center gap-1 mb-1 text-[9px] font-medium text-[var(--color-muted)]">
            <span>⭐</span>
            {locale === 'zh' ? '自选' : 'Pinned'}
          </div>
        )}
        <div className="flex items-start gap-1.5">
          <span className="text-sm leading-none mt-0.5">{typeIcon(a.type)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate text-[var(--color-text)]">{a.name}</p>
            <p className="text-[10px] text-[var(--color-muted)] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{fmtDate(a, locale)}</span>
              {a.distance > 0 && <span className="font-mono">{(a.distance / 1000).toFixed(1)} km</span>}
              {isValidPace(a) && <span className="font-mono">{fmtPace(a)}</span>}
            </p>
          </div>
          {pinnable && (
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(a) }}
              className={`shrink-0 transition-colors ${isPinned ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-accent)]'}`}
              title={isPinned ? (locale === 'zh' ? '取消固定' : 'Unpin') : (locale === 'zh' ? '固定到 Highlight' : 'Pin to highlights')}
            >
              <StarIcon filled={isPinned} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">
          {locale === 'zh' ? '纪念时刻' : 'Highlights'}
        </p>
        <button
          onClick={() => setPickerOpen(o => !o)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {locale === 'zh' ? '添加' : 'Add'}
        </button>
      </div>

      {/* Picker */}
      {pickerOpen && (
        <div ref={pickerRef} className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === 'zh' ? '搜索活动名或类型…' : 'Search name or type…'}
            className="w-full px-2 py-1.5 mb-2 rounded border border-[var(--color-border)] bg-[var(--color-card)] text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] outline-none focus:border-[var(--color-accent)]"
          />
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {pickerResults.length === 0 && (
              <p className="text-[10px] text-[var(--color-muted)] px-1 py-2">{locale === 'zh' ? '无匹配活动' : 'No matches'}</p>
            )}
            {pickerResults.map(a => {
              const isPinned = pinnedSet.has(a.run_id)
              return (
                <button
                  key={a.run_id}
                  onClick={() => togglePin(a)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left text-[11px] hover:bg-[var(--color-border)]/50 transition-colors"
                >
                  <span className="shrink-0">{typeIcon(a.type)}</span>
                  <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">{a.name}</span>
                  <span className="shrink-0 text-[10px] text-[var(--color-muted)] tabular-nums">
                    {a.distance > 0 ? `${(a.distance / 1000).toFixed(1)} km` : `${Math.round(parseMovingTime(a.moving_time) / 60)}min`}
                  </span>
                  <span className={`shrink-0 ${isPinned ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}>
                    <StarIcon filled={isPinned} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cards */}
      {!hasAny ? (
        <p className="text-[11px] text-[var(--color-muted)] py-2">
          {locale === 'zh' ? '暂无纪念活动，点上方「添加」挑选。' : 'No highlights yet — click "Add" to pick some.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
          {combined.milestones.map(item => renderCard(item, true))}
          {combined.pinned.map(item => renderCard(item, true))}
        </div>
      )}
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.562.562 0 00-.182-.557l-4.204-3.602c-.379-.325-.178-.948.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}
