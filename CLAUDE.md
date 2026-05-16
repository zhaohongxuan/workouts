# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (Vite)
pnpm build        # Type-check + build to dist/
pnpm preview      # Preview production build

# Data pipeline (Python)
pnpm data:download:garmin   # Sync from Garmin
pnpm data:analysis          # Regenerate SVG stats
pnpm data:clean             # Wipe local data files

# Type-check only
./node_modules/.bin/tsc --noEmit
```

## Architecture

The frontend is a single-page React app with no routing. All data is loaded statically from `src/static/activities.json` at build time — there is no API.

**State lives in `App.tsx`:**
- `filter: SportFilter` ('all' | 'Run' | 'Ride') — set on `<div data-filter={filter}>`, which drives `--color-accent` via CSS
- `year: number | null` — year filter for most components
- `selectedActivity: Activity | null` — shared selection between heatmap, map, and activity log

`filtered = useFilteredActivities(activities, filter, year)` is passed to most components. `activities` (unfiltered) is passed only to `ProfileCard` and `PersonalBest` so they always show all-time data.

**i18n pattern:**
- Translations in `src/i18n.ts` — flat key/value dict for zh/en
- `useLocale()` hook (Context) returns `{ locale, setLocale, t }` — `t('key')` for translations
- Locale persisted in `localStorage`, defaults to 'zh'
- For strings not in the dict, use `locale === 'zh' ? '中文' : 'English'` inline

**Theme:**
- `useTheme()` hook toggles `dark` class on `<html>` element, persisted in `localStorage`
- All colors are CSS variables defined in `src/index.css` — use `var(--color-*)` not Tailwind color classes

**`--color-accent`** dynamically changes based on `data-filter` attribute:
- `all` → purple (#a855f7)
- `Run` → orange (#f97316)
- `Ride` → blue (#3b82f6)

**Key data utilities (all in `src/hooks/useActivities.ts`):**
- `formatDistance(meters)` → rounded km string (no decimals)
- `formatPace(speedMs)` → `"5'30"` format
- `parseMovingTime("H:MM:SS")` → seconds
- `formatDuration(timeStr)` → `"1h 30m"` format

**Activity data shape** (`src/types.ts`):
- `distance` in meters, `average_speed` in m/s, `moving_time` as `"H:MM:SS"` string
- `location_country` can be: JSON-like dict string `{'country': ..., 'province': ...}`, `"city:province"` format, or comma-separated address
- `summary_polyline` null means treadmill/no GPS

**GPS validation pattern** (used in PersonalBest):
- Filter `summary_polyline` truthy AND `length > 20` (single-point GPS anomaly check)
- Filter pace 180–480 sec/km to exclude GPS drift

**Heatmap** (`ContributionHeatmap.tsx`): `buildYearGrid()` helper builds a 7-row × 53-week grid. `selectedYear` can be a number or `'all'` (stacks all years). Animation uses `@keyframes fadeSlideIn` injected via `<style>` tag.

**PersonalBest** distances: 5K (4.8–5.5km), 10K (9.5–11km), Half (20–22.5km), Full (41–44km).

## GitHub Pages Deployment

Workflow at `.github/workflows/gh-pages.yml` — checks out `master`, builds with `PATH_PREFIX=/$REPO_NAME`, deploys via `actions/deploy-pages`. Vite config reads `process.env.PATH_PREFIX` for the `base` option.
