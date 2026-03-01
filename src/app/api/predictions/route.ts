import Anthropic from "@anthropic-ai/sdk"
import { addDays, format, parseISO, startOfDay } from "date-fns"
import { getMeterReadingsForPrediction } from "@/app/(dashboard)/predictions/actions"

interface PredictionResult {
  predictions: Array<{
    date: string
    predicted: number
    confidence: { low: number; high: number }
  }>
  insight: string
}

interface DailyReading {
  date: string
  value: number
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)

    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function aggregateDailyReadings(
  readings: Array<{ timestamp: string; value: number }>
): DailyReading[] {
  const dailyMap = new Map<string, number>()

  readings.forEach((reading) => {
    const dateKey = format(new Date(reading.timestamp), "yyyy-MM-dd")
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + reading.value)
  })

  return Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }))
}

function calculateMean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length

  return Math.sqrt(variance)
}

function buildFallbackPrediction(
  readings: Array<{ timestamp: string; value: number }>
): PredictionResult {
  const dailyReadings = aggregateDailyReadings(readings)
  const recentWindow = dailyReadings.slice(-7)
  const windowValues = recentWindow.map((item) => item.value)
  const recentAverage = calculateMean(windowValues)
  const trend =
    recentWindow.length > 1
      ? (recentWindow[recentWindow.length - 1].value - recentWindow[0].value) /
        (recentWindow.length - 1)
      : 0
  const stdDev = calculateStdDev(windowValues, recentAverage)
  const baseDate =
    dailyReadings.length > 0
      ? addDays(parseISO(dailyReadings[dailyReadings.length - 1].date), 1)
      : startOfDay(new Date())

  const predictions = Array.from({ length: 7 }, (_, index) => {
    const dayIndex = index + 1
    const predicted = Math.max(0, recentAverage + trend * dayIndex)
    const spread = Math.max(stdDev, Math.abs(trend) * dayIndex, recentAverage * 0.1)

    return {
      date: format(addDays(baseDate, index), "yyyy-MM-dd"),
      predicted,
      confidence: {
        low: Math.max(0, predicted - spread),
        high: predicted + spread,
      },
    }
  })

  return {
    predictions,
    insight:
      "API 키가 없어 간단한 추세 기반 예측을 사용했습니다. 최근 7일 평균과 변화율을 반영한 값입니다.",
  }
}

function extractJsonCandidate(rawText: string): string {
  const normalized = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    return normalized
  }

  const start = normalized.indexOf("{")
  const end = normalized.lastIndexOf("}")

  if (start < 0 || end <= start) {
    return ""
  }

  return normalized.slice(start, end + 1)
}

