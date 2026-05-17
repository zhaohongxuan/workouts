import { useState, useMemo } from 'react'
import { Dumbbell, Droplets, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import type { Checkin } from '../types/checkin'
import { useLocale } from '../hooks/useLocale'

const PAGE_SIZE = 20

interface LogEntry {
  date: string        // YYYY-MM-DD
  item: 'pushups' | 'squats' | 'coldShower'
  at: string          // ISO timestamp
  count?: number
}

const ITEM_META = {
  pushups: {
    zh: '俯卧撑', en: 'Pushups',
    color: '#f97316',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-500',
    Icon: ({ className }: { className?: string }) => <Dumbbell className={className} />,
  },
  squats: {
    zh: '深蹲', en: 'Squats',
    color: '#3b82f6',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-500',
    Icon: ({ className }: { className?: string }) => <Dumbbell className={className} style={{ transform: 'rotate(90deg)' }} />,
  },
  coldShower: {
    zh: '冷水澡', en: 'Cold Shower',
    color: '#06b6d4',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-500',
    Icon: ({ className }: { className?: string }) => <Droplets className={className} />,
  },
} as const

function formatAt(iso: string, locale: string): { date: string; time: string; weekday: string } {
  const d = new Date(iso)
  const date = d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: locale !== 'zh' })
  const weekday = d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' })
  return { date, time, weekday }
}

type FilterItem = 'all' | 'pushups' | 'squats' | 'coldShower'

export function CheckinLog({ checkins }: { checkins: Checkin[] }) {
  const { locale } = useLocale()
  const [filter, setFilter] = useState<FilterItem>('all')
  const [page, setPage] = useState(0)

  // Flatten all checkins into individual log entries sorted by time desc
  const allEntries = useMemo<LogEntry[]>(() => {
    const entries: LogEntry[] = []
    for (const c of checkins) {
      if (c.pushups && c.pushupsAt) {
        entries.push({ date: c.date, item: 'pushups', at: c.pushupsAt, count: c.pushupsCount })
      }
      if (c.squats && c.squatsAt) {
        entries.push({ date: c.date, item: 'squats', at: c.squatsAt, count: c.squatsCount })
      }
      if (c.coldShower && c.coldShowerAt) {
        entries.push({ date: c.date, item: 'coldShower', at: c.coldShowerAt })
      }
      // Fallback: checkin without timestamp — use date only
      if (c.pushups && !c.pushupsAt) {
        entries.push({ date: c.date, item: 'pushups', at: c.date + 'T00:00:00', count: c.pushupsCount })
      }
      if (c.squats && !c.squatsAt) {
        entries.push({ date: c.date, item: 'squats', at: c.date + 'T00:00:00', count: c.squatsCount })
      }
      if (c.coldShower && !c.coldShowerAt) {
        entries.push({ date: c.date, item: 'coldShower', at: c.date + 'T00:00:00' })
      }
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at))
  }, [checkins])

  const filtered = useMemo(
    () => filter === 'all' ? allEntries : allEntries.filter((e) => e.item === filter),
    [allEntries, filter]
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleFilter = (f: FilterItem) => { setFilter(f); setPage(0) }

  // Group page entries by date for section dividers
  const grouped = useMemo(() => {
    const groups: { date: string; entries: LogEntry[] }[] = []
    for (const entry of pageData) {
      const last = groups[groups.length - 1]
      if (last && last.date === entry.date) {
        last.entries.push(entry)
      } else {
        groups.push({ date: entry.date, entries: [entry] })
      }
    }
    return groups
  }, [pageData])

  const hasTimestamps = allEntries.some((e) => !e.at.endsWith('T00:00:00'))

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--color-text)]">
          {locale === 'zh' ? '打卡记录' : 'Checkin Log'}
        </h3>
        <span className="text-sm text-[var(--color-muted)]">
          {locale === 'zh' ? `共 ${filtered.length} 条` : `${filtered.length} entries`}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {(['all', 'pushups', 'squats', 'coldShower'] as FilterItem[]).map((f) => {
          const meta = f !== 'all' ? ITEM_META[f] : null
          const isActive = filter === f
          return (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'text-white'
                  : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
              style={isActive && meta ? { backgroundColor: meta.color } : isActive ? { backgroundColor: 'var(--color-accent)' } : {}}
            >
              {meta && <meta.Icon className="w-3 h-3" />}
              {f === 'all'
                ? (locale === 'zh' ? '全部' : 'All')
                : locale === 'zh' ? meta!.zh : meta!.en}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--color-muted)] text-sm">
          {locale === 'zh' ? '暂无记录' : 'No records yet'}
        </div>
      )}

      {/* Log entries grouped by date */}
      <div className="space-y-4">
        {grouped.map(({ date, entries }) => {
          const d = new Date(date)
          const dateLabel = d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
            month: 'long', day: 'numeric', weekday: 'long',
          })
          return (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap">
                  {dateLabel}
                </span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
              {/* Entries for this date */}
              <div className="space-y-2">
                {entries.map((entry, idx) => {
                  const meta = ITEM_META[entry.item]
                  const hasTime = !entry.at.endsWith('T00:00:00')
                  const { time } = formatAt(entry.at, locale)
                  return (
                    <div
                      key={`${entry.item}-${idx}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${meta.bg} ${meta.border}`}
                    >
                      {/* Icon */}
                      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center`}
                        style={{ backgroundColor: meta.color + '22' }}>
                        <meta.Icon className={`w-4 h-4 ${meta.text}`} />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold ${meta.text}`}>
                          {locale === 'zh' ? meta.zh : meta.en}
                        </span>
                        {entry.count != null && (
                          <span className="ml-2 text-xs text-[var(--color-muted)]">
                            {entry.count} {locale === 'zh' ? '个' : 'reps'}
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <div className="shrink-0 flex items-center gap-1 text-xs text-[var(--color-muted)]">
                        {hasTime && <Clock className="w-3 h-3" />}
                        <span className="font-mono">
                          {hasTime ? time : (locale === 'zh' ? '时间未记录' : 'no time')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {locale === 'zh' ? '上一页' : 'Prev'}
          </button>
          <span className="text-sm text-[var(--color-muted)]">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
          >
            {locale === 'zh' ? '下一页' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notice for old entries without timestamps */}
      {!hasTimestamps && checkins.length > 0 && (
        <p className="text-xs text-[var(--color-muted)] mt-3 text-center">
          {locale === 'zh'
            ? '历史记录未含时间信息，新打卡将自动记录时间'
            : 'Historical records have no timestamps. New check-ins will record time automatically.'}
        </p>
      )}
    </div>
  )
}
