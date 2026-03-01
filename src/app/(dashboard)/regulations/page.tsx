import { BUILDING_TYPES, REGULATION_REPORT_TYPES } from "@/lib/constants"
import { generateEgTipsExport, generateEnergyUseReport } from "@/lib/regulation-report"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getRegulationData, getSitesForRegulation } from "./actions"

interface RegulationsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type EnergyUseReportRow = ReturnType<typeof generateEnergyUseReport>[number]
type EgTipsExportRow = ReturnType<typeof generateEgTipsExport>[number]

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
})

const toeFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
})

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function getBuildingTypeLabel(value: string): string {
  if (value === "office" || value === "factory" || value === "commercial" || value === "other") {
    return BUILDING_TYPES[value]
  }

  return value
}

function createDownloadHref(siteId: string, year: number, type: "energy_use" | "egtips"): string {
  return `/api/regulations?siteId=${encodeURIComponent(siteId)}&year=${year}&type=${type}`
}

function EnergyUsePreviewTable({ rows }: { rows: EnergyUseReportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">미리보기 데이터가 없습니다.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>사업장명</TableHead>
          <TableHead>주소</TableHead>
          <TableHead className="text-right">면적(㎡)</TableHead>
          <TableHead>건물유형</TableHead>
          <TableHead>에너지원</TableHead>
          <TableHead className="text-right">연간 사용량</TableHead>
          <TableHead className="text-right">TOE 환산</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.siteName}-${row.energyType}-${index}`}>
            <TableCell className="font-medium">{row.siteName}</TableCell>
            <TableCell>{row.address}</TableCell>
            <TableCell className="text-right">
              {row.areaSqm === null ? "-" : numberFormatter.format(row.areaSqm)}
            </TableCell>
            <TableCell>{getBuildingTypeLabel(row.buildingType)}</TableCell>
            <TableCell>{row.energyType}</TableCell>
            <TableCell className="text-right">
              {numberFormatter.format(row.annualUsage)} {row.unit}
            </TableCell>
            <TableCell className="text-right">{toeFormatter.format(row.toeConversion)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EgTipsPreviewTable({ rows }: { rows: EgTipsExportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">미리보기 데이터가 없습니다.</p>
  }

  const previewRows = rows.slice(0, 24)

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>사업장명</TableHead>
            <TableHead>주소</TableHead>
            <TableHead>계측기</TableHead>
            <TableHead>에너지원</TableHead>
            <TableHead className="text-right">연도</TableHead>
            <TableHead className="text-right">월</TableHead>
            <TableHead className="text-right">사용량</TableHead>
            <TableHead>단위</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewRows.map((row, index) => (
            <TableRow key={`${row.meterName}-${row.energySource}-${row.month}-${index}`}>
              <TableCell className="font-medium">{row.facilityName}</TableCell>
              <TableCell>{row.facilityAddress}</TableCell>
              <TableCell>{row.meterName}</TableCell>
              <TableCell>{row.energySource}</TableCell>
              <TableCell className="text-right">{row.year}</TableCell>
              <TableCell className="text-right">{row.month}</TableCell>
              <TableCell className="text-right">{numberFormatter.format(row.usage)}</TableCell>
              <TableCell>{row.unit}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        총 {rows.length}건 중 {previewRows.length}건 미리보기
      </p>
    </div>
  )
}

function EnergyUseReportCard({
  rows,
  downloadHref,
}: {
  rows: EnergyUseReportRow[]
  downloadHref: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{REGULATION_REPORT_TYPES.energy_use}</CardTitle>
            <CardDescription>에너지이용합리화법 제출용 연간 사용량 신고 양식입니다.</CardDescription>
          </div>
          {downloadHref ? (
            <Button asChild size="sm">
              <a href={downloadHref}>CSV 다운로드</a>
            </Button>
          ) : (
            <Button size="sm" disabled>
              CSV 다운로드
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <EnergyUsePreviewTable rows={rows} />
      </CardContent>
    </Card>
  )
}

function EgTipsReportCard({
  rows,
  downloadHref,
}: {
  rows: EgTipsExportRow[]
  downloadHref: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{REGULATION_REPORT_TYPES.egtips}</CardTitle>
            <CardDescription>에너지관리공단 연동을 위한 월별 EG-TIPS 데이터 포맷입니다.</CardDescription>
          </div>
          {downloadHref ? (
            <Button asChild size="sm">
              <a href={downloadHref}>CSV 다운로드</a>
            </Button>
          ) : (
            <Button size="sm" disabled>
              CSV 다운로드
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <EgTipsPreviewTable rows={rows} />
      </CardContent>
    </Card>
  )
}

export default async function RegulationsPage({ searchParams }: RegulationsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const { data: sites, error: sitesError } = await getSitesForRegulation()

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index)

  const requestedYear = Number(getSingleSearchParam(resolvedSearchParams.year))
  const selectedYear = yearOptions.includes(requestedYear) ? requestedYear : currentYear

  const requestedSiteId = getSingleSearchParam(resolvedSearchParams.siteId)
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId) ? requestedSiteId : sites[0]?.id
  const selectedSite = sites.find((site) => site.id === selectedSiteId)

  const regulationResult: Awaited<ReturnType<typeof getRegulationData>> = selectedSiteId
    ? await getRegulationData(selectedSiteId, selectedYear)
    : { data: null }

  const reportInput = regulationResult.data as Parameters<typeof generateEnergyUseReport>[0] | null
  const energyUseRows = reportInput ? generateEnergyUseReport(reportInput, selectedYear) : []
  const egTipsRows = reportInput ? generateEgTipsExport(reportInput, selectedYear) : []

  const energyUseDownloadHref = selectedSiteId
    ? createDownloadHref(selectedSiteId, selectedYear, "energy_use")
    : null
  const egTipsDownloadHref = selectedSiteId
    ? createDownloadHref(selectedSiteId, selectedYear, "egtips")
    : null

  const shouldShowReports = sites.length > 0 && selectedSiteId

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">법규 보고서</h1>
        <p className="text-muted-foreground text-sm">
          사업장별 에너지 법규 제출용 데이터를 미리보고 CSV로 다운로드할 수 있습니다.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>보고서 조건 설정</CardTitle>
          <CardDescription>사업장과 연도를 선택한 뒤 조건을 적용하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_auto] lg:items-end"
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

            <Button type="submit" variant="outline" className="w-full lg:w-auto">
              조건 적용
            </Button>
          </form>
        </CardContent>
      </Card>

      {sitesError ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">{sitesError}</CardContent>
        </Card>
      ) : null}

      {!shouldShowReports ? (
        <Card>
          <CardHeader>
            <CardTitle>사업장 정보가 필요합니다</CardTitle>
            <CardDescription>법규 보고서를 생성하려면 먼저 사업장을 등록해 주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">사업장 등록 후 이 페이지에서 CSV를 생성할 수 있습니다.</p>
          </CardContent>
        </Card>
      ) : regulationResult.error && !regulationResult.data ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            {regulationResult.error}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="all" className="w-auto px-4">
              전체
            </TabsTrigger>
            <TabsTrigger value="energy_use" className="w-auto px-4">
              에너지 사용량 신고서
            </TabsTrigger>
            <TabsTrigger value="egtips" className="w-auto px-4">
              EG-TIPS 데이터
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardContent className="text-muted-foreground py-4 text-sm">
                선택된 사업장: {selectedSite?.name ?? "-"} / {selectedYear}년
              </CardContent>
            </Card>
            <EnergyUseReportCard rows={energyUseRows} downloadHref={energyUseDownloadHref} />
            <EgTipsReportCard rows={egTipsRows} downloadHref={egTipsDownloadHref} />
          </TabsContent>

          <TabsContent value="energy_use" className="space-y-4">
            <EnergyUseReportCard rows={energyUseRows} downloadHref={energyUseDownloadHref} />
          </TabsContent>

          <TabsContent value="egtips" className="space-y-4">
            <EgTipsReportCard rows={egTipsRows} downloadHref={egTipsDownloadHref} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}
