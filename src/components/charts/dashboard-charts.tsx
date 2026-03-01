"use client"

import { UsageLineChart } from "@/components/charts/usage-line-chart"
import { UsageBarChart } from "@/components/charts/usage-bar-chart"
import { YoYComparison } from "@/components/charts/yoy-comparison"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WIDGET_TYPES } from "@/lib/constants"
import type { WidgetType } from "@/types/database"

interface DashboardChartsProps {
  dailyUsage: Array<{ date: string; electricity: number; gas: number; water: number }>
  barChartData: Array<{ name: string; value: number; fill: string }>
  yoyData?: {
    currentMonth: { electricity: number; gas: number; water: number }
    previousYearMonth: { electricity: number; gas: number; water: number }
    changePercent: { electricity: number; gas: number; water: number }
  }
  widgetOrder?: WidgetType[]
  hiddenWidgets?: WidgetType[]
}

const DEFAULT_WIDGET_ORDER = Object.keys(WIDGET_TYPES) as WidgetType[]
const WIDGET_TYPE_SET = new Set<WidgetType>(DEFAULT_WIDGET_ORDER)

function normalizeWidgetOrder(widgetOrder: WidgetType[]): WidgetType[] {
  const uniqueWidgetOrder: WidgetType[] = []
  const includedWidgets = new Set<WidgetType>()

  widgetOrder.forEach((widget) => {
    if (!WIDGET_TYPE_SET.has(widget) || includedWidgets.has(widget)) {
      return
    }

    includedWidgets.add(widget)
    uniqueWidgetOrder.push(widget)
  })

  DEFAULT_WIDGET_ORDER.forEach((widget) => {
    if (includedWidgets.has(widget)) {
      return
    }

    uniqueWidgetOrder.push(widget)
  })

  return uniqueWidgetOrder
}

function normalizeHiddenWidgets(hiddenWidgets: WidgetType[]): WidgetType[] {
  const uniqueHiddenWidgets: WidgetType[] = []
  const hiddenWidgetSet = new Set<WidgetType>()

  hiddenWidgets.forEach((widget) => {
    if (!WIDGET_TYPE_SET.has(widget) || hiddenWidgetSet.has(widget)) {
      return
    }

    hiddenWidgetSet.add(widget)
    uniqueHiddenWidgets.push(widget)
  })

  return uniqueHiddenWidgets
}

export function DashboardCharts({
  dailyUsage,
  barChartData,
  yoyData,
  widgetOrder,
  hiddenWidgets,
}: DashboardChartsProps) {
  const orderedWidgets = normalizeWidgetOrder(widgetOrder ?? DEFAULT_WIDGET_ORDER)
  const hiddenWidgetSet = new Set(normalizeHiddenWidgets(hiddenWidgets ?? []))

  return (
    <>
      {orderedWidgets.map((widget) => {
        if (hiddenWidgetSet.has(widget) || widget === "summary") {
          return null
        }

        if (widget === "usage_line") {
          return (
            <Card key={widget}>
              <CardHeader>
                <CardTitle>최근 30일 사용량 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <UsageLineChart data={dailyUsage} height={360} />
              </CardContent>
            </Card>
          )
        }

        if (widget === "usage_bar") {
          return (
            <Card key={widget}>
              <CardHeader>
                <CardTitle>에너지원별 이번달 사용량</CardTitle>
              </CardHeader>
              <CardContent>
                <UsageBarChart data={barChartData} />
              </CardContent>
            </Card>
          )
        }

        if (widget === "yoy_comparison") {
          if (!yoyData) {
            return null
          }

          return <YoYComparison key={widget} data={yoyData} />
        }

        if (widget === "cost_summary") {
          return (
            <Card key={widget}>
              <CardHeader>
                <CardTitle>비용 요약</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
                비용 관리 데이터가 없습니다
              </CardContent>
            </Card>
          )
        }

        if (widget === "site_comparison") {
          return (
            <Card key={widget}>
              <CardHeader>
                <CardTitle>사업장 비교</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
                사업장 비교 데이터가 없습니다
              </CardContent>
            </Card>
          )
        }

        return null
      })}
    </>
  )
}
