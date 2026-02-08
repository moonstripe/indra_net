import { useMemo, useRef, useState, useEffect } from 'react'

interface HeatmapProps {
  /** Array of ISO date strings or unix timestamps representing activity events */
  dates: (string | number)[]
  /** Number of weeks to display (default: 13 = ~3 months) */
  weeks?: number
  /** Label shown above the heatmap */
  label?: string
  /** Compact mode for embedding in cards (no border/padding) */
  compact?: boolean
  /** Show legend */
  showLegend?: boolean
  /** Show day labels (M, W, F) */
  showDayLabels?: boolean
}

/**
 * GitHub-style contribution heatmap calendar.
 * Shows daily activity intensity over time.
 * Cells expand to fill container width for the given number of weeks.
 */
export default function ActivityHeatmap({ 
  dates, 
  weeks = 13, 
  label = 'Activity',
  compact = false,
  showLegend = true,
  showDayLabels = true,
}: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Measure container width
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(container)
    setContainerWidth(container.clientWidth)

    return () => observer.disconnect()
  }, [])

  const dayLabelWidth = showDayLabels ? 16 : 0

  // Calculate cell size to fill container
  const { cellSize, cellGap } = useMemo(() => {
    if (containerWidth === 0) {
      return { cellSize: compact ? 8 : 10, cellGap: compact ? 1 : 2 }
    }
    const availableWidth = containerWidth - dayLabelWidth
    // Total width = weeks * cellSize + (weeks - 1) * gap
    // We want gap to be ~15-20% of cellSize
    // So: availableWidth = weeks * cellSize + (weeks - 1) * 0.15 * cellSize
    //     availableWidth = cellSize * (weeks + (weeks - 1) * 0.15)
    const gapRatio = 0.15
    const cellSize = Math.floor(availableWidth / (weeks + (weeks - 1) * gapRatio))
    const cellGap = Math.max(1, Math.floor(cellSize * gapRatio))
    return { cellSize: Math.max(cellSize, 4), cellGap }
  }, [containerWidth, weeks, dayLabelWidth, compact])

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

        // Track month labels - only on first day of week (Sunday)
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
  const gridHeight = 7 * cellSize + 6 * cellGap

  const gridContent = containerWidth > 0 && (
    <>
      {/* Month labels row */}
      <div 
        className="flex mb-4" 
        style={{ 
          height: compact ? 12 : 14,
          marginLeft: dayLabelWidth,
        }}
      >
        {grid.map((_, wi) => {
          const monthLabel = monthLabels.find(m => m.col === wi)
          return (
            <div 
              key={wi} 
              style={{ 
                width: cellSize, 
                marginRight: wi < weeks - 1 ? cellGap : 0,
                flexShrink: 0,
              }}
            >
              {monthLabel && (
                <span className={`text-gray-500 whitespace-nowrap ${compact ? 'text-[10px]' : 'text-xs'}`}>
                  {monthLabel.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid with optional day labels */}
      <div className="flex">
        {/* Day labels */}
        {showDayLabels && (
          <div 
            className="flex flex-col justify-around pr-1 flex-shrink-0" 
            style={{ 
              width: dayLabelWidth,
              height: gridHeight,
            }}
          >
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}></span>
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}>M</span>
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}></span>
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}>W</span>
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}></span>
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}>F</span>
            <span className={`text-gray-600 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}></span>
          </div>
        )}

        {/* Week columns */}
        <div className="flex flex-1">
          {grid.map((week, wi) => (
            <div 
              key={wi} 
              className="flex flex-col"
              style={{ marginRight: wi < weeks - 1 ? cellGap : 0 }}
            >
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`rounded-sm ${getColor(day.count, day.future)} transition-colors`}
                  style={{ 
                    width: cellSize, 
                    height: cellSize,
                    marginBottom: di < 6 ? cellGap : 0,
                  }}
                  title={day.future ? '' : `${day.date}: ${day.count} event${day.count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className={`text-gray-500 mr-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>Less</span>
          <div className={`rounded-sm bg-gray-800/50 ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
          <div className={`rounded-sm bg-purple-900/60 ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
          <div className={`rounded-sm bg-purple-700/70 ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
          <div className={`rounded-sm bg-purple-500/80 ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
          <div className={`rounded-sm bg-purple-400 ${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
          <span className={`text-gray-500 ml-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>More</span>
        </div>
      )}
    </>
  )

  if (compact) {
    return (
      <div ref={containerRef} className="w-full">
        {gridContent}
      </div>
    )
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-400">{label}</h4>
        <span className="text-xs text-gray-500">
          {totalActivity} event{totalActivity !== 1 ? 's' : ''} total
        </span>
      </div>
      <div ref={containerRef} className="w-full">
        {gridContent}
      </div>
    </div>
  )
}
