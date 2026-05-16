import { useState } from 'react'
import './index.css'
import type { Activity, SportFilter } from './types'
import { useFilteredActivities, getAvailableYears } from './hooks/useActivities'
import { useTheme } from './hooks/useTheme'
import { LocaleProvider } from './hooks/useLocale'
import { Header } from './components/Header'
import { StatsCards } from './components/StatsCards'
import { ContributionHeatmap } from './components/ContributionHeatmap'
import { ActivityLog } from './components/ActivityLog'
import { RouteMap } from './components/RouteMap'
import { CalendarWidget } from './components/CalendarWidget'
import { MonthlyChart } from './components/MonthlyChart'
import { ProfileCard } from './components/ProfileCard'
import { PersonalBest } from './components/PersonalBest'
import { HeatmapPage } from './components/HeatmapPage'
import { TracksPage } from './components/TracksPage'
import rawActivities from './static/activities.json'

const activities = rawActivities as Activity[]

type Page = 'home' | 'heatmap' | 'tracks'

export default function App() {
  const { dark, toggle } = useTheme()
  const [filter, setFilter] = useState<SportFilter>('all')
  const [year, setYear] = useState<number | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [page, setPage] = useState<Page>('home')

  const years = getAvailableYears(activities)
  const filtered = useFilteredActivities(activities, filter, year)
  const heatmapYear = year ?? years[0] ?? new Date().getFullYear()

  return (
    <LocaleProvider>
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

      {page === 'heatmap' ? (
        <HeatmapPage
          activities={filtered}
          filter={filter}
          onSelectActivity={setSelectedActivity}
          onBack={() => setPage('home')}
        />
      ) : page === 'tracks' ? (
        <TracksPage
          activities={filtered}
          filter={filter}
          onSelectActivity={setSelectedActivity}
          onBack={() => setPage('home')}
        />
      ) : (
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Single two-column layout */}
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
            <RouteMap
              activities={filtered}
              selectedActivity={selectedActivity}
              dark={dark}
              onClearSelection={() => setSelectedActivity(null)}
            />
            <PersonalBest activities={activities} onSelectActivity={setSelectedActivity} />
            <CalendarWidget
              activities={filtered}
              onSelectActivity={setSelectedActivity}
            />
            <MonthlyChart activities={filtered} year={heatmapYear} onYearChange={setYear} />
          </div>
        </div>
      </main>
      )}

      <footer className="text-center py-6 text-sm text-[var(--color-muted)] border-t border-[var(--color-border)]">
        &copy; {new Date().getFullYear()} Workout Dashboard. All miles counted.
      </footer>
      </div>
    </LocaleProvider>
  )
}
