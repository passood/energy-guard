"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel as SelectGroupLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Meter } from "@/types/database"
import { createReading, getUserMeters } from "./actions"

type UserMeter = Meter & { site_name: string }

function toDatetimeLocalValue(date: Date): string {
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export default function DataInputPage() {
  const [meters, setMeters] = useState<UserMeter[]>([])
  const [selectedMeterId, setSelectedMeterId] = useState("")
  const [timestamp, setTimestamp] = useState(() => toDatetimeLocalValue(new Date()))
  const [usageValue, setUsageValue] = useState("")
  const [isLoadingMeters, setIsLoadingMeters] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadMeters() {
      setIsLoadingMeters(true)
      try {
        const loadedMeters = await getUserMeters()
        if (!mounted) {
          return
        }

        setMeters(loadedMeters)
        setSelectedMeterId((current) => current || loadedMeters[0]?.id || "")
      } catch {
        if (mounted) {
          toast.error("계측기 목록을 불러오지 못했습니다.")
        }
      } finally {
        if (mounted) {
          setIsLoadingMeters(false)
        }
      }
    }

    void loadMeters()
    return () => {
      mounted = false
    }
  }, [])

  const groupedMeters = useMemo(() => {
    const grouped = new Map<string, UserMeter[]>()
    const sortedMeters = [...meters].sort(
      (a, b) =>
        a.site_name.localeCompare(b.site_name, "ko-KR") ||
        a.name.localeCompare(b.name, "ko-KR")
    )

    for (const meter of sortedMeters) {
      const siteMeters = grouped.get(meter.site_name)
      if (!siteMeters) {
        grouped.set(meter.site_name, [meter])
        continue
      }
      siteMeters.push(meter)
    }

    return Array.from(grouped.entries())
  }, [meters])

  const selectedMeter = meters.find((meter) => meter.id === selectedMeterId)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedMeterId) {
      toast.error("계측기를 선택해 주세요.")
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData(event.currentTarget)
      formData.set("meter_id", selectedMeterId)

      const result = await createReading(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("데이터가 저장되었습니다.")
      setUsageValue("")
      setTimestamp(toDatetimeLocalValue(new Date()))
    } catch {
      toast.error("데이터 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">에너지 데이터 입력</h1>
        <p className="text-muted-foreground text-sm">
          계측기별 사용량 데이터를 수동으로 입력하거나 엑셀 파일로 업로드하세요.
        </p>
        <div className="inline-flex rounded-lg border p-1">
          <span className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
            수동 입력
          </span>
          <Link
            href="/data/upload"
            className="text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            엑셀 업로드
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>수동 입력</CardTitle>
          <CardDescription>
            계측기, 측정일시, 사용량을 입력해 데이터를 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <input type="hidden" name="meter_id" value={selectedMeterId} />

            <div className="space-y-2">
              <Label htmlFor="meter">계측기</Label>
              <Select
                value={selectedMeterId}
                onValueChange={setSelectedMeterId}
                disabled={isLoadingMeters || meters.length === 0}
              >
                <SelectTrigger id="meter" className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingMeters
                        ? "계측기 목록을 불러오는 중입니다"
                        : "계측기를 선택하세요"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {groupedMeters.map(([siteName, siteMeters]) => (
                    <SelectGroup key={siteName}>
                      <SelectGroupLabel>{siteName}</SelectGroupLabel>
                      {siteMeters.map((meter) => (
                        <SelectItem key={meter.id} value={meter.id}>
                          {meter.name} ({meter.unit})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {meters.length === 0 && !isLoadingMeters && (
                <p className="text-destructive text-sm">
                  등록된 계측기가 없습니다. 먼저 계측기를 추가해 주세요.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timestamp">측정일시</Label>
              <Input
                id="timestamp"
                name="timestamp"
                type="datetime-local"
                value={timestamp}
                onChange={(event) => setTimestamp(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">사용량 {selectedMeter ? `(${selectedMeter.unit})` : ""}</Label>
              <Input
                id="value"
                name="value"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={usageValue}
                onChange={(event) => setUsageValue(event.target.value)}
                placeholder="예: 123.45"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={
                isSubmitting || isLoadingMeters || meters.length === 0 || !selectedMeterId
              }
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
