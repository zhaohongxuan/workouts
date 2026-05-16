# Workout Log

基于 React + TypeScript + Tailwind CSS 构建的现代运动数据看板，支持跑步、骑行、徒步、健身等多种运动类型的可视化展示。

> 数据管道基于 [running_page](https://github.com/yihong0618/running_page) 项目。在线演示：[zhaohongxuan.github.io/workouts](http://zhaohongxuan.github.io/workouts)

## 功能特性

- **活动热力图** — GitHub 风格的年度热力图，按运动类型区分颜色（跑步橙、骑行蓝、徒步绿、训练玫红），支持展开月度视图
- **轨迹墙** — SVG 路线缩略图墙，自动聚合相似路线，支持按年份筛选
- **路线地图** — Mapbox 驱动的交互式地图，展示所有 GPS 轨迹，支持全屏模式
- **个人最佳** — 5K / 10K / 半马 / 全马距离的 PR 记录
- **数据统计** — 年度、月度、周度目标及与同期对比
- **连续记录** — 连续打卡天数和周数，周历一览本周活动
- **活动记录** — 分页表格，支持年份和距离筛选
- **月度日历** — 展示每日运动公里数，hover 显示日期
- **健身记录** — 力量训练、综合训练等非有氧运动单独展示
- **双语支持** — 中文 / 英文一键切换
- **深色模式** — 跟随系统或手动切换
- **运动筛选** — 全部 / 跑步 / 骑行 / 徒步 / 健身 全局过滤

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS v4 |
| 图表 | Recharts |
| 地图 | Mapbox GL + react-map-gl |
| 路线解码 | @mapbox/polyline |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 生产构建
pnpm build

# 预览构建产物
pnpm preview
```

## 数据同步

活动数据通过 Strava / Garmin 同步脚本生成，存储为 `src/static/activities.json`。

```bash
# 同步最近 7 天（从环境变量读取凭证）
export STRAVA_CLIENT_ID=xxx
export STRAVA_CLIENT_SECRET=yyy
export STRAVA_REFRESH_TOKEN=zzz
python run_page/strava_sync_recent.py

# 全量同步
python run_page/strava_sync.py CLIENT_ID CLIENT_SECRET REFRESH_TOKEN
```

## 项目结构

```
src/
├── App.tsx                      # 应用入口与路由
├── i18n.ts                      # 中英文翻译字典
├── types.ts                     # TypeScript 类型定义
├── hooks/
│   ├── useActivities.ts         # 数据过滤与格式化工具
│   ├── useLocale.tsx            # 国际化 Context
│   └── useTheme.ts              # 深色/浅色模式
├── components/
│   ├── Header.tsx               # 顶部导航与运动类型筛选
│   ├── StatsCards.tsx           # 目标卡片与连续记录
│   ├── ProfileCard.tsx          # 个人数据摘要
│   ├── PersonalBest.tsx         # 个人最佳成绩
│   ├── ContributionHeatmap.tsx  # 年度活动热力图
│   ├── HeatmapPage.tsx          # 全年份热力图总览页
│   ├── ActivityLog.tsx          # 活动记录表格
│   ├── CalendarWidget.tsx       # 月度日历组件
│   ├── MonthlyChart.tsx         # 月度统计柱状图
│   ├── TrendCharts.tsx          # 趋势折线图
│   ├── RouteMap.tsx             # Mapbox 路线地图
│   └── TracksPage.tsx           # 轨迹墙页面
└── static/
    └── activities.json          # 活动数据（由 Python 脚本生成）
```

## 部署

项目通过 GitHub Actions 自动部署至 GitHub Pages，推送到 `master` 分支后自动触发构建，详见 `.github/workflows/gh-pages.yml`。

## 致谢

- [running_page](https://github.com/yihong0618/running_page) — 数据同步管道与原始项目灵感
- [yihong0618](https://github.com/yihong0618) — running_page 作者
- [workouts_page](https://github.com/ben-29/workouts_page) — 多运动类型支持的灵感来源

## License

MIT
