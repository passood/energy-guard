"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createCost } from "../actions"
import { getSites } from "../../sites/actions"
import { ENERGY_TYPES, RATE_TYPES } from "@/lib/constants"
import type { EnergyType, RateType, Site } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ENERGY_TYPE_LIST = Object.keys(ENERGY_TYPES) as EnergyType[]
const RATE_TYPE_LIST = Object.keys(RATE_TYPES) as RateType[]

export default function NewCostPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [isSiteLoading, setIsSiteLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [formValues, setFormValues] = useState({
    site_id: "",
    period_start: "",
    period_end: "",
    energy_type: "electricity" as EnergyType,
    amount_kwh: "",
    cost_krw: "",
    rate_type: "industrial_a" as RateType,
  })

  useEffect(() => {
    let isMounted = true

    async function loadSites() {
      setIsSiteLoading(true)
      setErrorMessage("")

      try {
        const fetchedSites = await getSites()

        if (!isMounted) return

        setSites(fetchedSites)
        if (fetchedSites.length > 0) {
          setFormValues((previous) => ({
            ...previous,
            site_id: previous.site_id || fetchedSites[0].id,
          }))
        }
      } catch {
        if (!isMounted) return
        setErrorMessage("사업장 목록을 불러오는 중 오류가 발생했습니다.")
      } finally {
        if (isMounted) {
          setIsSiteLoading(false)
        }
      }
    }

    void loadSites()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || isSiteLoading) return

    setErrorMessage("")
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("site_id", formValues.site_id)
      formData.append("period_start", formValues.period_start)
      formData.append("period_end", formValues.period_end)
      formData.append("energy_type", formValues.energy_type)
      formData.append("amount_kwh", formValues.amount_kwh)
      formData.append("cost_krw", formValues.cost_krw)
      formData.append("rate_type", formValues.rate_type)

      const result = await createCost(formData)
      if (result.error) {
        setErrorMessage(result.error)
        setIsSubmitting(false)
        return
      }

      router.push("/costs")
      router.refresh()
    } catch {
      setErrorMessage("비용 등록 중 오류가 발생했습니다.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">에너지 비용 등록</h1>
        <p className="text-muted-foreground text-sm">
          사업장별 에너지 비용과 요금 유형을 등록합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>비용 정보 입력</CardTitle>
          <CardDescription>필수 항목을 입력한 뒤 저장해 주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="site_id">사업장 *</Label>
              <Select
                disabled={isSiteLoading || isSubmitting || sites.length === 0}
                onValueChange={(value) =>
                  setFormValues((previous) => ({ ...previous, site_id: value }))
                }
                value={formValues.site_id}
              >
                <SelectTrigger className="w-full" id="site_id">
                  <SelectValue placeholder="사업장을 선택해주세요." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isSiteLoading && sites.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  등록 가능한 사업장이 없습니다. 먼저 사업장을 등록해 주세요.
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="period_start">기간 시작일 *</Label>
                <Input
                  disabled={isSubmitting}
                  id="period_start"
                  onChange={(event) =>
                    setFormValues((previous) => ({
                      ...previous,
                      period_start: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={formValues.period_start}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end">기간 종료일 *</Label>
                <Input
                  disabled={isSubmitting}
                  id="period_end"
                  onChange={(event) =>
                    setFormValues((previous) => ({
                      ...previous,
                      period_end: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={formValues.period_end}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="energy_type">에너지 유형 *</Label>
                <Select
                  disabled={isSubmitting}
                  onValueChange={(value) => {
                    if (value !== "electricity" && value !== "gas" && value !== "water") {
                      return
                    }
                    setFormValues((previous) => ({
                      ...previous,
                      energy_type: value,
                    }))
                  }}
                  value={formValues.energy_type}
                >
                  <SelectTrigger className="w-full" id="energy_type">
                    <SelectValue placeholder="에너지 유형을 선택해주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {ENERGY_TYPE_LIST.map((energyType) => (
                      <SelectItem key={energyType} value={energyType}>
                        {ENERGY_TYPES[energyType].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate_type">요금 유형 *</Label>
                <Select
                  disabled={isSubmitting}
                  onValueChange={(value) => {
                    if (!(value in RATE_TYPES)) return
                    setFormValues((previous) => ({
                      ...previous,
                      rate_type: value as RateType,
                    }))
                  }}
                  value={formValues.rate_type}
                >
                  <SelectTrigger className="w-full" id="rate_type">
                    <SelectValue placeholder="요금 유형을 선택해주세요." />
                  </SelectTrigger>
                  <SelectContent>
                    {RATE_TYPE_LIST.map((rateType) => (
                      <SelectItem key={rateType} value={rateType}>
                        {RATE_TYPES[rateType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount_kwh">사용량 *</Label>
                <Input
                  disabled={isSubmitting}
                  id="amount_kwh"
                  min="0"
                  onChange={(event) =>
                    setFormValues((previous) => ({
                      ...previous,
                      amount_kwh: event.target.value,
                    }))
                  }
                  placeholder="예: 12500"
                  required
                  step="0.01"
                  type="number"
                  value={formValues.amount_kwh}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_krw">비용(원) *</Label>
                <Input
                  disabled={isSubmitting}
                  id="cost_krw"
                  min="0"
                  onChange={(event) =>
                    setFormValues((previous) => ({
                      ...previous,
                      cost_krw: event.target.value,
                    }))
                  }
                  placeholder="예: 1800000"
                  required
                  step="1"
                  type="number"
                  value={formValues.cost_krw}
                />
              </div>
            </div>

            {errorMessage ? (
              <p className="text-destructive text-sm" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link href="/costs">취소</Link>
              </Button>
              <Button
                disabled={
                  isSubmitting ||
                  isSiteLoading ||
                  sites.length === 0 ||
                  !formValues.site_id
                }
                type="submit"
              >
                {isSubmitting ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
