import { useMemo } from 'react'

interface HeatmapProps {
  /** Array of ISO date strings or unix timestamps representing activity events */
  dates: (string | number)[]
  /** Number of weeks to display (default: 26 = ~6 months) */
  weeks?: number
  /** Label shown above the heatmap */
  label?: string
}

/**
 * GitHub-style contribution heatmap calendar.
 * Shows daily activity intensity over time.
 */
export default function ActivityHeatmap({ dates, weeks = 26, label = 'Activity' }: HeatmapProps) {
  const { grid, monthLabels, maxCount } = useMemo(() => {
    // Count events per day
    const dayCounts = new Map<string, number>()
    for (const d of dates) {
      const date = typeof d === 'number' ? new Date(d) : new Date(d)
      const key = date.toISOString().slice(0, 10) // YYYY-MM-DD
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1)
    }

    // Build grid: weeks × 7 days, ending at today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find the start: go back `weeks` weeks from end of this week
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay())) // Saturday
    const startDate = new Date(endOfWeek)
    startDate.setDate(startDate.getDate() - (weeks * 7 - 1))
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay())

    const grid: { date: string; count: number; future: boolean }[][] = []
    const monthLabels: { label: string; col: number }[] = []
    let lastMonth = -1

    const cursor = new Date(startDate)
    for (let w = 0; w < weeks; w++) {
      const week: { date: string; count: number; future: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().slice(0, 10)
        const isFuture = cursor > today
        week.push({
          date: key,
          count: isFuture ? 0 : (dayCounts.get(key) || 0),
          future: isFuture,
        })

        // Track month labels
        if (cursor.getMonth() !== lastMonth && d === 0) {
          lastMonth = cursor.getMonth()
          monthLabels.push({
            label: cursor.toLocaleDateString('en-US', { month: 'short' }),
            col: w,
          })
        }

        cursor.setDate(cursor.getDate() + 1)
      }
      grid.push(week)
    }

    let maxCount = 0
    for (const [, count] of dayCounts) {
      if (count > maxCount) maxCount = count
    }

    return { grid, monthLabels, maxCount }
  }, [dates, weeks])

  const getColor = (count: number, future: boolean): string => {
    if (future) return 'bg-gray-900/20'
    if (count === 0) return 'bg-gray-800/50'
    if (maxCount === 0) return 'bg-gray-800/50'
    const intensity = count / maxCount
    if (intensity <= 0.25) return 'bg-purple-900/60'
    if (intensity <= 0.5) return 'bg-purple-700/70'
    if (intensity <= 0.75) return 'bg-purple-500/80'
    return 'bg-purple-400'
  }

  const totalActivity = dates.length
  const cellSize = 11
  const cellGap = 2

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-400">{label}</h4>
        <span className="text-xs text-gray-500">
          {totalActivity} event{totalActivity !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* Month labels */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: grid.length * (cellSize + cellGap) + 20 }}>
          <div className="flex ml-5 mb-1">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-xs text-gray-500"
                style={{
                  position: 'relative',
                  left: m.col * (cellSize + cellGap),
                  ...(i > 0 ? { marginLeft: -((monthLabels[i - 1]?.col || 0) * (cellSize + cellGap)) - 30 } : {}),
                }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col justify-between pr-1" style={{ height: 7 * (cellSize + cellGap) - cellGap }}>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}></span>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}>M</span>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}></span>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}>W</span>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}></span>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}>F</span>
              <span className="text-xs text-gray-600 leading-none" style={{ height: cellSize, lineHeight: `${cellSize}px` }}></span>
            </div>

            {/* Week columns */}
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: cellGap }}>
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`rounded-sm ${getColor(day.count, day.future)} transition-colors`}
                    style={{ width: cellSize, height: cellSize }}
                    title={day.future ? '' : `${day.date}: ${day.count} event${day.count !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2">
            <span className="text-xs text-gray-500 mr-1">Less</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-gray-800/50" />
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-900/60" />
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-700/70" />
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-500/80" />
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
            <span className="text-xs text-gray-500 ml-1">More</span>
          </div>
        </div>
      </div>
    </div>
  )
}
