"use client"

import type { JSX } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ENERGY_TYPES } from "@/lib/constants"

interface UsageBarChartProps {
  data: Array<{ name: string; value: number; fill: string }>
}

const numberFormatter = new Intl.NumberFormat("ko-KR")

const unitByName: Record<string, string> = {
  [ENERGY_TYPES.electricity.label]: ENERGY_TYPES.electricity.unit,
  [ENERGY_TYPES.gas.label]: ENERGY_TYPES.gas.unit,
  [ENERGY_TYPES.water.label]: ENERGY_TYPES.water.unit,
}

export function UsageBarChart({ data }: UsageBarChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-72 items-center justify-center text-sm">
        표시할 사용량 데이터가 없습니다.
      </div>
    )
  }

  const normalizedSeries = data.map((item, index) => ({
    ...item,
    key: `series_${index}`,
  }))

  const chartData = normalizedSeries.reduce<Record<string, string | number>>(
    (accumulator, item) => {
      accumulator[item.key] = item.value
      return accumulator
    },
    { period: "이번달" }
  )

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[chartData]}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(value: number) => numberFormatter.format(value)}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name) => {
              const metricName = String(name)
              const unit = unitByName[metricName]
              const numericValue = Number(value)
              const safeValue = Number.isNaN(numericValue) ? 0 : numericValue

              return [`${numberFormatter.format(safeValue)} ${unit}`, metricName]
            }}
          />
          <Legend />
          {normalizedSeries.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              fill={item.fill}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
