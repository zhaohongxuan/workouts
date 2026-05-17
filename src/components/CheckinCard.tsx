import { useState } from 'react'
import {
  Dumbbell, Droplets, Check, Settings, X, ChevronUp, ChevronDown,
} from 'lucide-react'
import type { Checkin, CheckinItem, CheckinDefaults } from '../types/checkin'
import { useLocale } from '../hooks/useLocale'
import { useGitHubAuthContext } from '../hooks/useGitHubAuthContext'

const DEFAULTS_KEY = 'checkin_defaults'

function loadDefaults(): CheckinDefaults {
  try {
    const s = localStorage.getItem(DEFAULTS_KEY)
    if (s) return JSON.parse(s) as CheckinDefaults
  } catch { /* ignore */ }
  return { pushupsCount: 30, squatsCount: 30 }
}

function saveDefaults(d: CheckinDefaults) {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d))
}

// ── Item config ───────────────────────────────────────────────────────────────

interface ItemConfig {
  key: CheckinItem
  zh: string
  en: string
  color: string        // inactive text/border tint
  activeBg: string
  activeBorder: string
  hasCount: boolean
}

const ITEMS: ItemConfig[] = [
  {
    key: 'pushups',
    zh: '俯卧撑', en: 'Pushups',
    color: 'orange',
    activeBg: 'bg-orange-500', activeBorder: 'border-orange-500',
    hasCount: true,
  },
  {
    key: 'squats',
    zh: '深蹲', en: 'Squats',
    color: 'blue',
    activeBg: 'bg-blue-500', activeBorder: 'border-blue-500',
    hasCount: true,
  },
  {
    key: 'coldShower',
    zh: '冷水澡', en: 'Cold Shower',
    color: 'cyan',
    activeBg: 'bg-cyan-500', activeBorder: 'border-cyan-500',
    hasCount: false,
  },
]

function ItemIcon({ itemKey, className }: { itemKey: CheckinItem; className?: string }) {
  if (itemKey === 'pushups') return <Dumbbell className={className} />
  if (itemKey === 'squats') return <Dumbbell className={className} style={{ transform: 'rotate(90deg)' }} />
  return <Droplets className={className} />
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

// ── Settings drawer ───────────────────────────────────────────────────────────

function SettingsDrawer({
  defaults,
  onChange,
  onClose,
}: {
  defaults: CheckinDefaults
  onChange: (d: CheckinDefaults) => void
  onClose: () => void
}) {
  const { locale } = useLocale()
  const [vals, setVals] = useState(defaults)

  const update = (key: keyof CheckinDefaults, delta: number) => {
    setVals((prev) => {
      const next = { ...prev, [key]: Math.max(1, (prev[key] ?? 1) + delta) }
      onChange(next)
      return next
    })
  }

  const handleInput = (key: keyof CheckinDefaults, value: string) => {
    const n = parseInt(value)
    if (!isNaN(n) && n > 0) {
      const next = { ...vals, [key]: n }
      setVals(next)
      onChange(next)
    }
  }

  const rows: { key: keyof CheckinDefaults; zh: string; en: string }[] = [
    { key: 'pushupsCount', zh: '俯卧撑默认数量', en: 'Default Pushups Reps' },
    { key: 'squatsCount', zh: '深蹲默认数量', en: 'Default Squats Reps' },
  ]

  return (
    <div className="mb-5 p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {locale === 'zh' ? '打卡默认设置' : 'Default Reps Settings'}
        </span>
        <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-muted)]">
              {locale === 'zh' ? row.zh : row.en}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => update(row.key, -5)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                value={vals[row.key]}
                onChange={(e) => handleInput(row.key, e.target.value)}
                className="w-14 text-center px-1 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
              <button
                onClick={() => update(row.key, 5)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--color-muted)] mt-3">
        {locale === 'zh' ? '打卡时将自动使用以上默认数量，设置保存在本地。' : 'These defaults are used when checking in. Saved locally.'}
      </p>
    </div>
  )
}

// ── PAT input ─────────────────────────────────────────────────────────────────

