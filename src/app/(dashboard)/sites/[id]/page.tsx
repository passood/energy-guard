"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { deleteSite, getSiteById, updateSite } from "../actions"
import { BUILDING_TYPES } from "@/lib/constants"
import type { BuildingType, Site } from "@/types/database"
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
import { Textarea } from "@/components/ui/textarea"

const buildingTypeOptions: BuildingType[] = ["office", "factory", "commercial", "other"]

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
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
          <div className="bg-muted h-24 w-full animate-pulse rounded-md" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function SiteDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [site, setSite] = useState<Site | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadSite() {
      setIsLoading(true)
      const loaded = await getSiteById(params.id)

      if (!isActive) return

      if (!loaded) {
        setSite(null)
        setError("사업장 정보를 찾을 수 없습니다.")
        setIsLoading(false)
        return
      }

      setSite(loaded)
      setError(null)
      setIsLoading(false)
    }

    loadSite().catch(() => {
      if (!isActive) return
      setSite(null)
      setError("사업장 정보를 불러오는 중 오류가 발생했습니다.")
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [params.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!site || isSubmitting || isDeleting) return

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await updateSite(site.id, new FormData(event.currentTarget))
      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
        return
      }

      router.push("/sites")
      router.refresh()
    } catch {
      setError("사업장 수정 중 오류가 발생했습니다.")
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!site || isSubmitting || isDeleting) return

    setError(null)
    setIsDeleting(true)

    try {
      const result = await deleteSite(site.id)
      if (result.error) {
        setError(result.error)
        setIsDeleting(false)
        return
      }

      setIsDialogOpen(false)
      router.push("/sites")
      router.refresh()
    } catch {
      setError("사업장 삭제 중 오류가 발생했습니다.")
      setIsDeleting(false)
    }
  }

  if (isLoading) return <LoadingSkeleton />

  if (!site) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">사업장 상세/수정</h1>
        <p className="text-destructive text-sm">{error ?? "사업장 정보를 찾을 수 없습니다."}</p>
        <Button asChild variant="outline">
          <Link href="/sites">목록으로 돌아가기</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">사업장 상세/수정</h1>
        <p className="text-muted-foreground text-sm">사업장 정보를 수정하거나 삭제할 수 있습니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{site.name}</CardTitle>
          <CardDescription>등록된 사업장 정보를 수정하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" key={site.id} onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">사업장 이름 *</Label>
              <Input defaultValue={site.name} id="name" name="name" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">주소 *</Label>
              <Input defaultValue={site.address} id="address" name="address" required />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="area_sqm">면적(㎡)</Label>
                <Input
                  defaultValue={site.area_sqm === null ? "" : site.area_sqm}
                  id="area_sqm"
                  name="area_sqm"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toe_annual">연간 에너지 사용량(TOE)</Label>
                <Input
                  defaultValue={site.toe_annual === null ? "" : site.toe_annual}
                  id="toe_annual"
                  name="toe_annual"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>용도</Label>
              <Select defaultValue={site.building_type} name="building_type">
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
                defaultValue={site.description ?? ""}
                id="description"
                name="description"
                placeholder="사업장 설명 또는 메모를 입력해주세요."
              />
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
              <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={isSubmitting || isDeleting} type="button" variant="destructive">
                    사업장 삭제
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>사업장을 삭제할까요?</DialogTitle>
                    <DialogDescription>
                      삭제한 사업장은 복구할 수 없습니다. 정말 삭제하시겠습니까?
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
                  <Link href="/sites">목록으로</Link>
                </Button>
                <Button disabled={isSubmitting || isDeleting} type="submit">
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
