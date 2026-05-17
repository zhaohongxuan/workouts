import { Dumbbell, Droplets, Flame, CalendarCheck } from 'lucide-react'
import type { Checkin } from '../types/checkin'
import { useLocale } from '../hooks/useLocale'

function computeStreak(checkins: Checkin[]): number {
  const sorted = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
  const today = new Date().toLocaleDateString('sv-SE')
  let streak = 0
  let expected = today
  for (const c of sorted) {
    if (c.date !== expected) break
    if (c.pushups || c.squats || c.coldShower) {
      streak++
      const d = new Date(expected)
      d.setDate(d.getDate() - 1)
      expected = d.toLocaleDateString('sv-SE')
    } else break
  }
  return streak
}

export function CheckinStats({ checkins }: { checkins: Checkin[] }) {
  const { locale } = useLocale()
  const streak = computeStreak(checkins)
  const totalDays = checkins.filter((c) => c.pushups || c.squats || c.coldShower).length
  const pushupDays = checkins.filter((c) => c.pushups).length
  const pushupReps = checkins.reduce((s, c) => s + (c.pushupsCount ?? 0), 0)
  const squatDays = checkins.filter((c) => c.squats).length
  const squatReps = checkins.reduce((s, c) => s + (c.squatsCount ?? 0), 0)
  const coldShowerDays = checkins.filter((c) => c.coldShower).length

  const stats = [
    {
      label: locale === 'zh' ? '连续打卡' : 'Streak',
      primary: streak,
      unit: locale === 'zh' ? '天' : 'd',
      sub: null,
      Icon: Flame,
      iconColor: 'text-[var(--color-accent)]',
      valueColor: 'text-[var(--color-accent)]',
    },
    {
      label: locale === 'zh' ? '累计天数' : 'Total Days',
      primary: totalDays,
      unit: locale === 'zh' ? '天' : 'd',
      sub: null,
      Icon: CalendarCheck,
      iconColor: 'text-[var(--color-muted)]',
      valueColor: 'text-[var(--color-text)]',
    },
    {
      label: locale === 'zh' ? '俯卧撑' : 'Pushups',
      primary: pushupDays,
      unit: locale === 'zh' ? '天' : 'd',
      sub: pushupReps > 0 ? `${pushupReps} ${locale === 'zh' ? '个' : 'reps'}` : null,
      Icon: Dumbbell,
      iconColor: 'text-orange-500',
      valueColor: 'text-orange-500',
    },
    {
      label: locale === 'zh' ? '深蹲' : 'Squats',
      primary: squatDays,
      unit: locale === 'zh' ? '天' : 'd',
      sub: squatReps > 0 ? `${squatReps} ${locale === 'zh' ? '个' : 'reps'}` : null,
      Icon: Dumbbell,
      iconColor: 'text-blue-500',
      valueColor: 'text-blue-500',
    },
    {
      label: locale === 'zh' ? '冷水澡' : 'Cold Shower',
      primary: coldShowerDays,
      unit: locale === 'zh' ? '天' : 'd',
      sub: null,
      Icon: Droplets,
      iconColor: 'text-cyan-500',
      valueColor: 'text-cyan-500',
    },
  ]

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-4">
        {locale === 'zh' ? '打卡统计' : 'Checkin Stats'}
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1.5 py-2">
            <s.Icon className={`w-4 h-4 ${s.iconColor}`} />
            <div className={`text-xl font-bold leading-none ${s.valueColor}`}>
              {s.primary}
              <span className="text-xs font-normal ml-0.5">{s.unit}</span>
            </div>
            {s.sub && (
              <div className="text-[10px] text-[var(--color-muted)] leading-none">{s.sub}</div>
            )}
            <div className="text-[10px] text-[var(--color-muted)] text-center leading-tight">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
