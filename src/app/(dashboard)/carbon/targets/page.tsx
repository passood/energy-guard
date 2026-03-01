import Link from "next/link"
import { getSites } from "../../sites/actions"
import {
  createReductionTarget,
  deleteReductionTarget,
  getReductionTargets,
  getSiteCarbonSummary,
} from "../actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { calculateReductionProgress, formatEmission } from "@/lib/carbon"

interface CarbonTargetsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 3,
})

const percentFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 1,
})

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function formatPercent(value: number): string {
  return `${percentFormatter.format(Math.round(value * 10) / 10)}%`
}

export default async function CarbonTargetsPage({ searchParams }: CarbonTargetsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const sites = await getSites()
  const requestedSiteId = getSingleSearchParam(resolvedSearchParams.siteId)
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId)
    ? requestedSiteId
    : sites[0]?.id
  const selectedSiteName =
    sites.find((site) => site.id === selectedSiteId)?.name ?? "사업장 미선택"

  const currentYear = new Date().getFullYear()

  const [targetsResult, currentSummaryResult] = selectedSiteId
    ? await Promise.all([
        getReductionTargets(selectedSiteId),
        getSiteCarbonSummary(currentYear),
      ])
    : [{ data: [] }, { data: [] }]

  const currentEmission = selectedSiteId
    ? (currentSummaryResult.data.find((summary) => summary.siteId === selectedSiteId)
        ?.totalEmission ?? 0)
    : 0

  const targets = targetsResult.data

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">감축 목표 관리</h1>
          <p className="text-muted-foreground text-sm">
            사업장별 연간 탄소 감축 목표를 등록하고 달성 진행률을 확인합니다.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/carbon">탄소 배출량 현황으로 이동</Link>
        </Button>
      </header>

      {sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>사업장 정보가 필요합니다</CardTitle>
            <CardDescription>
              감축 목표를 등록하려면 먼저 사업장을 생성해 주세요.
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
              <CardTitle>사업장 선택</CardTitle>
              <CardDescription>목표를 조회/등록할 사업장을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                method="get"
                className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor="siteId">사업장</Label>
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
                <Button type="submit" variant="outline">
                  적용
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>현재 배출량 기준</CardTitle>
              <CardDescription>
                {selectedSiteName} / {currentYear}년 배출량: {formatEmission(currentEmission)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">등록 목표 {targets.length}건</Badge>
              {currentSummaryResult.error ? (
                <Badge variant="destructive">현재 배출량을 불러오지 못했습니다.</Badge>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>새 감축 목표 등록</CardTitle>
              <CardDescription>
                목표 연도/기준 연도와 배출량을 입력해 감축 목표를 등록하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={async (formData) => {
                  "use server"
                  await createReductionTarget(formData)
                }}
                className="grid gap-4 lg:grid-cols-5"
              >
                <input type="hidden" name="siteId" value={selectedSiteId ?? ""} />

                <div className="space-y-2">
                  <Label htmlFor="targetYear">목표 연도</Label>
                  <Input
                    id="targetYear"
                    name="targetYear"
                    type="number"
                    min={currentYear - 10}
                    max={currentYear + 20}
                    defaultValue={String(currentYear + 1)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseYear">기준 연도</Label>
                  <Input
                    id="baseYear"
                    name="baseYear"
                    type="number"
                    min={currentYear - 20}
                    max={currentYear + 5}
                    defaultValue={String(currentYear)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseEmission">기준 배출량 (tCO2eq)</Label>
                  <Input
                    id="baseEmission"
                    name="baseEmission"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="예: 120.5"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetEmission">목표 배출량 (tCO2eq)</Label>
                  <Input
                    id="targetEmission"
                    name="targetEmission"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="예: 100.0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetReductionPct">목표 감축률 (%)</Label>
                  <Input
                    id="targetReductionPct"
                    name="targetReductionPct"
                    type="number"
                    step="0.1"
                    placeholder="예: 17.0"
                    required
                  />
                </div>

                <div className="lg:col-span-5">
                  <Button type="submit" disabled={!selectedSiteId}>
                    감축 목표 등록
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>감축 목표 목록</CardTitle>
              <CardDescription>{selectedSiteName}의 등록된 목표 내역</CardDescription>
            </CardHeader>
            <CardContent>
              {targetsResult.error ? (
                <p className="text-destructive py-8 text-center text-sm">{targetsResult.error}</p>
              ) : targets.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  등록된 감축 목표가 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>목표 연도</TableHead>
                      <TableHead>기준 연도</TableHead>
                      <TableHead className="text-right">기준 배출량</TableHead>
                      <TableHead className="text-right">목표 배출량</TableHead>
                      <TableHead className="text-right">목표 감축률</TableHead>
                      <TableHead>진행률</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => {
                      const progress = calculateReductionProgress(
                        currentEmission,
                        target.base_emission,
                        target.target_emission
                      )

                      return (
                        <TableRow key={target.id}>
                          <TableCell className="font-medium">{target.target_year}년</TableCell>
                          <TableCell>{target.base_year}년</TableCell>
                          <TableCell className="text-right">
                            {numberFormatter.format(target.base_emission)}
                          </TableCell>
                          <TableCell className="text-right">
                            {numberFormatter.format(target.target_emission)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(target.target_reduction_pct)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>
                              현재 {formatPercent(progress.currentReductionPct)} / 목표{" "}
                              {formatPercent(progress.targetReductionPct)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {progress.remainingToTarget > 0
                                ? `목표까지 ${numberFormatter.format(progress.remainingToTarget)} tCO2eq 추가 감축 필요`
                                : `목표 대비 ${numberFormatter.format(Math.abs(progress.remainingToTarget))} tCO2eq 초과 달성`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={progress.onTrack ? "default" : "destructive"}
                            >
                              {progress.onTrack ? "목표 달성권" : "추가 감축 필요"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <form
                              action={async () => {
                                "use server"
                                await deleteReductionTarget(target.id)
                              }}
                              className="inline"
                            >
                              <Button size="sm" variant="destructive" type="submit">
                                삭제
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
