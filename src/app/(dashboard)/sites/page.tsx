import Link from "next/link"
import { getSites } from "./actions"
import { BUILDING_TYPES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const numberFormatter = new Intl.NumberFormat("ko-KR")

export default async function SitesPage() {
  const sites = await getSites()

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">사업장 관리</h1>
          <p className="text-muted-foreground text-sm">사업장 정보를 등록하고 관리합니다.</p>
        </div>
        <Button asChild>
          <Link href="/sites/new">사업장 등록</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사업장 목록</CardTitle>
          <CardDescription>등록된 사업장 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              등록된 사업장이 없습니다. 상단의 사업장 등록 버튼으로 첫 사업장을 추가해 주세요.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>용도</TableHead>
                  <TableHead className="text-right">면적</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">{site.name}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{site.address}</TableCell>
                    <TableCell>{BUILDING_TYPES[site.building_type]}</TableCell>
                    <TableCell className="text-right">
                      {site.area_sqm === null
                        ? "-"
                        : `${numberFormatter.format(site.area_sqm)} ㎡`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/sites/${site.id}`}>상세/수정</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
