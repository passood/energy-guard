import { format } from "date-fns"
import { getReportData } from "@/app/(dashboard)/reports/actions"
import { generateReportPdf } from "@/lib/pdf-generator"

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function sanitizeFileNameSegment(text: string): string {
  const sanitized = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return sanitized.length > 0 ? sanitized : "site"
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)

  const siteId = searchParams.get("siteId")?.trim() ?? ""
  const yearParam = searchParams.get("year")?.trim() ?? ""
  const monthParam = searchParams.get("month")?.trim() ?? ""

  if (!siteId || !yearParam || !monthParam) {
    return jsonError("siteId, year, month 파라미터가 필요합니다.", 400)
  }

  const year = Number(yearParam)
  const month = Number(monthParam)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return jsonError("year/month 파라미터 형식이 올바르지 않습니다.", 400)
  }

  const result = await getReportData(siteId, year, month)

  if (result.error && !result.data) {
    if (result.error === "로그인이 필요합니다.") {
      return jsonError(result.error, 401)
    }

    if (result.error === "사업장을 찾을 수 없습니다.") {
      return jsonError(result.error, 404)
    }

    if (
      result.error === "사업장 정보가 올바르지 않습니다." ||
      result.error === "조회 기간이 올바르지 않습니다."
    ) {
      return jsonError(result.error, 400)
    }

    return jsonError(result.error, 500)
  }

  if (!result.data) {
    return jsonError("리포트 데이터를 찾을 수 없습니다.", 404)
  }

  const periodLabel = format(new Date(year, month - 1, 1), "yyyy-MM")
  const pdfBuffer = generateReportPdf({
    siteName: result.data.site.name,
    siteAddress: result.data.site.address,
    periodLabel,
    usage: result.data.usage,
    costs: result.data.costs,
    dailyBreakdown: result.data.dailyBreakdown,
  })

  const filename = `${sanitizeFileNameSegment(result.data.site.name)}-${periodLabel}-report.pdf`

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

