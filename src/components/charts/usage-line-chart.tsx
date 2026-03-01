"use client"

import type { JSX } from "react"
import { format, parseISO } from "date-fns"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ENERGY_TYPES } from "@/lib/constants"

interface UsageLineChartProps {
  data: Array<{ date: string; electricity: number; gas: number; water: number }>
  height?: number
}

const numberFormatter = new Intl.NumberFormat("ko-KR")

const unitByName: Record<string, string> = {
  전기: ENERGY_TYPES.electricity.unit,
  가스: ENERGY_TYPES.gas.unit,
  수도: ENERGY_TYPES.water.unit,
}

export function UsageLineChart({
  data,
  height = 320,
}: UsageLineChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-72 items-center justify-center text-sm">
        표시할 사용량 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => format(parseISO(value), "MM/dd")}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value: number) => numberFormatter.format(value)}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(label) => format(parseISO(String(label)), "MM/dd")}
            formatter={(value, name) => {
              const unit = unitByName[String(name)]
              const numericValue = Number(value)
              const safeValue = Number.isNaN(numericValue) ? 0 : numericValue

              return [`${numberFormatter.format(safeValue)} ${unit}`, String(name)]
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="electricity"
            name={ENERGY_TYPES.electricity.label}
            stroke={ENERGY_TYPES.electricity.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="gas"
            name={ENERGY_TYPES.gas.label}
            stroke={ENERGY_TYPES.gas.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="water"
            name={ENERGY_TYPES.water.label}
            stroke={ENERGY_TYPES.water.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
