"use client"

import type { JSX } from "react"
import { Droplets, Flame, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ENERGY_TYPES } from "@/lib/constants"
import type { EnergyType } from "@/types/database"

interface YoYComparisonProps {
  data: {
    currentMonth: { electricity: number; gas: number; water: number }
    previousYearMonth: { electricity: number; gas: number; water: number }
    changePercent: { electricity: number; gas: number; water: number }
  }
}

const numberFormatter = new Intl.NumberFormat("ko-KR")
const percentFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 1,
})

const energyTypes: EnergyType[] = ["electricity", "gas", "water"]

const energyIcons: Record<EnergyType, (className: string) => JSX.Element> = {
  electricity: (className) => <Zap className={className} />,
  gas: (className) => <Flame className={className} />,
  water: (className) => <Droplets className={className} />,
}

function formatUsage(value: number, unit: string): string {
  return `${numberFormatter.format(value)} ${unit}`
}

function formatChangePercent(value: number): string {
  return `${percentFormatter.format(Math.abs(value))}%`
}

export function YoYComparison(props: YoYComparisonProps): JSX.Element {
  const { data } = props

  return (
    <Card>
      <CardHeader>
        <CardTitle>전년 동기 대비 사용량</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {energyTypes.map((energyType) => {
          const settings = ENERGY_TYPES[energyType]
          const currentValue = data.currentMonth[energyType]
          const previousValue = data.previousYearMonth[energyType]
          const changeValue = data.changePercent[energyType]
          const icon = energyIcons[energyType]("size-5")

          return (
            <Card key={energyType} className="gap-4 py-5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: settings.color }}>{icon}</span>
                  <p className="text-sm font-medium">{settings.label}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">이번달 사용량</p>
                  <p className="text-lg font-semibold">
                    {formatUsage(currentValue, settings.unit)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">전년 동기 사용량</p>
                  <p className="text-sm font-medium">
                    {formatUsage(previousValue, settings.unit)}
                  </p>
                </div>
                <p
                  className={
                    changeValue > 0
                      ? "text-sm font-semibold text-red-600"
                      : changeValue < 0
                        ? "text-sm font-semibold text-emerald-600"
                        : "text-muted-foreground text-sm font-semibold"
                  }
                >
                  증감률{" "}
                  {changeValue > 0
                    ? `▲ ${formatChangePercent(changeValue)}`
                    : changeValue < 0
                      ? `▼ ${formatChangePercent(changeValue)}`
                      : formatChangePercent(changeValue)}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </CardContent>
    </Card>
  )
}
