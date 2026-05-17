# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-05-18

### Added
- **Habit Check-in module** — new top-level "Habits" tab for daily pushups, squats and cold shower tracking
  - One-tap check-in with auto-recorded timestamp
  - Per-item default reps configurable via settings panel (saved to localStorage)
  - Three independent heatmaps (pushups / squats / cold shower) with per-year navigation
  - Check-in log grouped by date with precise time display
  - Stats card: streak, total days, per-item days and total reps
- **Global GitHub authentication** — PAT login via Header dropdown, shared across all features
  - GitHub avatar displayed in top-right corner when signed in
  - Logout from dropdown menu
- **Strava sync trigger** — "Sync" button in Latest Activity card triggers `run_data_sync.yml` workflow dispatch
  - Real-time status polling (queued → in_progress → success / failure)
  - Clickable status badge links to GitHub Actions run
- **iOS Shortcuts guide** (`docs/ios-shortcuts.md`) — three Shortcut templates for one-tap mobile check-in without opening the browser
- **lucide-react** icon library added for consistent UI icons
- Route icon added before total distance in profile card

### Changed
- Profile card avatar removed; GitHub avatar shown when authenticated, placeholder SVG otherwise
- GitHub repo link moved from header to footer
- Footer updated to include GitHub icon + link alongside copyright
- Footprint Map (ChinaMap) height increased by 10px (180 → 190)
- Workflow `run_data_sync.yml`: removed "Make svg GitHub profile" and "Set Output" steps; removed SVG-related env vars (`ATHLETE`, `TITLE`, `MIN_GRID_DISTANCE`, `TITLE_GRID`); simplified `publish_github_pages` job to use hardcoded values
- `data/checkins.json` added as the persistent check-in data store (read/written via GitHub Contents API)

### Removed
- Local avatar image dependency from ProfileCard
- Device Flow OAuth (replaced with simpler PAT input in header dropdown)

---

## [2.0.0] - 2024

### Added
- Full dashboard redesign with two-column layout
- ContributionHeatmap with multi-year support and sport-type color palettes
- TracksPage with Mapbox route visualization
- ChinaMap footprint heatmap
- PersonalBest component
- CalendarWidget
- Dark/light theme with CSS custom properties
- i18n (zh/en) via Context
- Config via `config.yml` (locale, theme, goals)
- Gym mode with session tracking

### Changed
- Migrated from plain HTML/JS to React 18 + TypeScript + Vite
- Tailwind CSS v4

---

## [1.0.0] - 2023

### Added
- Initial workout dashboard
- Activity heatmap
- Static activities.json data pipeline
- GitHub Pages deployment