function PATInput({ onCancel }: { onCancel: () => void }) {
  const { locale } = useLocale()
  const { loading, submitPAT } = useGitHubAuthContext()
  const [val, setVal] = useState('')

  const handleSubmit = async () => {
    await submitPAT(val)
    setVal('')
  }

  return (
    <div className="mb-5 p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-text)] mb-1">
          {locale === 'zh' ? '输入 GitHub Personal Access Token' : 'Enter GitHub Personal Access Token'}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {locale === 'zh'
            ? '前往 Fine-grained tokens，创建对本 repo 有 Contents 读写权限的 token。'
            : 'Go to Fine-grained tokens, create a token with Contents read/write on this repo.'}
        </p>
        <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer"
          className="text-xs text-[var(--color-accent)] underline mt-1 inline-block">
          github.com/settings/tokens?type=beta ↗
        </a>
      </div>
      <input
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
        placeholder="github_pat_..."
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] outline-none focus:border-[var(--color-accent)] transition-colors font-mono"
      />
      <div className="flex gap-2">
        <button onClick={() => void handleSubmit()} disabled={!val.trim() || loading}
          className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading ? (locale === 'zh' ? '验证中...' : 'Verifying...') : (locale === 'zh' ? '确认' : 'Confirm')}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          {locale === 'zh' ? '取消' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface CheckinCardProps {
  todayCheckin: Checkin | null
  saving: boolean
  onSave: (patch: Partial<Checkin>) => void
}

export function CheckinCard({ todayCheckin, saving, onSave }: CheckinCardProps) {
  const { locale } = useLocale()
  const { token, showPATInput, setShowPATInput } = useGitHubAuthContext()
  const [showSettings, setShowSettings] = useState(false)
  const [defaults, setDefaults] = useState<CheckinDefaults>(loadDefaults)

  const handleDefaultsChange = (d: CheckinDefaults) => {
    setDefaults(d)
    saveDefaults(d)
  }

  const today = new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const handleClick = (item: ItemConfig) => {
    if (!token) return
    const done = todayCheckin?.[item.key] ?? false
    if (done) {
      // toggle off — clear all fields for this item
      const patch: Partial<Checkin> = { [item.key]: false }
      if (item.key === 'pushups') { patch.pushupsCount = undefined; patch.pushupsAt = undefined }
      if (item.key === 'squats')  { patch.squatsCount  = undefined; patch.squatsAt  = undefined }
      if (item.key === 'coldShower') patch.coldShowerAt = undefined
      onSave(patch)
    } else {
      // check in with defaults + current timestamp
      const now = new Date().toISOString().slice(0, 19) // "YYYY-MM-DDTHH:mm:ss"
      const patch: Partial<Checkin> = { [item.key]: true }
      if (item.key === 'pushups')    { patch.pushupsCount = defaults.pushupsCount; patch.pushupsAt = now }
      if (item.key === 'squats')     { patch.squatsCount  = defaults.squatsCount;  patch.squatsAt  = now }
      if (item.key === 'coldShower') { patch.coldShowerAt = now }
      onSave(patch)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {locale === 'zh' ? '今日打卡' : "Today's Check-in"}
          </h2>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {token && (
            <button
              onClick={() => setShowSettings((s) => !s)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-border)] transition-colors ${showSettings ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}
              title={locale === 'zh' ? '默认设置' : 'Settings'}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {!token && (
            <button
              onClick={() => setShowPATInput(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
            >
              <GitHubIcon className="w-4 h-4" />
              {locale === 'zh' ? 'GitHub 登录' : 'Login with GitHub'}
            </button>
          )}
        </div>
      </div>

      {showPATInput && (
        <PATInput onCancel={() => setShowPATInput(false)} />
      )}

      {showSettings && token && (
        <SettingsDrawer
          defaults={defaults}
          onChange={handleDefaultsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Checkin buttons */}
      <div className="grid grid-cols-3 gap-3">
        {ITEMS.map((item) => {
          const done = todayCheckin?.[item.key] ?? false
          const countVal = item.key === 'pushups'
            ? todayCheckin?.pushupsCount
            : item.key === 'squats'
            ? todayCheckin?.squatsCount
            : undefined
          const defaultCount = item.key === 'pushups'
            ? defaults.pushupsCount
            : item.key === 'squats'
            ? defaults.squatsCount
            : undefined
          const atVal = item.key === 'pushups'
            ? todayCheckin?.pushupsAt
            : item.key === 'squats'
            ? todayCheckin?.squatsAt
            : todayCheckin?.coldShowerAt
          const timeStr = atVal ? atVal.slice(11, 16) : null // "HH:mm"

          return (
            <button
              key={item.key}
              onClick={() => handleClick(item)}
              disabled={!token || saving}
              className={`
                relative flex flex-col items-center justify-center gap-2.5 py-6 px-3 rounded-xl border-2 font-medium transition-all select-none
                ${done
                  ? `${item.activeBg} ${item.activeBorder} text-white shadow-lg`
                  : `bg-transparent border-${item.color}-200 dark:border-${item.color}-900 text-${item.color}-500 hover:border-${item.color}-400 hover:bg-${item.color}-50 dark:hover:bg-${item.color}-950/30`}
                ${!token ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                ${saving ? 'opacity-60' : ''}
              `}
            >
              {done && (
                <span className="absolute top-2.5 right-2.5 opacity-80">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
              <ItemIcon itemKey={item.key} className="w-7 h-7" />
              <span className="text-sm font-semibold leading-none">
                {locale === 'zh' ? item.zh : item.en}
              </span>
              {/* count line */}
              <span className={`text-[11px] leading-none ${done ? 'text-white/70' : `text-${item.color}-400`}`}>
                {item.hasCount
                  ? done && countVal != null
                    ? `${countVal} ${locale === 'zh' ? '个' : 'reps'}`
                    : `${defaultCount} ${locale === 'zh' ? '个' : 'reps'}`
                  : done
                  ? (locale === 'zh' ? '已完成' : 'Done')
                  : (locale === 'zh' ? '点击打卡' : 'Tap to log')}
              </span>
              {/* time line */}
              {done && timeStr && (
                <span className="text-[10px] leading-none text-white/50">{timeStr}</span>
              )}
            </button>
          )
        })}
      </div>

      {!token && !showPATInput && (
        <p className="text-center text-xs text-[var(--color-muted)] mt-4">
          {locale === 'zh' ? '登录后才能打卡' : 'Login to start checking in'}
        </p>
      )}
      {saving && (
        <p className="text-center text-xs text-[var(--color-muted)] mt-3 animate-pulse">
          {locale === 'zh' ? '保存中...' : 'Saving...'}
        </p>
      )}
    </div>
  )
}