function parsePredictionResult(
  rawText: string,
  baseDate: Date
): PredictionResult | null {
  const jsonCandidate = extractJsonCandidate(rawText)

  if (!jsonCandidate) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(jsonCandidate)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object") {
    return null
  }

  const parsedRecord = parsed as {
    predictions?: unknown
    insight?: unknown
  }

  if (!Array.isArray(parsedRecord.predictions)) {
    return null
  }

  const normalizedPredictions = parsedRecord.predictions
    .slice(0, 7)
    .map((prediction, index) => {
      if (!prediction || typeof prediction !== "object") {
        return null
      }

      const record = prediction as {
        date?: unknown
        predicted?: unknown
        confidence?: { low?: unknown; high?: unknown }
      }

      const dateValue =
        typeof record.date === "string" && !Number.isNaN(Date.parse(record.date))
          ? format(new Date(record.date), "yyyy-MM-dd")
          : format(addDays(baseDate, index), "yyyy-MM-dd")

      const predictedValue = Math.max(0, toNumber(record.predicted))
      let low = Math.max(0, toNumber(record.confidence?.low))
      let high = Math.max(0, toNumber(record.confidence?.high))

      if (low > high) {
        ;[low, high] = [high, low]
      }

      if (predictedValue < low) {
        low = predictedValue
      }

      if (predictedValue > high) {
        high = predictedValue
      }

      return {
        date: dateValue,
        predicted: predictedValue,
        confidence: { low, high },
      }
    })
    .filter((value): value is PredictionResult["predictions"][number] => value !== null)

  if (normalizedPredictions.length === 0) {
    return null
  }

  const lastKnownPrediction =
    normalizedPredictions[normalizedPredictions.length - 1] ?? {
      date: format(baseDate, "yyyy-MM-dd"),
      predicted: 0,
      confidence: { low: 0, high: 0 },
    }

  while (normalizedPredictions.length < 7) {
    const index = normalizedPredictions.length
    const nextDate = format(addDays(baseDate, index), "yyyy-MM-dd")
    normalizedPredictions.push({
      date: nextDate,
      predicted: lastKnownPrediction.predicted,
      confidence: {
        low: lastKnownPrediction.confidence.low,
        high: lastKnownPrediction.confidence.high,
      },
    })
  }

  const insight =
    typeof parsedRecord.insight === "string" && parsedRecord.insight.trim().length > 0
      ? parsedRecord.insight.trim()
      : "AI가 제공한 인사이트가 없습니다."

  return {
    predictions: normalizedPredictions,
    insight,
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: { meterId?: unknown; days?: unknown }

  try {
    body = (await request.json()) as { meterId?: unknown; days?: unknown }
  } catch {
    return jsonResponse({ error: "요청 본문(JSON) 파싱에 실패했습니다." }, 400)
  }

  const meterId = typeof body.meterId === "string" ? body.meterId.trim() : ""
  const days =
    typeof body.days === "number" && Number.isFinite(body.days)
      ? Math.max(7, Math.floor(body.days))
      : 90

  if (!meterId) {
    return jsonResponse({ error: "meterId가 필요합니다." }, 400)
  }

  try {
    const readingsResult = await getMeterReadingsForPrediction(meterId, days)

    if (readingsResult.error) {
      return jsonResponse({ error: readingsResult.error }, 500)
    }

    const readings = readingsResult.data

    if (readings.length === 0) {
      return jsonResponse({
        predictions: Array.from({ length: 7 }, (_, index) => ({
          date: format(addDays(startOfDay(new Date()), index + 1), "yyyy-MM-dd"),
          predicted: 0,
          confidence: { low: 0, high: 0 },
        })),
        insight: "예측을 위한 데이터가 부족합니다. 계측기 데이터를 먼저 입력해 주세요.",
      } satisfies PredictionResult)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return jsonResponse(buildFallbackPrediction(readings))
    }

    const dailyReadings = aggregateDailyReadings(readings)
    const baseDate =
      dailyReadings.length > 0
        ? addDays(parseISO(dailyReadings[dailyReadings.length - 1].date), 1)
        : addDays(startOfDay(new Date()), 1)

    const anthropic = new Anthropic({ apiKey })
    const prompt = [
      "다음은 에너지 사용량 시계열 데이터입니다. 향후 7일의 예상 사용량을 예측해주세요. JSON으로 응답: { predictions: [{ date, predicted, confidence: { low, high } }], insight: string }",
      "",
      "반드시 JSON만 반환하고 코드블록은 사용하지 마세요.",
      "날짜 형식은 yyyy-MM-dd를 사용하세요.",
      "predicted/low/high는 숫자로 작성하고, low <= predicted <= high를 만족해야 합니다.",
      "",
      `데이터: ${JSON.stringify(dailyReadings)}`,
    ].join("\n")

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    })

    const responseText = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")

    const predictionResult = parsePredictionResult(responseText, baseDate)

    if (!predictionResult) {
      return jsonResponse({ error: "AI 예측 응답 파싱에 실패했습니다." }, 500)
    }

    return jsonResponse(predictionResult)
  } catch {
    return jsonResponse(
      { error: "AI 예측 처리 중 오류가 발생했습니다." },
      500
    )
  }
}
