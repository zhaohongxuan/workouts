import { useGitHubAuthContext } from '../hooks/useGitHubAuthContext'
import { useCheckins } from '../hooks/useCheckins'
import { CheckinCard } from './CheckinCard'
import { CheckinStats } from './CheckinStats'
import { CheckinHeatmap } from './CheckinHeatmap'
import { CheckinLog } from './CheckinLog'
import { useLocale } from '../hooks/useLocale'
import type { Checkin } from '../types/checkin'

export function CheckinPage() {
  const { locale } = useLocale()
  const { token } = useGitHubAuthContext()
  const { checkins, todayCheckin, saveCheckin, loading, saving, error } = useCheckins(token)

  return (
    <main className="max-w-[900px] mx-auto px-6 py-6 space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-500">
          {locale === 'zh' ? '错误：' : 'Error: '}{error}
        </div>
      )}

      <CheckinCard
        todayCheckin={todayCheckin}
        saving={saving}
        onSave={(patch: Partial<Checkin>) => { void saveCheckin(patch) }}
      />

      {loading ? (
        <div className="text-center text-sm text-[var(--color-muted)] py-8 animate-pulse">
          {locale === 'zh' ? '加载打卡记录...' : 'Loading checkin records...'}
        </div>
      ) : (
        <>
          <CheckinStats checkins={checkins} />
          <CheckinHeatmap checkins={checkins} />
          <CheckinLog checkins={checkins} />
        </>
      )}
    </main>
  )
}
