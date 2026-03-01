"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ENERGY_TYPES } from "@/lib/constants"
import type { EnergyType, MeasurementUnit, Site } from "@/types/database"
import { createMeter, getUserSites } from "../actions"

const UNIT_BY_ENERGY_TYPE: Record<EnergyType, MeasurementUnit> = {
  electricity: "kWh",
  gas: "m3",
  water: "ton",
}

const ENERGY_TYPE_LIST = Object.keys(ENERGY_TYPES) as EnergyType[]

export default function NewMeterPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [siteLoading, setSiteLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [formValues, setFormValues] = useState({
    site_id: "",
    name: "",
    energy_type: "electricity" as EnergyType,
    unit: "kWh" as MeasurementUnit,
    location: "",
  })

  useEffect(() => {
    let mounted = true

    const loadSites = async () => {
      setSiteLoading(true)
      setErrorMessage("")

      try {
        const fetchedSites = await getUserSites()

        if (!mounted) {
          return
        }

        setSites(fetchedSites)

        if (fetchedSites.length > 0) {
          setFormValues((previous) => ({
            ...previous,
            site_id: previous.site_id || fetchedSites[0].id,
          }))
        }
      } catch {
        if (mounted) {
          setErrorMessage("사업장 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.")
        }
      } finally {
        if (mounted) {
          setSiteLoading(false)
        }
      }
    }

    void loadSites()

    return () => {
      mounted = false
    }
  }, [])

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

    if (siteLoading || submitLoading) {
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

    const result = await createMeter(formData)

    if (result.error) {
      setErrorMessage(result.error)
      setSubmitLoading(false)
      return
    }

    router.push("/meters")
    router.refresh()
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">계측기 등록</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          사업장에 사용할 계측기 정보를 입력하세요.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>계측기 정보 입력</CardTitle>
          <CardDescription>
            필수 항목을 입력한 뒤 등록 버튼을 눌러주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="site_id">사업장</Label>
              <Select
                disabled={siteLoading || submitLoading || sites.length === 0}
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
              {!siteLoading && sites.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  등록 가능한 사업장이 없습니다. 먼저 사업장을 등록해주세요.
                </p>
              )}
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
                placeholder="예: 본관 전력 계량기"
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
                placeholder="예: 지하 1층 기계실"
                value={formValues.location}
              />
            </div>

            {errorMessage && (
              <p className="text-destructive text-sm" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild type="button" variant="outline">
                <Link href="/meters">취소</Link>
              </Button>
              <Button
                disabled={
                  submitLoading ||
                  siteLoading ||
                  sites.length === 0 ||
                  !formValues.site_id
                }
                type="submit"
              >
                {submitLoading ? "등록 중..." : "등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
