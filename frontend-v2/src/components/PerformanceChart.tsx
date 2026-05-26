import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatDateShort, secondsToTimeString } from '../utils/time'

interface DataPoint {
  date: string
  timeSeconds: number
  competition: string
  formattedTime: string
}

interface Series {
  label: string
  color: string
  data: DataPoint[]
}

interface Props {
  series: Series[]
  onPointClick?: (point: DataPoint, seriesLabel: string) => void
}

const SERIES_COLORS = [
  '#0066cc', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2',
]

export { SERIES_COLORS }
export type { DataPoint, Series }

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: DataPoint }>
  label?: string
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {payload.map(entry => (
        <div key={entry.name} className="chart-tooltip-row">
          <span className="chart-tooltip-label">{entry.name}</span>
          <span className="chart-tooltip-time">{entry.payload.formattedTime}</span>
          <span className="chart-tooltip-comp">{entry.payload.competition}</span>
        </div>
      ))}
    </div>
  )
}

function yAxisFormatter(value: number) {
  return secondsToTimeString(value)
}

function xAxisFormatter(value: string) {
  return formatDateShort(value)
}

// Merge all series data into a unified date-keyed array for recharts
function buildChartData(series: Series[]): Record<string, unknown>[] {
  const dateSet = new Set<string>()
  for (const s of series) {
    for (const d of s.data) dateSet.add(d.date)
  }
  const dates = Array.from(dateSet).sort()

  return dates.map(date => {
    const row: Record<string, unknown> = { date }
    for (const s of series) {
      const point = s.data.find(d => d.date === date)
      if (point) {
        row[s.label] = point.timeSeconds
        row[`${s.label}__meta`] = point
      }
    }
    return row
  })
}

export default function PerformanceChart({ series, onPointClick }: Props) {
  if (series.length === 0 || series.every(s => s.data.length === 0)) {
    return (
      <div className="chart-empty">
        <span>📊</span>
        <p>Nessun dato disponibile</p>
      </div>
    )
  }

  const chartData = buildChartData(series)

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={xAxisFormatter}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            reversed
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          {series.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              name={s.label}
              stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 0, cursor: 'pointer' }}
              activeDot={{
                r: 6,
                onClick: (_e: unknown, payload: unknown) => {
                  const p = payload as { payload: Record<string, unknown> }
                  const meta = p.payload[`${s.label}__meta`] as DataPoint | undefined
                  if (meta && onPointClick) onPointClick(meta, s.label)
                },
              }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
