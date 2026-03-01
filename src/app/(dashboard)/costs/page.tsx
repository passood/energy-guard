import Link from "next/link"
import { deleteCost, getCosts } from "./actions"
import { getSites } from "../sites/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { ENERGY_TYPES, RATE_TYPES } from "@/lib/constants"

interface CostsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const numberFormatter = new Intl.NumberFormat("ko-KR")
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function getSiteIdFromSearchParams(
  params: Record<string, string | string[] | undefined>
): string | undefined {
  const value = params.siteId
  const selectedValue = Array.isArray(value) ? value[0] : value

  if (!selectedValue || selectedValue === "all") return undefined

  return selectedValue
}

function formatDate(value: string): string {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3])

    return dateFormatter.format(new Date(year, month - 1, day))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return dateFormatter.format(parsed)
}

function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} ~ ${formatDate(end)}`
}

function formatCurrency(value: number): string {
  return `₩${numberFormatter.format(Math.round(value))}`
}

export default async function CostsPage({ searchParams }: CostsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedSiteId = getSiteIdFromSearchParams(resolvedSearchParams)
  const sites = await getSites()
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId)
    ? requestedSiteId
    : undefined
  const selectedSiteName = selectedSiteId
    ? sites.find((site) => site.id === selectedSiteId)?.name ?? ""
    : "전체 사업장"
  const { data: costs, error } = await getCosts(selectedSiteId)

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">에너지 비용 관리</h1>
          <p className="text-muted-foreground text-sm">
            사업장별 에너지 비용 정보를 등록하고 관리합니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/costs/new">비용 등록</Link>
        </Button>
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>사업장 정보가 필요합니다</CardTitle>
            <CardDescription>
              비용을 등록하려면 먼저 사업장을 생성해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/sites/new">사업장 등록하러 가기</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">사업장 필터</CardTitle>
              <CardDescription>조회할 사업장을 선택해 주세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-wrap items-center gap-2" method="get">
                <Select defaultValue={selectedSiteId ?? "all"} name="siteId">
                  <SelectTrigger className="h-9 min-w-[220px]" id="siteId">
                    <SelectValue placeholder="사업장을 선택하세요." />
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
                <Button size="sm" type="submit">
                  적용
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>비용 목록</CardTitle>
              <CardDescription>
                {selectedSiteName} 기준 총 {costs.length}건이 조회되었습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-destructive py-10 text-center text-sm">{error}</p>
              ) : costs.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  조회된 비용 데이터가 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>사업장명</TableHead>
                      <TableHead>기간</TableHead>
                      <TableHead>에너지유형</TableHead>
                      <TableHead className="text-right">사용량</TableHead>
                      <TableHead className="text-right">비용(원)</TableHead>
                      <TableHead>요금유형</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell className="font-medium">{cost.sites.name}</TableCell>
                        <TableCell>{formatPeriod(cost.period_start, cost.period_end)}</TableCell>
                        <TableCell>{ENERGY_TYPES[cost.energy_type].label}</TableCell>
                        <TableCell className="text-right">
                          {numberFormatter.format(cost.amount_kwh)}{" "}
                          {ENERGY_TYPES[cost.energy_type].unit}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(cost.cost_krw)}</TableCell>
                        <TableCell>
                          {cost.rate_type ? RATE_TYPES[cost.rate_type] : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/costs/${cost.id}`}>상세/수정</Link>
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  삭제
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>비용 내역을 삭제할까요?</DialogTitle>
                                  <DialogDescription>
                                    삭제한 비용 데이터는 복구할 수 없습니다.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                      취소
                                    </Button>
                                  </DialogClose>
                                  <form
                                    action={async () => {
                                      "use server"
                                      await deleteCost(cost.id)
                                    }}
                                  >
                                    <Button type="submit" variant="destructive">
                                      삭제
                                    </Button>
                                  </form>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
