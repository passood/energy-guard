"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ENERGY_TYPES } from "@/lib/constants"
import type { EnergyType, MeasurementUnit, Meter, Site } from "@/types/database"
import { deleteMeter, getMeterById, getUserSites, updateMeter } from "../actions"

const UNIT_BY_ENERGY_TYPE: Record<EnergyType, MeasurementUnit> = {
  electricity: "kWh",
  gas: "m3",
  water: "ton",
}

const ENERGY_TYPE_LIST = Object.keys(ENERGY_TYPES) as EnergyType[]

export default function MeterDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const meterId = params.id
  const [meter, setMeter] = useState<Meter | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formValues, setFormValues] = useState({
    site_id: "",
    name: "",
    energy_type: "electricity" as EnergyType,
    unit: "kWh" as MeasurementUnit,
    location: "",
    is_active: true,
  })

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      setLoading(true)
      setErrorMessage("")

      try {
        const [meterData, siteData] = await Promise.all([
          getMeterById(meterId),
          getUserSites(),
        ])

        if (!mounted) {
          return
        }

        setSites(siteData)

        if (!meterData) {
          setMeter(null)
          setErrorMessage("계측기 정보를 찾을 수 없거나 접근 권한이 없습니다.")
          return
        }

        setMeter(meterData)
        setFormValues({
          site_id: meterData.site_id,
          name: meterData.name,
          energy_type: meterData.energy_type,
          unit: meterData.unit,
          location: meterData.location ?? "",
          is_active: meterData.is_active,
        })
      } catch {
        if (mounted) {
          setErrorMessage("계측기 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    if (!meterId) {
      setErrorMessage("잘못된 계측기 경로입니다.")
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    void loadData()

    return () => {
      mounted = false
    }
  }, [meterId])

  const handleEnergyTypeChange = (value: string) => {
    if (value !== "electricity" && value !== "gas" && value !== "water") {
      return
    }

    setFormValues((previous) => ({
      ...previous,
      energy_type: value,
      unit: UNIT_BY_ENERGY_TYPE[value],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!meterId || submitLoading) {
      return
    }

    setSubmitLoading(true)
    setErrorMessage("")

    const formData = new FormData()
    formData.append("site_id", formValues.site_id)
    formData.append("name", formValues.name)
    formData.append("energy_type", formValues.energy_type)
    formData.append("unit", formValues.unit)
    formData.append("location", formValues.location)
    formData.append("is_active", String(formValues.is_active))

    const result = await updateMeter(meterId, formData)

    if (result.error) {
      setErrorMessage(result.error)
      setSubmitLoading(false)
      return
    }

    router.push("/meters")
    router.refresh()
  }

  const handleDelete = async () => {
    if (!meterId || deleteLoading) {
      return
    }

    setDeleteLoading(true)
    setDeleteErrorMessage("")

    const result = await deleteMeter(meterId)

    if (result.error) {
      setDeleteErrorMessage(result.error)
      setDeleteLoading(false)
      return
    }

    setDeleteDialogOpen(false)
    router.push("/meters")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-4 w-80 animate-pulse rounded-md bg-zinc-100" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-36 animate-pulse rounded-md bg-zinc-200" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-zinc-100" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-100" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-100" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-100" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-100" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-100" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!meter) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>계측기 정보를 불러올 수 없습니다</CardTitle>
            <CardDescription>
              {errorMessage || "요청한 계측기가 존재하지 않습니다."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/meters">목록으로 이동</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">계측기 상세/수정</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          계측기 정보를 수정하거나 삭제할 수 있습니다.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{meter.name}</CardTitle>
          <CardDescription>계측기 정보를 최신 상태로 유지하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="site_id">사업장</Label>
              <Select
                disabled={submitLoading || sites.length === 0}
                onValueChange={(value) =>
                  setFormValues((previous) => ({ ...previous, site_id: value }))
                }
                value={formValues.site_id}
              >
                <SelectTrigger className="w-full" id="site_id">
                  <SelectValue placeholder="사업장을 선택하세요" />
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

            <div className="space-y-2">
              <Label htmlFor="name">계측기명</Label>
              <Input
                disabled={submitLoading}
                id="name"
                maxLength={100}
                onChange={(event) =>
                  setFormValues((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                required
                value={formValues.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="energy_type">에너지 유형</Label>
              <Select
                disabled={submitLoading}
                onValueChange={handleEnergyTypeChange}
                value={formValues.energy_type}
              >
                <SelectTrigger className="w-full" id="energy_type">
                  <SelectValue placeholder="에너지 유형을 선택하세요" />
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
              <Label htmlFor="unit">단위</Label>
              <Input disabled id="unit" readOnly value={formValues.unit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">설치 위치</Label>
              <Input
                disabled={submitLoading}
                id="location"
                maxLength={120}
                onChange={(event) =>
                  setFormValues((previous) => ({
                    ...previous,
                    location: event.target.value,
                  }))
                }
                value={formValues.location}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">상태</Label>
              <Select
                disabled={submitLoading}
                onValueChange={(value) =>
                  setFormValues((previous) => ({
                    ...previous,
                    is_active: value === "true",
                  }))
                }
                value={String(formValues.is_active)}
              >
                <SelectTrigger className="w-full" id="is_active">
                  <SelectValue placeholder="상태를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">활성</SelectItem>
                  <SelectItem value="false">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {errorMessage && (
              <p className="text-destructive text-sm" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    disabled={submitLoading || deleteLoading}
                    type="button"
                    variant="destructive"
                  >
                    삭제
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>계측기를 삭제할까요?</DialogTitle>
                    <DialogDescription>
                      삭제한 계측기는 복구할 수 없습니다. 관련 데이터 입력 시 영향이 있을 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  {deleteErrorMessage && (
                    <p className="text-destructive text-sm" role="alert">
                      {deleteErrorMessage}
                    </p>
                  )}
                  <DialogFooter>
                    <Button
                      disabled={deleteLoading}
                      onClick={() => setDeleteDialogOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      취소
                    </Button>
                    <Button
                      disabled={deleteLoading}
                      onClick={handleDelete}
                      type="button"
                      variant="destructive"
                    >
                      {deleteLoading ? "삭제 중..." : "삭제"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button asChild type="button" variant="outline">
                  <Link href="/meters">목록</Link>
                </Button>
                <Button
                  disabled={
                    submitLoading ||
                    deleteLoading ||
                    sites.length === 0 ||
                    !formValues.site_id
                  }
                  type="submit"
                >
                  {submitLoading ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
