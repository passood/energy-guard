"use client"

import { UsageLineChart } from "@/components/charts/usage-line-chart"
import { UsageBarChart } from "@/components/charts/usage-bar-chart"
import { YoYComparison } from "@/components/charts/yoy-comparison"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardChartsProps {
  dailyUsage: Array<{ date: string; electricity: number; gas: number; water: number }>
  barChartData: Array<{ name: string; value: number; fill: string }>
  yoyData?: {
    currentMonth: { electricity: number; gas: number; water: number }
    previousYearMonth: { electricity: number; gas: number; water: number }
    changePercent: { electricity: number; gas: number; water: number }
  }
}

export function DashboardCharts({
  dailyUsage,
  barChartData,
  yoyData,
}: DashboardChartsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>최근 30일 사용량 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageLineChart data={dailyUsage} height={360} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>에너지원별 이번달 사용량</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageBarChart data={barChartData} />
        </CardContent>
      </Card>

      {yoyData ? <YoYComparison data={yoyData} /> : null}
    </>
  )
}
