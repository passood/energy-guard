import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ENERGY_TYPES } from "@/lib/constants"
import type { EnergyType } from "@/types/database"
import { getMeters, getUserSites } from "./actions"

type MetersPageProps = {
  searchParams?: Promise<{ siteId?: string }>
}

const ENERGY_BADGE_CLASS: Record<EnergyType, string> = {
  electricity: "border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-100",
  gas: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  water: "border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100",
}

export default async function MetersPage({ searchParams }: MetersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedSiteId = resolvedSearchParams.siteId?.trim() || undefined

  const [meters, sites] = await Promise.all([
    getMeters(selectedSiteId),
    getUserSites(),
  ])

  const siteNameMap = new Map(sites.map((site) => [site.id, site.name]))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">계측기 관리</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            사업장별 계측기를 조회하고 상태를 관리하세요.
          </p>
        </div>
        <Button asChild>
          <Link href="/meters/new">계측기 등록</Link>
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">사업장 필터</CardTitle>
          <CardDescription>
            조회할 사업장을 선택하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            variant={selectedSiteId ? "outline" : "default"}
          >
            <Link href="/meters">전체</Link>
          </Button>
          {sites.map((site) => (
            <Button
              key={site.id}
              asChild
              size="sm"
              variant={selectedSiteId === site.id ? "default" : "outline"}
            >
              <Link href={`/meters?siteId=${encodeURIComponent(site.id)}`}>
                {site.name}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>계측기 목록</CardTitle>
          <CardDescription>
            총 {meters.length}개의 계측기가 조회되었습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meters.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed px-4 py-10 text-center text-sm">
              등록된 계측기가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>계측기명</TableHead>
                  <TableHead>소속 사업장</TableHead>
                  <TableHead>에너지 유형</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((meter) => (
                  <TableRow key={meter.id}>
                    <TableCell className="font-medium">
                      <Link
                        className="hover:text-primary underline-offset-4 hover:underline"
                        href={`/meters/${meter.id}`}
                      >
                        {meter.name}
                      </Link>
                    </TableCell>
                    <TableCell>{siteNameMap.get(meter.site_id) ?? "미확인 사업장"}</TableCell>
                    <TableCell>
                      <Badge className={ENERGY_BADGE_CLASS[meter.energy_type]}>
                        {ENERGY_TYPES[meter.energy_type].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{meter.unit}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          meter.is_active
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
                        }
                        variant="secondary"
                      >
                        {meter.is_active ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
