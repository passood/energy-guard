"use client"

import { useEffect, useMemo, useState, type JSX } from "react"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { getMeterReadingsForPrediction } from "@/app/(dashboard)/predictions/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PredictionChartProps {
  actual: Array<{ date: string; value: number }>
  predicted: Array<{ date: string; predicted: number; low: number; high: number }>
}

interface PredictionPanelProps {
  sites: Array<{ id: string; name: string }>
  meters: Array<{ id: string; site_id: string; name: string }>
  initialSiteId?: string
}

interface PredictionApiResponse {
  predictions?: Array<{
    date: string
    predicted: number
    confidence: { low: number; high: number }
  }>
  insight?: string
  error?: string
}

interface CombinedChartDatum {
  date: string
  value?: number
  predicted?: number
  confidenceBottom?: number
  confidenceRange?: number
  low?: number
  high?: number
}

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
})

function aggregateDailyReadings(
  readings: Array<{ timestamp: string; value: number }>
): Array<{ date: string; value: number }> {
  const dailyMap = new Map<string, number>()

  readings.forEach((reading) => {
    const dateKey = format(new Date(reading.timestamp), "yyyy-MM-dd")
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + reading.value)
  })

  return Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }))
}

export function PredictionChart({
  actual,
  predicted,
}: PredictionChartProps): JSX.Element {
  const chartData = useMemo<CombinedChartDatum[]>(() => {
    const dataMap = new Map<string, CombinedChartDatum>()

    actual.forEach((item) => {
      const current = dataMap.get(item.date) ?? { date: item.date }
      current.value = item.value
      dataMap.set(item.date, current)
    })

    predicted.forEach((item) => {
      const current = dataMap.get(item.date) ?? { date: item.date }
      const confidenceRange = Math.max(0, item.high - item.low)

      current.predicted = item.predicted
      current.low = item.low
      current.high = item.high
      current.confidenceBottom = item.low
      current.confidenceRange = confidenceRange

      dataMap.set(item.date, current)
    })

    return Array.from(dataMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  }, [actual, predicted])

  if (chartData.length === 0) {
    return (
      <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
        표시할 예측 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => format(parseISO(value), "MM/dd")}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value: number) => numberFormatter.format(value)}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(label) => format(parseISO(String(label)), "yyyy.MM.dd")}
            formatter={(value, name, item) => {
              if (name === "confidenceBottom" || name === "confidenceRange") {
                return null
              }

              if (name === "predicted") {
                return [`${numberFormatter.format(Number(value))}`, "예측 사용량"]
              }

              if (name === "value") {
                return [`${numberFormatter.format(Number(value))}`, "실제 사용량"]
              }

              if (item.payload.low !== undefined && item.payload.high !== undefined) {
                return [
                  `${numberFormatter.format(item.payload.low)} ~ ${numberFormatter.format(
                    item.payload.high
                  )}`,
                  "신뢰구간",
                ]
              }

              return [`${numberFormatter.format(Number(value))}`, String(name)]
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="confidenceBottom"
            stackId="confidence"
            stroke="none"
            fill="transparent"
            legendType="none"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="confidenceRange"
            name="신뢰구간"
            stackId="confidence"
            stroke="none"
            fill="#f97316"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="실제 사용량"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="예측 사용량"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PredictionPanel({
  sites,
  meters,
  initialSiteId,
}: PredictionPanelProps): JSX.Element {
  const fallbackSiteId =
    initialSiteId && sites.some((site) => site.id === initialSiteId)
      ? initialSiteId
      : sites[0]?.id ?? ""

  const [selectedSiteId, setSelectedSiteId] = useState(fallbackSiteId)
  const [selectedMeterId, setSelectedMeterId] = useState("")
  const [actualData, setActualData] = useState<Array<{ date: string; value: number }>>([])
  const [predictedData, setPredictedData] = useState<
    Array<{ date: string; predicted: number; low: number; high: number }>
  >([])
  const [insight, setInsight] = useState("")
  const [isLoadingActual, setIsLoadingActual] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)

  const siteMeters = useMemo(
    () => meters.filter((meter) => meter.site_id === selectedSiteId),
    [meters, selectedSiteId]
  )

  useEffect(() => {
    if (!selectedSiteId) {
      setSelectedMeterId("")
      setActualData([])
      setPredictedData([])
      setInsight("")
      return
    }

    const firstMeterId = siteMeters[0]?.id ?? ""
    const isCurrentMeterValid = siteMeters.some((meter) => meter.id === selectedMeterId)

    if (!isCurrentMeterValid) {
      setSelectedMeterId(firstMeterId)
      setPredictedData([])
      setInsight("")
    }
  }, [selectedMeterId, selectedSiteId, siteMeters])

  useEffect(() => {
    if (!selectedMeterId) {
      setActualData([])
      return
    }

    let cancelled = false
    setIsLoadingActual(true)

    void (async () => {
      const result = await getMeterReadingsForPrediction(selectedMeterId, 90)

      if (cancelled) {
        return
      }

      if (result.error) {
        toast.error(result.error)
        setActualData([])
        setIsLoadingActual(false)
        return
      }

      setActualData(aggregateDailyReadings(result.data))
      setIsLoadingActual(false)
    })()

    return () => {
      cancelled = true
    }
  }, [selectedMeterId])

  async function handleRunPrediction(): Promise<void> {
    if (!selectedMeterId) {
      toast.error("계측기를 선택해 주세요.")
      return
    }

    setIsPredicting(true)

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterId: selectedMeterId, days: 90 }),
      })

      const result = (await response.json()) as PredictionApiResponse

      if (!response.ok) {
        toast.error(result.error ?? "예측 실행에 실패했습니다.")
        setIsPredicting(false)
        return
      }

      const normalizedPredictions = (result.predictions ?? []).map((item) => {
        let low = Number(item.confidence.low)
        let high = Number(item.confidence.high)

        if (low > high) {
          ;[low, high] = [high, low]
        }

        return {
          date: item.date,
          predicted: Number(item.predicted),
          low,
          high,
        }
      })

      setPredictedData(normalizedPredictions)
      setInsight(result.insight ?? "")

      if (normalizedPredictions.length === 0) {
        toast.warning("예측 결과가 비어 있습니다.")
      }
    } catch {
      toast.error("예측 요청 중 오류가 발생했습니다.")
    } finally {
      setIsPredicting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>예측 조건</CardTitle>
          <CardDescription>사업장과 계측기를 선택한 뒤 예측을 실행하세요.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="prediction-site">사업장</Label>
            <Select
              value={selectedSiteId || "__no_site__"}
              onValueChange={(value) =>
                setSelectedSiteId(value === "__no_site__" ? "" : value)
              }
            >
              <SelectTrigger id="prediction-site" className="w-full">
                <SelectValue placeholder="사업장 선택" />
              </SelectTrigger>
              <SelectContent>
                {sites.length === 0 ? (
                  <SelectItem value="__no_site__" disabled>
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
            <Label htmlFor="prediction-meter">계측기</Label>
            <Select
              value={selectedMeterId || "__no_meter__"}
              onValueChange={(value) =>
                setSelectedMeterId(value === "__no_meter__" ? "" : value)
              }
              disabled={siteMeters.length === 0}
            >
              <SelectTrigger id="prediction-meter" className="w-full">
                <SelectValue placeholder="계측기 선택" />
              </SelectTrigger>
              <SelectContent>
                {siteMeters.length === 0 ? (
                  <SelectItem value="__no_meter__" disabled>
                    선택 가능한 계측기가 없습니다.
                  </SelectItem>
                ) : (
                  siteMeters.map((meter) => (
                    <SelectItem key={meter.id} value={meter.id}>
                      {meter.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={handleRunPrediction}
            disabled={!selectedMeterId || isPredicting}
            className="w-full"
          >
            {isPredicting ? "예측 실행 중..." : "예측 실행"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사용량 예측 그래프</CardTitle>
          <CardDescription>
            실제 사용량(파란색)과 향후 예측값(주황색), 신뢰구간을 함께 표시합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActual ? (
            <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
              실제 사용량 데이터를 불러오는 중입니다...
            </div>
          ) : (
            <PredictionChart actual={actualData} predicted={predictedData} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 인사이트</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 whitespace-pre-wrap">
            {insight || "예측 실행 후 AI 인사이트가 표시됩니다."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
