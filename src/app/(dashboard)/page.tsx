import { differenceInCalendarDays, startOfMonth } from "date-fns"
import { AlertTriangle, Building2, Gauge, Zap } from "lucide-react"
import { getDashboardSummary, getDailyUsage, getYearOverYearUsage } from "./actions"
import { SummaryCard } from "@/components/charts/summary-card"
import { DashboardCharts } from "@/components/charts/dashboard-charts"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ENERGY_TYPES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type SiteOption = {
  id: string
  name: string
}

function getSiteIdFromSearchParams(
  params: Record<string, string | string[] | undefined>
): string | undefined {
  const value = params.siteId

  const selectedValue = Array.isArray(value) ? value[0] : value

  if (!selectedValue || selectedValue === "all") {
    return undefined
  }

  return selectedValue
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedSiteId = getSiteIdFromSearchParams(resolvedSearchParams)
  const supabase = await createClient()

  const [summary, sitesResult] = await Promise.all([
    getDashboardSummary(),
    supabase.from("sites").select("id, name").order("name"),
  ])

  const sites = (sitesResult.data ?? []) as SiteOption[]
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId)
    ? requestedSiteId
    : undefined

  const today = new Date()
  const monthDays = differenceInCalendarDays(today, startOfMonth(today)) + 1

  const [dailyUsage, monthUsageBySite, yoyData] = await Promise.all([
    getDailyUsage(selectedSiteId, 30),
    selectedSiteId
      ? getDailyUsage(selectedSiteId, monthDays)
      : Promise.resolve<Awaited<ReturnType<typeof getDailyUsage>> | null>(null),
    getYearOverYearUsage(selectedSiteId),
  ])

  const siteMonthUsage = { electricity: 0, gas: 0, water: 0 }

  if (monthUsageBySite) {
    monthUsageBySite.forEach((usage) => {
      siteMonthUsage.electricity += usage.electricity
      siteMonthUsage.gas += usage.gas
      siteMonthUsage.water += usage.water
    })
  }

  const monthUsage = selectedSiteId ? siteMonthUsage : summary.monthUsage

  const barChartData = [
    {
      name: ENERGY_TYPES.electricity.label,
      value: monthUsage.electricity,
      fill: ENERGY_TYPES.electricity.color,
    },
    {
      name: ENERGY_TYPES.gas.label,
      value: monthUsage.gas,
      fill: ENERGY_TYPES.gas.color,
    },
    {
      name: ENERGY_TYPES.water.label,
      value: monthUsage.water,
      fill: ENERGY_TYPES.water.color,
    },
  ]

  const hasUsageData = dailyUsage.some(
    (usage) => usage.electricity > 0 || usage.gas > 0 || usage.water > 0
  )

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">메인 대시보드</h1>
          <p className="text-muted-foreground text-sm">
            사업장별 에너지 사용량과 알림 현황을 확인하세요.
          </p>
        </div>

        <form method="get" className="flex items-center gap-2">
          <label htmlFor="siteId" className="text-sm font-medium whitespace-nowrap">
            사업장 선택
          </label>
          <Select name="siteId" defaultValue={selectedSiteId ?? "all"}>
            <SelectTrigger id="siteId" className="h-9 min-w-44">
              <SelectValue placeholder="사업장 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 사업장</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm font-medium"
          >
            적용
          </button>
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="사업장 수"
          value={summary.totalSites}
          icon={<Building2 className="size-5" />}
        />
        <SummaryCard
          title="계측기 수"
          value={summary.totalMeters}
          icon={<Gauge className="size-5" />}
        />
        <SummaryCard
          title="이번달 전력 사용량"
          value={monthUsage.electricity}
          unit={ENERGY_TYPES.electricity.unit}
          icon={<Zap className="size-5" />}
        />
        <SummaryCard
          title="미처리 알림"
          value={summary.recentAlerts}
          unit="건"
          icon={<AlertTriangle className="size-5" />}
        />
      </section>

      {sites.length === 0 || !hasUsageData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg font-medium">사업장을 등록하고 데이터를 입력하세요</p>
          </CardContent>
        </Card>
      ) : (
        <DashboardCharts
          dailyUsage={dailyUsage}
          barChartData={barChartData}
          yoyData={yoyData}
        />
      )}
    </main>
  )
}
