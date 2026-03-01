import Link from "next/link"
import { getSites } from "../sites/actions"
import {
  calculateAndSaveEmissions,
  getEmissionFactors,
  getSiteCarbonSummary,
} from "./actions"
import { CarbonEmissionChart } from "@/components/charts/carbon-emission-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { calculateSiteEmissions, formatEmission } from "@/lib/carbon"
import { DEFAULT_EMISSION_FACTORS, ENERGY_TYPES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"
import type { CarbonEmission, EmissionFactor, EnergyType } from "@/types/database"

interface CarbonPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type MonthlyEmissionRow = Pick<
  CarbonEmission,
  "period_start" | "energy_type" | "emission_value"
>

type MeterRow = {
  id: string
  energy_type: EnergyType
  unit: string
}

type ReadingRow = {
  meter_id: string
  timestamp: string
  value: number | string | null
  unit: string
}

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 3,
})

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getFallbackFactors(year: number): EmissionFactor[] {
  const createdAt = new Date(0).toISOString()

  return [
    {
      id: `fallback-electricity-${year}`,
      energy_type: "electricity",
      factor_value: DEFAULT_EMISSION_FACTORS.electricity.value,
      factor_unit: DEFAULT_EMISSION_FACTORS.electricity.unit,
      year,
      source: "기본 배출계수",
      created_at: createdAt,
    },
    {
      id: `fallback-gas-${year}`,
      energy_type: "gas",
      factor_value: DEFAULT_EMISSION_FACTORS.gas.value,
      factor_unit: DEFAULT_EMISSION_FACTORS.gas.unit,
      year,
      source: "기본 배출계수",
      created_at: createdAt,
    },
    {
      id: `fallback-water-${year}`,
      energy_type: "water",
      factor_value: DEFAULT_EMISSION_FACTORS.water.value,
      factor_unit: DEFAULT_EMISSION_FACTORS.water.unit,
      year,
      source: "기본 배출계수",
      created_at: createdAt,
    },
  ]
}

function getEmptyMonthlyChartData(): Array<{
  month: string
  electricity: number
  gas: number
  water: number
  total: number
}> {
  return Array.from({ length: 12 }, (_, index) => ({
    month: `${index + 1}월`,
    electricity: 0,
    gas: 0,
    water: 0,
    total: 0,
  }))
}

function formatEmissionValue(value: number): string {
  return `${numberFormatter.format(Math.round(value * 1000) / 1000)} tCO2eq`
}

async function getMonthlyEmissionChartData(
  siteId: string | undefined,
  year: number,
  factors: EmissionFactor[]
): Promise<Array<{ month: string; electricity: number; gas: number; water: number; total: number }>> {
  const monthly = getEmptyMonthlyChartData()

  if (!siteId) {
    return monthly
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return monthly
  }

  const periodStart = `${year}-01-01`
  const periodEnd = `${year + 1}-01-01`

  const { data: emissionData } = await supabase
    .from("carbon_emissions")
    .select("period_start, energy_type, emission_value")
    .eq("site_id", siteId)
    .gte("period_start", periodStart)
    .lt("period_start", periodEnd)

  const savedRows = (emissionData ?? []) as MonthlyEmissionRow[]

  if (savedRows.length > 0) {
    savedRows.forEach((row) => {
      const month = Number(row.period_start.slice(5, 7))
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return
      }

      const index = month - 1
      monthly[index][row.energy_type] += toNumber(row.emission_value)
    })

    monthly.forEach((row) => {
      row.total = row.electricity + row.gas + row.water
    })

    return monthly
  }

  const { data: meterData } = await supabase
    .from("meters")
    .select("id, energy_type, unit")
    .eq("site_id", siteId)

  const meters = (meterData ?? []) as MeterRow[]
  if (meters.length === 0) {
    return monthly
  }

  const meterById = new Map<string, MeterRow>()
  meters.forEach((meter) => {
    meterById.set(meter.id, meter)
  })

  const meterIds = meters.map((meter) => meter.id)
  const { data: readingData } = await supabase
    .from("energy_readings")
    .select("meter_id, timestamp, value, unit")
    .in("meter_id", meterIds)
    .gte("timestamp", `${periodStart}T00:00:00.000Z`)
    .lt("timestamp", `${periodEnd}T00:00:00.000Z`)

  const readingsByMonth = new Map<
    number,
    Array<{ energy_type: EnergyType; value: number; unit: string }>
  >()

  ;((readingData ?? []) as ReadingRow[]).forEach((reading) => {
    const meter = meterById.get(reading.meter_id)
    if (!meter) {
      return
    }

    const month = new Date(reading.timestamp).getUTCMonth() + 1
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return
    }

    const monthReadings = readingsByMonth.get(month) ?? []
    monthReadings.push({
      energy_type: meter.energy_type,
      value: toNumber(reading.value),
      unit: reading.unit ?? meter.unit,
    })
    readingsByMonth.set(month, monthReadings)
  })

  for (let month = 1; month <= 12; month += 1) {
    const calculated = calculateSiteEmissions(
      readingsByMonth.get(month) ?? [],
      factors,
      year
    )

    monthly[month - 1] = {
      month: `${month}월`,
      electricity: calculated.electricity,
      gas: calculated.gas,
      water: calculated.water,
      total: calculated.total,
    }
  }

  return monthly
}

