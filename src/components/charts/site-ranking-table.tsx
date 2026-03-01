"use client"

import type { JSX } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface SiteRankingTableProps {
  data: Array<{
    siteId: string
    siteName: string
    areaSqm: number
    electricity: { total: number; perSqm: number }
    gas: { total: number; perSqm: number }
    water: { total: number; perSqm: number }
  }>
}

type RankedSite = SiteRankingTableProps["data"][number] & { score: number }

const valueFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
})

const scoreFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function getAverage(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getEfficiencyScoreClass(score: number): string {
  if (score <= 0.9) {
    return "font-semibold text-emerald-600"
  }

  if (score >= 1.1) {
    return "font-semibold text-red-600"
  }

  return "font-semibold text-amber-600"
}

export function SiteRankingTable({ data }: SiteRankingTableProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        표시할 사업장 데이터가 없습니다.
      </div>
    )
  }

  const averageElectricity = getAverage(
    data.map((site) => site.electricity.perSqm)
  )
  const averageGas = getAverage(data.map((site) => site.gas.perSqm))
  const averageWater = getAverage(data.map((site) => site.water.perSqm))

  const rankedSites = data
    .map<RankedSite>((site) => {
      const electricityRatio =
        averageElectricity > 0 ? site.electricity.perSqm / averageElectricity : 0
      const gasRatio = averageGas > 0 ? site.gas.perSqm / averageGas : 0
      const waterRatio = averageWater > 0 ? site.water.perSqm / averageWater : 0
      const score = Number(((electricityRatio + gasRatio + waterRatio) / 3).toFixed(2))

      return { ...site, score }
    })
    .sort((a, b) => a.score - b.score)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>순위</TableHead>
          <TableHead>사업장명</TableHead>
          <TableHead>면적 (m²)</TableHead>
          <TableHead>전기 (kWh/m²)</TableHead>
          <TableHead>가스 (m³/m²)</TableHead>
          <TableHead>수도 (ton/m²)</TableHead>
          <TableHead>종합 효율 점수</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rankedSites.map((site, index) => (
          <TableRow key={site.siteId}>
            <TableCell>{index + 1}</TableCell>
            <TableCell className="font-medium">{site.siteName}</TableCell>
            <TableCell>{valueFormatter.format(site.areaSqm)}</TableCell>
            <TableCell>{valueFormatter.format(site.electricity.perSqm)}</TableCell>
            <TableCell>{valueFormatter.format(site.gas.perSqm)}</TableCell>
            <TableCell>{valueFormatter.format(site.water.perSqm)}</TableCell>
            <TableCell className={getEfficiencyScoreClass(site.score)}>
              {scoreFormatter.format(site.score)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
