import { useMemo, useState } from 'react'
import './index.css'
import type { Activity, SportFilter } from './types'
import { useFilteredActivities, getAvailableYears, extractProvince } from './hooks/useActivities'
import { useTheme } from './hooks/useTheme'
import { LocaleProvider } from './hooks/useLocale'
import { GitHubAuthProvider } from './hooks/useGitHubAuthContext'
import { Header } from './components/Header'
import { StatsCards } from './components/StatsCards'
import { ContributionHeatmap } from './components/ContributionHeatmap'
import { ActivityLog } from './components/ActivityLog'
import { RouteMap } from './components/RouteMap'
import { CalendarWidget } from './components/CalendarWidget'
import { ProfileCard } from './components/ProfileCard'
import { PersonalBest } from './components/PersonalBest'
import { TracksPage } from './components/TracksPage'
import { ChinaMap } from './components/ChinaMap'
import { CheckinPage } from './components/CheckinPage'
import rawActivities from './static/activities.json'

const activities = rawActivities as Activity[]

type Page = 'home' | 'tracks' | 'checkin'

export default function App() {
  const { dark, toggle } = useTheme()
  const [filter, setFilter] = useState<SportFilter>('all')
  const [year, setYear] = useState<number | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [page, setPage] = useState<Page>('home')

  const years = getAvailableYears(activities)
  const filtered = useFilteredActivities(activities, filter, year)
  const heatmapYear = year ?? years[0] ?? new Date().getFullYear()

  // Activities filtered to the selected province (for RouteMap)
  const provinceFiltered = useMemo(() => {
    if (!selectedProvince) return filtered
    return filtered.filter(a => extractProvince(a.location_country) === selectedProvince)
  }, [filtered, selectedProvince])

  return (
    <LocaleProvider>
      <GitHubAuthProvider>
        <div className="min-h-screen bg-[var(--color-bg)]" data-filter={filter}>
      <Header
        filter={filter}
        setFilter={setFilter}
        dark={dark}
        toggleTheme={toggle}
        activities={activities}
        page={page}
        onNavigate={setPage}
      />

      {page === 'tracks' ? (
        <TracksPage
          activities={filtered}
          filter={filter}
          onSelectActivity={setSelectedActivity}
          onBack={() => setPage('home')}
        />
      ) : page === 'checkin' ? (
        <CheckinPage />
      ) : (
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left column */}
          <div className="space-y-6 min-w-0 overflow-hidden">
            <StatsCards activities={filtered} allActivities={activities} year={year} filter={filter} onSelectActivity={setSelectedActivity} />
            <ContributionHeatmap activities={filtered} year={heatmapYear} filter={filter} onSelectActivity={setSelectedActivity} />
            <ActivityLog
              activities={filtered}
              years={years}
              year={year}
              setYear={setYear}
              selectedActivity={selectedActivity}
              onSelectActivity={setSelectedActivity}
              filter={filter}
            />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6 min-w-0 overflow-hidden">
            <ProfileCard activities={activities} filter={filter} />
            <ChinaMap
              activities={filtered}
              filter={filter}
              selectedProvince={selectedProvince}
              onSelectProvince={(p) => {
                setSelectedProvince(p)
                setSelectedActivity(null)
              }}
            />
            <RouteMap
              activities={provinceFiltered}
              selectedActivity={selectedActivity}
              dark={dark}
              onClearSelection={() => setSelectedActivity(null)}
            />
            <PersonalBest activities={activities} onSelectActivity={setSelectedActivity} />
            <CalendarWidget
              activities={filtered}
              onSelectActivity={setSelectedActivity}
            />
          </div>
        </div>
      </main>
      )}

      <footer className="text-center py-6 text-sm text-[var(--color-muted)] border-t border-[var(--color-border)]">
          <div className="flex items-center justify-center gap-3">
            <span>&copy; {new Date().getFullYear()} Workout Dashboard.</span>
            <a
              href="https://github.com/zhaohongxuan/workouts"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[var(--color-text)] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>
        </footer>
        </div>
      </GitHubAuthProvider>
    </LocaleProvider>
  )
}
