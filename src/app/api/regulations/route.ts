import { getRegulationData } from "@/app/(dashboard)/regulations/actions"
import {
  formatReportAsCsv,
  generateEgTipsExport,
  generateEnergyUseReport,
} from "@/lib/regulation-report"

type RegulationReportType = "energy_use" | "egtips"

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function parseRegulationReportType(value: string): RegulationReportType | null {
  if (value === "energy_use" || value === "egtips") {
    return value
  }

  return null
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)

  const siteId = searchParams.get("siteId")?.trim() ?? ""
  const yearParam = searchParams.get("year")?.trim() ?? ""
  const typeParam = searchParams.get("type")?.trim() ?? ""

  if (!siteId || !yearParam || !typeParam) {
    return jsonError("siteId, year, type 파라미터가 필요합니다.", 400)
  }

  const year = Number(yearParam)
  const reportType = parseRegulationReportType(typeParam)

  if (!Number.isInteger(year) || !reportType) {
    return jsonError("year/type 파라미터 형식이 올바르지 않습니다.", 400)
  }

  const result = await getRegulationData(siteId, year)

  if (result.error && !result.data) {
    if (result.error === "로그인이 필요합니다.") {
      return jsonError(result.error, 401)
    }

    if (result.error === "사업장을 찾을 수 없습니다.") {
      return jsonError(result.error, 404)
    }

    if (
      result.error === "사업장 정보가 올바르지 않습니다." ||
      result.error === "연도 정보가 올바르지 않습니다."
    ) {
      return jsonError(result.error, 400)
    }

    return jsonError(result.error, 500)
  }

  if (!result.data) {
    return jsonError("법규 보고서 데이터를 찾을 수 없습니다.", 404)
  }

  const reportInput = result.data as Parameters<typeof generateEnergyUseReport>[0]
  const rows =
    reportType === "energy_use"
      ? generateEnergyUseReport(reportInput, year)
      : generateEgTipsExport(reportInput, year)

  if (rows.length === 0) {
    return jsonError("해당 조건의 보고서 데이터가 없습니다.", 404)
  }

  const csv = formatReportAsCsv(rows)

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="energyguard-${reportType}-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
