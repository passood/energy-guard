"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { createSite } from "../actions"
import { BUILDING_TYPES } from "@/lib/constants"
import type { BuildingType } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const buildingTypeOptions: BuildingType[] = ["office", "factory", "commercial", "other"]

export default function NewSitePage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await createSite(new FormData(event.currentTarget))
      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
        return
      }

      router.push("/sites")
      router.refresh()
    } catch {
      setError("사업장 등록 중 오류가 발생했습니다.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">사업장 등록</h1>
        <p className="text-muted-foreground text-sm">새로운 사업장 정보를 입력해주세요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>필수 항목은 반드시 입력해야 합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">사업장 이름 *</Label>
              <Input id="name" name="name" placeholder="예: 에너지가드 본사" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">주소 *</Label>
              <Input id="address" name="address" placeholder="예: 서울시 강남구 ..." required />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="area_sqm">면적(㎡)</Label>
                <Input
                  id="area_sqm"
                  name="area_sqm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="예: 1200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toe_annual">연간 에너지 사용량(TOE)</Label>
                <Input
                  id="toe_annual"
                  name="toe_annual"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="예: 350"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>용도</Label>
              <Select defaultValue="office" name="building_type">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="용도를 선택해주세요." />
                </SelectTrigger>
                <SelectContent>
                  {buildingTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {BUILDING_TYPES[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="사업장 설명 또는 메모를 입력해주세요."
              />
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link href="/sites">취소</Link>
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "등록 중..." : "사업장 등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