export default async function CarbonPage({ searchParams }: CarbonPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index)
  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

  const requestedYear = Number(getSingleSearchParam(resolvedSearchParams.year))
  const selectedYear = yearOptions.includes(requestedYear) ? requestedYear : currentYear

  const requestedMonth = Number(getSingleSearchParam(resolvedSearchParams.month))
  const selectedMonth =
    Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth
      : currentMonth

  const sites = await getSites()
  const requestedSiteId = getSingleSearchParam(resolvedSearchParams.siteId)
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId)
    ? requestedSiteId
    : sites[0]?.id
  const selectedSiteName =
    sites.find((site) => site.id === selectedSiteId)?.name ?? "사업장 미선택"

  const summaryResult = await getSiteCarbonSummary(selectedYear)
  const factorsResult = await getEmissionFactors()
  const factors = factorsResult.data.length > 0 ? factorsResult.data : getFallbackFactors(selectedYear)
  const chartData = await getMonthlyEmissionChartData(selectedSiteId, selectedYear, factors)

  const summaries = summaryResult.data
  const totalEmission = summaries.reduce((sum, site) => sum + site.totalEmission, 0)
  const selectedSiteSummary = summaries.find((site) => site.siteId === selectedSiteId)

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">탄소 배출량 관리</h1>
          <p className="text-muted-foreground text-sm">
            사업장별 탄소 배출량을 계산하고 월별 추이를 확인합니다.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/carbon/targets">감축 목표 관리</Link>
        </Button>
      </header>

      {sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>사업장 정보가 필요합니다</CardTitle>
            <CardDescription>
              탄소 배출량을 계산하려면 먼저 사업장을 등록해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/sites/new">사업장 등록하기</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>조회 조건</CardTitle>
              <CardDescription>사업장/연도/월을 선택하고 배출량 계산을 실행하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                method="get"
                className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px_120px_auto] lg:items-end"
              >
                <div className="space-y-2">
                  <label htmlFor="siteId" className="text-sm font-medium">
                    사업장
                  </label>
                  <Select name="siteId" defaultValue={selectedSiteId ?? "no-sites"}>
                    <SelectTrigger id="siteId" className="w-full">
                      <SelectValue placeholder="사업장을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="year" className="text-sm font-medium">
                    연도
                  </label>
                  <Select name="year" defaultValue={String(selectedYear)}>
                    <SelectTrigger id="year" className="w-full">
                      <SelectValue placeholder="연도 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}년
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="month" className="text-sm font-medium">
                    월
                  </label>
                  <Select name="month" defaultValue={String(selectedMonth)}>
                    <SelectTrigger id="month" className="w-full">
                      <SelectValue placeholder="월 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={String(month)}>
                          {month}월
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" variant="outline" className="w-full lg:w-auto">
                  조건 적용
                </Button>
              </form>

              <form
                action={async () => {
                  "use server"

                  if (!selectedSiteId) {
                    return
                  }

                  await calculateAndSaveEmissions(selectedSiteId, selectedYear, selectedMonth)
                }}
                className="flex items-center justify-between gap-3"
              >
                <div className="text-muted-foreground text-sm">
                  <span className="font-medium text-foreground">{selectedSiteName}</span> / {selectedYear}
                  년 {selectedMonth}월 기준으로 계산합니다.
                </div>
                <Button type="submit" disabled={!selectedSiteId}>
                  배출량 계산
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>총 배출량 요약</CardTitle>
              <CardDescription>{selectedYear}년 전체 사업장 기준</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">총 {summaries.length}개 사업장</Badge>
              <span className="text-2xl font-semibold">{formatEmission(totalEmission)}</span>
              {selectedSiteSummary ? (
                <Badge variant="outline">
                  선택 사업장: {formatEmission(selectedSiteSummary.totalEmission)}
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          {summaryResult.error ? (
            <Card>
              <CardContent className="text-destructive py-10 text-center text-sm">
                {summaryResult.error}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaries.map((summary) => (
                  <Card key={summary.siteId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{summary.siteName}</CardTitle>
                      <CardDescription>{formatEmission(summary.totalEmission)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">전기</span>
                        <Badge variant="outline">
                          {formatEmissionValue(summary.byType.electricity)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">가스</span>
                        <Badge variant="outline">{formatEmissionValue(summary.byType.gas)}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">수도</span>
                        <Badge variant="outline">{formatEmissionValue(summary.byType.water)}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>사업장별 배출량 표</CardTitle>
                  <CardDescription>에너지원별 연간 배출량 합계를 확인하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>사업장</TableHead>
                        <TableHead className="text-right">전기</TableHead>
                        <TableHead className="text-right">가스</TableHead>
                        <TableHead className="text-right">수도</TableHead>
                        <TableHead className="text-right">총 배출량</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                            조회된 배출량 데이터가 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        summaries.map((summary) => (
                          <TableRow key={summary.siteId}>
                            <TableCell className="font-medium">{summary.siteName}</TableCell>
                            <TableCell className="text-right">
                              {numberFormatter.format(summary.byType.electricity)}
                            </TableCell>
                            <TableCell className="text-right">
                              {numberFormatter.format(summary.byType.gas)}
                            </TableCell>
                            <TableCell className="text-right">
                              {numberFormatter.format(summary.byType.water)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {numberFormatter.format(summary.totalEmission)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>월별 배출량 추이</CardTitle>
              <CardDescription>
                {selectedSiteName} / {selectedYear}년 ({ENERGY_TYPES.electricity.label}, {ENERGY_TYPES.gas.label},{" "}
                {ENERGY_TYPES.water.label})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CarbonEmissionChart data={chartData} />
              {factorsResult.error ? (
                <p className="text-muted-foreground mt-3 text-xs">
                  배출계수 조회 오류로 기본 배출계수를 사용했습니다.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
