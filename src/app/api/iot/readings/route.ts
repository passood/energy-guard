import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

interface ReadingPayload {
  timestamp: string
  value: number
}

interface IotReadingsRequestBody {
  device_id: string
  readings: ReadingPayload[]
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function getApiKeyFromAuthorizationHeader(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/)
  if (!match) {
    return null
  }

  const apiKey = match[1].trim()
  if (apiKey === "") {
    return null
  }

  return apiKey
}

function isValidRequestBody(payload: unknown): payload is IotReadingsRequestBody {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const candidate = payload as {
    device_id?: unknown
    readings?: unknown
  }

  if (typeof candidate.device_id !== "string" || candidate.device_id.trim() === "") {
    return false
  }

  if (!Array.isArray(candidate.readings) || candidate.readings.length === 0) {
    return false
  }

  return candidate.readings.every((reading) => {
    if (!reading || typeof reading !== "object") {
      return false
    }

    const readingCandidate = reading as {
      timestamp?: unknown
      value?: unknown
    }

    if (
      typeof readingCandidate.timestamp !== "string" ||
      readingCandidate.timestamp.trim() === ""
    ) {
      return false
    }

    if (
      Number.isNaN(new Date(readingCandidate.timestamp).getTime()) ||
      typeof readingCandidate.value !== "number" ||
      !Number.isFinite(readingCandidate.value)
    ) {
      return false
    }

    return true
  })
}

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "서버 환경변수가 올바르게 설정되지 않았습니다." }, 500)
  }

  const apiKey = getApiKeyFromAuthorizationHeader(request.headers.get("Authorization"))
  if (!apiKey) {
    return jsonResponse({ error: "Authorization 헤더 형식이 올바르지 않습니다." }, 401)
  }

  let bodyPayload: unknown

  try {
    bodyPayload = await request.json()
  } catch {
    return jsonResponse({ error: "요청 본문(JSON)을 파싱하지 못했습니다." }, 400)
  }

  if (!isValidRequestBody(bodyPayload)) {
    return jsonResponse({ error: "요청 본문 형식이 올바르지 않습니다." }, 400)
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: device, error: deviceError } = await supabase
    .from("iot_devices")
    .select("id, meter_id, is_active")
    .eq("id", bodyPayload.device_id)
    .eq("api_key", apiKey)
    .maybeSingle()

  if (deviceError) {
    return jsonResponse({ error: "디바이스 인증 처리 중 오류가 발생했습니다." }, 500)
  }

  if (!device || !device.is_active) {
    return jsonResponse({ error: "인증에 실패했습니다." }, 401)
  }

  if (!device.meter_id) {
    return jsonResponse({ error: "계측기가 연결되지 않았습니다" }, 400)
  }

  const { data: meter, error: meterError } = await supabase
    .from("meters")
    .select("unit")
    .eq("id", device.meter_id)
    .maybeSingle()

  if (meterError || !meter) {
    return jsonResponse({ error: "연결된 계측기 정보를 찾을 수 없습니다." }, 400)
  }

  const insertRows = bodyPayload.readings.map((reading) => ({
    meter_id: device.meter_id,
    timestamp: reading.timestamp,
    value: reading.value,
    unit: meter.unit,
    source: "api" as const,
  }))

  const { error: insertError } = await supabase
    .from("energy_readings")
    .insert(insertRows as never)

  if (insertError) {
    return jsonResponse({ error: "센서 데이터 저장에 실패했습니다." }, 500)
  }

  const { error: updateError } = await supabase
    .from("iot_devices")
    .update({ last_seen_at: new Date().toISOString() } as never)
    .eq("id", device.id)

  if (updateError) {
    return jsonResponse({ error: "디바이스 마지막 통신 시간 갱신에 실패했습니다." }, 500)
  }

  return jsonResponse({ inserted: insertRows.length }, 200)
}
