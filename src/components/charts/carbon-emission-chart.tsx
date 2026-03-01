"use client"

import type { JSX } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ENERGY_TYPES } from "@/lib/constants"

interface CarbonEmissionChartProps {
  data: Array<{ month: string; electricity: number; gas: number; water: number; total: number }>
}

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 3,
})

export function CarbonEmissionChart(props: CarbonEmissionChartProps): JSX.Element {
  const { data } = props

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-72 items-center justify-center text-sm">
        표시할 배출량 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => numberFormatter.format(value)}
          />
          <Tooltip
            formatter={(value, name) => {
              const numericValue = Number(value)
              const safeValue = Number.isNaN(numericValue) ? 0 : numericValue

              return [`${numberFormatter.format(safeValue)} tCO2eq`, String(name)]
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="electricity"
            name={ENERGY_TYPES.electricity.label}
            stackId="emission"
            stroke={ENERGY_TYPES.electricity.color}
            fill={ENERGY_TYPES.electricity.color}
            fillOpacity={0.7}
          />
          <Area
            type="monotone"
            dataKey="gas"
            name={ENERGY_TYPES.gas.label}
            stackId="emission"
            stroke={ENERGY_TYPES.gas.color}
            fill={ENERGY_TYPES.gas.color}
            fillOpacity={0.7}
          />
          <Area
            type="monotone"
            dataKey="water"
            name={ENERGY_TYPES.water.label}
            stackId="emission"
            stroke={ENERGY_TYPES.water.color}
            fill={ENERGY_TYPES.water.color}
            fillOpacity={0.7}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
