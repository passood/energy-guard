import type { JSX } from "react"
import { getSiteComparison } from "./actions"
import { ComparisonRadarChart } from "@/components/charts/comparison-radar-chart"
import { SiteRankingTable } from "@/components/charts/site-ranking-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ComparisonPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type Period = "month" | "quarter" | "year"

function getPeriodFromSearchParams(
  params: Record<string, string | string[] | undefined>
): Period {
  const value = params.period
  const selectedPeriod = Array.isArray(value) ? value[0] : value

  if (selectedPeriod === "quarter" || selectedPeriod === "year") {
    return selectedPeriod
  }

  return "month"
}

function getPeriodLabel(period: Period): string {
  if (period === "quarter") {
    return "이번 분기"
  }

  if (period === "year") {
    return "올해"
  }

  return "이번 달"
}

export default async function ComparisonPage({
  searchParams,
}: ComparisonPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = (await searchParams) ?? {}
  const period = getPeriodFromSearchParams(resolvedSearchParams)
  const comparisonData = await getSiteComparison(period)
  const radarData = comparisonData.map((site) => ({
    siteName: site.siteName,
    electricity: site.electricity.perSqm,
    gas: site.gas.perSqm,
    water: site.water.perSqm,
  }))

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            사업장별 에너지 효율 비교
          </h1>
          <p className="text-muted-foreground text-sm">
            {getPeriodLabel(period)} 기준 면적당 에너지 사용량을 비교합니다.
          </p>
        </div>

        <form method="get" className="flex items-center gap-2">
          <label htmlFor="period" className="text-sm font-medium whitespace-nowrap">
            기간 선택
          </label>
          <Select name="period" defaultValue={period}>
            <SelectTrigger id="period" className="h-9 min-w-36">
              <SelectValue placeholder="기간 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">이번 달</SelectItem>
              <SelectItem value="quarter">이번 분기</SelectItem>
              <SelectItem value="year">올해</SelectItem>
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

      {comparisonData.length < 2 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg font-medium">
              비교 분석을 위해 2개 이상의 사업장을 등록하세요
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>사업장별 원단위 레이더 차트</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonRadarChart data={radarData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>사업장 효율 랭킹</CardTitle>
            </CardHeader>
            <CardContent>
              <SiteRankingTable data={comparisonData} />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
