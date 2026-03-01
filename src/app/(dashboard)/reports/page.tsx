import { getSites } from "../sites/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ReportsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSingleSearchParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const sites = await getSites()

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

  const requestedSiteId = getSingleSearchParam(resolvedSearchParams.siteId)
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId)
    ? requestedSiteId
    : sites[0]?.id
  const selectedSite = sites.find((site) => site.id === selectedSiteId)

  const downloadHref = selectedSiteId
    ? `/api/reports?siteId=${encodeURIComponent(selectedSiteId)}&year=${selectedYear}&month=${selectedMonth}`
    : null

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">월간 리포트</h1>
        <p className="text-muted-foreground text-sm">
          사업장과 조회 기간을 선택한 뒤 PDF 리포트를 다운로드하세요.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>리포트 조건 설정</CardTitle>
          <CardDescription>사업장/연/월을 선택하고 기간을 적용하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px_140px_auto] lg:items-end"
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
                  {sites.length === 0 ? (
                    <SelectItem value="no-sites" disabled>
                      등록된 사업장이 없습니다.
                    </SelectItem>
                  ) : (
                    sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))
                  )}
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
              기간 적용
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF 다운로드</CardTitle>
          <CardDescription>
            {selectedSite
              ? `${selectedSite.name} / ${selectedYear}년 ${selectedMonth}월`
              : "사업장을 먼저 등록해 주세요."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            다운로드 링크는 새 탭에서 열립니다.
          </p>
          {downloadHref ? (
            <Button asChild>
              <a href={downloadHref} target="_blank" rel="noopener noreferrer">
                PDF 다운로드
              </a>
            </Button>
          ) : (
            <Button disabled>PDF 다운로드</Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

