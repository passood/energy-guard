"use client"

import { useEffect, useMemo, useState, type JSX } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  acknowledgeAnomaly,
  getAnomalyHistory,
  runAnomalyDetection,
} from "@/app/(dashboard)/predictions/actions"
import { Badge } from "@/components/ui/badge"
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
import { ANOMALY_TYPES, SEVERITY_LEVELS } from "@/lib/constants"
import type { AnomalyDetection } from "@/types/database"

interface AnomalyTimelineProps {
  anomalies: AnomalyDetection[]
  onAcknowledge?: (id: string) => void
}

interface AnomalyPanelProps {
  sites: Array<{ id: string; name: string }>
  meters: Array<{ id: string; site_id: string; name: string }>
  initialSiteId?: string
  initialAnomalies: AnomalyDetection[]
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
})

function getSeverityBadgeStyle(severity: AnomalyDetection["severity"]): {
  borderColor: string
  backgroundColor: string
  color: string
} {
  const color = SEVERITY_LEVELS[severity].color

  return {
    borderColor: `${color}80`,
    backgroundColor: `${color}1f`,
    color,
  }
}

export function AnomalyTimeline({
  anomalies,
  onAcknowledge,
}: AnomalyTimelineProps): JSX.Element {
  if (anomalies.length === 0) {
    return (
      <div className="text-muted-foreground flex h-56 items-center justify-center text-sm">
        감지된 이상 이력이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {anomalies.map((anomaly, index) => (
        <div key={anomaly.id} className="relative pl-8">
          {index < anomalies.length - 1 ? (
            <span className="bg-border absolute top-8 left-3 h-[calc(100%+0.75rem)] w-px" />
          ) : null}
          <span
            className={`absolute top-2 left-0 inline-block size-6 rounded-full border-2 ${
              anomaly.is_acknowledged
                ? "border-slate-300 bg-slate-100"
                : "border-amber-500 bg-amber-100"
            }`}
          />

          <Card
            className={
              anomaly.is_acknowledged
                ? "border-slate-200"
                : "border-amber-300 bg-amber-50/40"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {ANOMALY_TYPES[anomaly.anomaly_type]}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={getSeverityBadgeStyle(anomaly.severity)}
                  >
                    {SEVERITY_LEVELS[anomaly.severity].label}
                  </Badge>
                  {anomaly.is_acknowledged ? (
                    <Badge variant="outline" className="border-slate-300 text-slate-600">
                      확인됨
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      미확인
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>{dateFormatter.format(new Date(anomaly.detected_at))}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border bg-white/70 px-3 py-2">
                  <p className="text-muted-foreground text-xs">기대값</p>
                  <p className="font-medium">
                    {numberFormatter.format(anomaly.expected_value)}
                  </p>
                </div>
                <div className="rounded-md border bg-white/70 px-3 py-2">
                  <p className="text-muted-foreground text-xs">실제값</p>
                  <p className="font-medium">
                    {numberFormatter.format(anomaly.actual_value)}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground leading-6 whitespace-pre-wrap">
                {anomaly.description}
              </p>

              {!anomaly.is_acknowledged ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAcknowledge?.(anomaly.id)}
                    disabled={!onAcknowledge}
                  >
                    확인
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}

export function AnomalyPanel({
  sites,
  meters,
  initialSiteId,
  initialAnomalies,
}: AnomalyPanelProps): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fallbackSiteId =
    initialSiteId && sites.some((site) => site.id === initialSiteId)
      ? initialSiteId
      : sites[0]?.id ?? ""

  const [selectedSiteId, setSelectedSiteId] = useState(fallbackSiteId)
  const [selectedMeterId, setSelectedMeterId] = useState("")
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>(initialAnomalies)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isRunningDetection, setIsRunningDetection] = useState(false)
  const [isAcknowledgingId, setIsAcknowledgingId] = useState<string | null>(null)

  const siteMeters = useMemo(
    () => meters.filter((meter) => meter.site_id === selectedSiteId),
    [meters, selectedSiteId]
  )

  function updateSearchParams(nextSiteId: string): void {
    const params = new URLSearchParams(searchParams.toString())

    if (nextSiteId) {
      params.set("siteId", nextSiteId)
    } else {
      params.delete("siteId")
    }

    params.set("tab", "anomalies")

    const queryString = params.toString()
    router.replace(queryString ? `/predictions?${queryString}` : "/predictions")
  }

  useEffect(() => {
    if (!selectedSiteId) {
      setSelectedMeterId("")
      setAnomalies([])
      return
    }

    const firstMeterId = siteMeters[0]?.id ?? ""

    if (!siteMeters.some((meter) => meter.id === selectedMeterId)) {
      setSelectedMeterId(firstMeterId)
    }
  }, [selectedMeterId, selectedSiteId, siteMeters])

  useEffect(() => {
    if (!selectedSiteId) {
      setAnomalies([])
      return
    }

    let cancelled = false
    setIsLoadingHistory(true)

    void (async () => {
      const result = await getAnomalyHistory(selectedSiteId)

      if (cancelled) {
        return
      }

      if (result.error) {
        toast.error(result.error)
        setIsLoadingHistory(false)
        return
      }

      setAnomalies(result.data)
      setIsLoadingHistory(false)
    })()

    return () => {
      cancelled = true
    }
  }, [selectedSiteId])

  async function handleRunDetection(): Promise<void> {
    if (!selectedMeterId) {
      toast.error("이상 감지를 실행할 계측기를 선택해 주세요.")
      return
    }

    setIsRunningDetection(true)

    try {
      const result = await runAnomalyDetection(selectedMeterId)

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.detected > 0) {
        toast.success(`${result.detected}건의 이상을 감지했습니다.`)
      } else {
        toast.warning("이번 분석에서 감지된 이상이 없습니다.")
      }

      if (selectedSiteId) {
        const history = await getAnomalyHistory(selectedSiteId)

        if (!history.error) {
          setAnomalies(history.data)
        }
      }
    } catch {
      toast.error("이상 감지 실행 중 오류가 발생했습니다.")
    } finally {
      setIsRunningDetection(false)
    }
  }

  async function handleAcknowledge(id: string): Promise<void> {
    setIsAcknowledgingId(id)

    try {
      const result = await acknowledgeAnomaly(id)

      if (result.error) {
        toast.error(result.error)
        setIsAcknowledgingId(null)
        return
      }

      setAnomalies((current) =>
        current.map((anomaly) =>
          anomaly.id === id ? { ...anomaly, is_acknowledged: true } : anomaly
        )
      )
      toast.success("이상 감지를 확인 처리했습니다.")
    } catch {
      toast.error("확인 처리 중 오류가 발생했습니다.")
    } finally {
      setIsAcknowledgingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>이상 감지 조건</CardTitle>
          <CardDescription>
            사업장과 계측기를 선택하고 최근 90일 데이터를 기준으로 이상을 탐지합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="anomaly-site">사업장</Label>
            <Select
              value={selectedSiteId || "__no_site__"}
              onValueChange={(value) => {
                const nextSiteId = value === "__no_site__" ? "" : value
                setSelectedSiteId(nextSiteId)
                updateSearchParams(nextSiteId)
              }}
            >
              <SelectTrigger id="anomaly-site" className="w-full">
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
            <Label htmlFor="anomaly-meter">계측기</Label>
            <Select
              value={selectedMeterId || "__no_meter__"}
              onValueChange={(value) =>
                setSelectedMeterId(value === "__no_meter__" ? "" : value)
              }
              disabled={siteMeters.length === 0}
            >
              <SelectTrigger id="anomaly-meter" className="w-full">
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
            onClick={handleRunDetection}
            disabled={!selectedMeterId || isRunningDetection}
            className="w-full"
          >
            {isRunningDetection ? "분석 중..." : "이상 감지 실행"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>이상 감지 타임라인</CardTitle>
          <CardDescription>
            최신순 50건까지 표시됩니다.
            {isAcknowledgingId ? " 확인 처리 중..." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-muted-foreground flex h-56 items-center justify-center text-sm">
              이상 감지 이력을 불러오는 중입니다...
            </div>
          ) : (
            <AnomalyTimeline anomalies={anomalies} onAcknowledge={handleAcknowledge} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
