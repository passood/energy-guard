"use client"

import type { JSX } from "react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"

interface ComparisonRadarChartProps {
  data: Array<{ siteName: string; electricity: number; gas: number; water: number }>
}

type EnergyKey = "electricity" | "gas" | "water"

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
})

const radarColors = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#7c3aed",
  "#ea580c",
  "#4f46e5",
]

const metricLabels: Record<EnergyKey, string> = {
  electricity: "전기",
  gas: "가스",
  water: "수도",
}

const metricUnits: Record<EnergyKey, string> = {
  electricity: "kWh/m²",
  gas: "m³/m²",
  water: "ton/m²",
}

export function ComparisonRadarChart({
  data,
}: ComparisonRadarChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-72 items-center justify-center text-sm">
        표시할 비교 데이터가 없습니다.
      </div>
    )
  }

  const normalizedSites = data.map((site, index) => ({
    ...site,
    key: `site_${index + 1}`,
  }))

  const chartData = (["electricity", "gas", "water"] as EnergyKey[]).map(
    (metric) => {
      const row: Record<string, number | string> = {
        metric: metricLabels[metric],
        metricKey: metric,
      }

      normalizedSites.forEach((site) => {
        row[site.key] = site[metric]
      })

      return row
    }
  )

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} margin={{ top: 16, right: 20, left: 20, bottom: 8 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis
            tickFormatter={(value: number) => numberFormatter.format(value)}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name, item) => {
              const numericValue = Number(value)
              const safeValue = Number.isNaN(numericValue) ? 0 : numericValue
              const metric = (item.payload as { metricKey: EnergyKey }).metricKey

              return [
                `${numberFormatter.format(safeValue)} ${metricUnits[metric]}`,
                String(name),
              ]
            }}
          />
          <Legend />
          {normalizedSites.map((site, index) => (
            <Radar
              key={site.key}
              dataKey={site.key}
              name={site.siteName}
              stroke={radarColors[index % radarColors.length]}
              fill={radarColors[index % radarColors.length]}
              fillOpacity={0.2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
