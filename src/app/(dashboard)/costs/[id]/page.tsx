"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { deleteCost, getCostById, updateCost } from "../actions"
import { getSites } from "../../sites/actions"
import { ENERGY_TYPES, RATE_TYPES } from "@/lib/constants"
import type { EnergyType, RateType, Site } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ENERGY_TYPE_LIST = Object.keys(ENERGY_TYPES) as EnergyType[]
const RATE_TYPE_LIST = Object.keys(RATE_TYPES) as RateType[]

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <div className="bg-muted h-7 w-48 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded-md" />
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
          <div className="bg-muted h-9 w-full animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
          <div className="bg-muted h-9 w-full animate-pulse rounded-md" />
          <div className="bg-muted h-9 w-full animate-pulse rounded-md" />
          <div className="bg-muted h-9 w-full animate-pulse rounded-md" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function CostDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [costName, setCostName] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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

    async function loadData() {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const [costResult, siteResult] = await Promise.all([
          getCostById(params.id),
          getSites(),
        ])

        if (!isMounted) return

        setSites(siteResult)

        if (costResult.error) {
          setErrorMessage(costResult.error)
          setCostName("")
          setIsLoading(false)
          return
        }

        if (!costResult.data) {
          setErrorMessage("비용 정보를 찾을 수 없습니다.")
          setCostName("")
          setIsLoading(false)
          return
        }

        setCostName(costResult.data.sites.name)
        setFormValues({
          site_id: costResult.data.site_id,
          period_start: costResult.data.period_start,
          period_end: costResult.data.period_end,
          energy_type: costResult.data.energy_type,
          amount_kwh: String(costResult.data.amount_kwh),
          cost_krw: String(costResult.data.cost_krw),
          rate_type: costResult.data.rate_type ?? "other",
        })
        setIsLoading(false)
      } catch {
        if (!isMounted) return
        setErrorMessage("비용 정보를 불러오는 중 오류가 발생했습니다.")
        setCostName("")
        setIsLoading(false)
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [params.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || isDeleting || isLoading) return

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

      const result = await updateCost(params.id, formData)
      if (result.error) {
        setErrorMessage(result.error)
        setIsSubmitting(false)
        return
      }

      router.push("/costs")
      router.refresh()
    } catch {
      setErrorMessage("비용 수정 중 오류가 발생했습니다.")
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (isDeleting || isSubmitting) return

    setErrorMessage("")
    setIsDeleting(true)

    try {
      const result = await deleteCost(params.id)
      if (result.error) {
        setErrorMessage(result.error)
        setIsDeleting(false)
        return
      }

      setIsDialogOpen(false)
      router.push("/costs")
      router.refresh()
    } catch {
      setErrorMessage("비용 삭제 중 오류가 발생했습니다.")
      setIsDeleting(false)
    }
  }

  if (isLoading) return <LoadingSkeleton />

  if (!costName) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">에너지 비용 상세/수정</h1>
        <p className="text-destructive text-sm">
          {errorMessage || "비용 정보를 찾을 수 없습니다."}
        </p>
        <Button asChild variant="outline">
          <Link href="/costs">목록으로 돌아가기</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">에너지 비용 상세/수정</h1>
        <p className="text-muted-foreground text-sm">
          비용 정보를 수정하거나 삭제할 수 있습니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{costName}</CardTitle>
          <CardDescription>등록된 비용 정보를 최신 상태로 유지하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="site_id">사업장 *</Label>
              <Select
                disabled={isSubmitting || isDeleting || sites.length === 0}
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
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="period_start">기간 시작일 *</Label>
                <Input
                  disabled={isSubmitting || isDeleting}
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
                  disabled={isSubmitting || isDeleting}
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
                  disabled={isSubmitting || isDeleting}
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
                  disabled={isSubmitting || isDeleting}
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
                  disabled={isSubmitting || isDeleting}
                  id="amount_kwh"
                  min="0"
                  onChange={(event) =>
                    setFormValues((previous) => ({
                      ...previous,
                      amount_kwh: event.target.value,
                    }))
                  }
                  required
                  step="0.01"
                  type="number"
                  value={formValues.amount_kwh}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_krw">비용(원) *</Label>
                <Input
                  disabled={isSubmitting || isDeleting}
                  id="cost_krw"
                  min="0"
                  onChange={(event) =>
                    setFormValues((previous) => ({
                      ...previous,
                      cost_krw: event.target.value,
                    }))
                  }
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

            <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
              <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={isSubmitting || isDeleting} type="button" variant="destructive">
                    삭제
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>비용 내역을 삭제할까요?</DialogTitle>
                    <DialogDescription>
                      삭제한 비용 정보는 복구할 수 없습니다. 정말 삭제하시겠습니까?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      disabled={isDeleting}
                      onClick={() => setIsDialogOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      취소
                    </Button>
                    <Button
                      disabled={isDeleting}
                      onClick={handleDelete}
                      type="button"
                      variant="destructive"
                    >
                      {isDeleting ? "삭제 중..." : "삭제"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex justify-end gap-2">
                <Button asChild type="button" variant="outline">
                  <Link href="/costs">목록으로</Link>
                </Button>
                <Button
                  disabled={isSubmitting || isDeleting || sites.length === 0 || !formValues.site_id}
                  type="submit"
                >
                  {isSubmitting ? "저장 중..." : "수정 저장"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
