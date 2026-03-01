"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { CONDITION_TYPES, TIME_WINDOWS } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AlertRule, ConditionType, Meter, Site, TimeWindow } from "@/types/database"
import {
  createAlertRule,
  deleteAlertRule,
  getAlertRules,
  getUserSitesAndMeters,
  updateAlertRule,
} from "../actions"

type AlertRuleWithNames = AlertRule & {
  site_name: string
  meter_name?: string
}

type SiteWithMeters = Site & {
  meters: Meter[]
}

type RuleFormState = {
  site_id: string
  meter_id: string
  name: string
  condition_type: ConditionType
  threshold_value: string
  threshold_unit: string
  time_window: TimeWindow
  notify_email: string
}

const kstDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function getInitialFormState(): RuleFormState {
  return {
    site_id: "",
    meter_id: "",
    name: "",
    condition_type: "exceeds",
    threshold_value: "",
    threshold_unit: "kWh",
    time_window: "daily",
    notify_email: "",
  }
}

function formatKstDate(dateString: string): string {
  return kstDateFormatter.format(new Date(dateString))
}

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRuleWithNames[]>([])
  const [sites, setSites] = useState<SiteWithMeters[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false)
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AlertRuleWithNames | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [formErrorMessage, setFormErrorMessage] = useState("")
  const [formState, setFormState] = useState<RuleFormState>(getInitialFormState)

  const selectedSiteMeters = useMemo(
    () => sites.find((site) => site.id === formState.site_id)?.meters ?? [],
    [formState.site_id, sites]
  )

  async function refreshData(): Promise<void> {
    setIsLoading(true)

    try {
      const [fetchedRules, fetchedSites] = await Promise.all([
        getAlertRules(),
        getUserSitesAndMeters(),
      ])

      setRules(fetchedRules)
      setSites(fetchedSites)
      setErrorMessage("")
    } catch {
      setErrorMessage("알림 규칙 데이터를 불러오는 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshData()
  }, [])

  async function handleCreateRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreateSubmitting(true)

    const formData = new FormData()
    formData.set("site_id", formState.site_id)
    formData.set("meter_id", formState.meter_id)
    formData.set("name", formState.name)
    formData.set("condition_type", formState.condition_type)
    formData.set("threshold_value", formState.threshold_value)
    formData.set("threshold_unit", formState.threshold_unit)
    formData.set("time_window", formState.time_window)
    formData.set("notify_email", formState.notify_email)

    const result = await createAlertRule(formData)

    if (result.error) {
      setFormErrorMessage(result.error)
      setIsCreateSubmitting(false)
      return
    }

    setFormErrorMessage("")
    setFormState(getInitialFormState())
    setIsCreateDialogOpen(false)
    await refreshData()
    setIsCreateSubmitting(false)
  }

  async function handleToggleRule(rule: AlertRuleWithNames): Promise<void> {
    setPendingRuleId(rule.id)
    setErrorMessage("")

    const formData = new FormData()
    formData.set("is_active", String(!rule.is_active))

    const result = await updateAlertRule(rule.id, formData)

    if (result.error) {
      setErrorMessage(result.error)
      setPendingRuleId(null)
      return
    }

    await refreshData()
    setPendingRuleId(null)
  }

  async function handleDeleteRule(): Promise<void> {
    if (!deleteTarget) return

    setIsDeleting(true)

    const result = await deleteAlertRule(deleteTarget.id)

    if (result.error) {
      setErrorMessage(result.error)
      setIsDeleting(false)
      return
    }

    setDeleteTarget(null)
    setIsDeleting(false)
    await refreshData()
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">알림 규칙 관리</h1>
        <p className="text-muted-foreground text-sm">
          사업장별 임계 알림 규칙을 생성하고 활성 상태를 관리하세요.
        </p>
      </div>

      <Tabs value="rules" className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="history" className="w-auto px-4" asChild>
            <Link href="/alerts">알림 이력</Link>
          </TabsTrigger>
          <TabsTrigger value="rules" className="w-auto px-4">
            알림 규칙
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">총 {rules.length}개 규칙</div>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            if (!open) {
              setFormState(getInitialFormState())
              setFormErrorMessage("")
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>새 규칙 생성</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>알림 규칙 생성</DialogTitle>
              <DialogDescription>
                사업장과 계측기를 선택하고 임계 조건을 설정해 주세요.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site-select">사업장</Label>
                  <Select
                    value={formState.site_id}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, site_id: value, meter_id: "" }))
                    }
                  >
                    <SelectTrigger id="site-select" className="w-full">
                      <SelectValue placeholder="사업장 선택" />
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
                  <Label htmlFor="meter-select">계측기 (선택)</Label>
                  <Select
                    value={formState.meter_id || "__all__"}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        meter_id: value === "__all__" ? "" : value,
                      }))
                    }
                    disabled={!formState.site_id}
                  >
                    <SelectTrigger id="meter-select" className="w-full">
                      <SelectValue placeholder="전체 계측기" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">전체 계측기</SelectItem>
                      {selectedSiteMeters.map((meter) => (
                        <SelectItem key={meter.id} value={meter.id}>
                          {meter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-name">규칙명</Label>
                <Input
                  id="rule-name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="예: 전력 피크 초과"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="condition-type">조건</Label>
                  <Select
                    value={formState.condition_type}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        condition_type: value as ConditionType,
                      }))
                    }
                  >
                    <SelectTrigger id="condition-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_TYPES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-window">감시기간</Label>
                  <Select
                    value={formState.time_window}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        time_window: value as TimeWindow,
                      }))
                    }
                  >
                    <SelectTrigger id="time-window" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIME_WINDOWS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="threshold-value">임계값</Label>
                  <Input
                    id="threshold-value"
                    type="number"
                    step="0.01"
                    value={formState.threshold_value}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        threshold_value: event.target.value,
                      }))
                    }
                    placeholder="예: 100"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold-unit">단위</Label>
                  <Input
                    id="threshold-unit"
                    value={formState.threshold_unit}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        threshold_unit: event.target.value,
                      }))
                    }
                    placeholder="예: kWh"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notify-email">알림 이메일</Label>
                <Input
                  id="notify-email"
                  type="email"
                  value={formState.notify_email}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      notify_email: event.target.value,
                    }))
                  }
                  placeholder="alert@example.com"
                  required
                />
              </div>

              {formErrorMessage ? (
                <p className="text-sm text-red-600">{formErrorMessage}</p>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button" disabled={isCreateSubmitting}>
                    취소
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isCreateSubmitting}>
                  {isCreateSubmitting ? "생성 중..." : "규칙 생성"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <section className="rounded-xl border">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            데이터를 불러오는 중입니다...
          </div>
        ) : rules.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>규칙명</TableHead>
                <TableHead>사업장</TableHead>
                <TableHead>계측기</TableHead>
                <TableHead>조건</TableHead>
                <TableHead>임계값</TableHead>
                <TableHead>감시기간</TableHead>
                <TableHead>알림 이메일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.site_name}</TableCell>
                  <TableCell>{rule.meter_name ?? "전체 계측기"}</TableCell>
                  <TableCell>{CONDITION_TYPES[rule.condition_type]}</TableCell>
                  <TableCell>
                    {rule.threshold_value} {rule.threshold_unit}
                  </TableCell>
                  <TableCell>{TIME_WINDOWS[rule.time_window]}</TableCell>
                  <TableCell>{rule.notify_email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        rule.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-slate-50 text-slate-600"
                      }
                    >
                      {rule.is_active ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatKstDate(rule.created_at)}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingRuleId === rule.id}
                      onClick={() => {
                        void handleToggleRule(rule)
                      }}
                    >
                      {pendingRuleId === rule.id
                        ? "처리 중..."
                        : rule.is_active
                          ? "비활성화"
                          : "활성화"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      삭제
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            등록된 알림 규칙이 없습니다.
          </div>
        )}
      </section>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>규칙 삭제</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" 규칙을 삭제하시겠습니까?`
                : "선택한 규칙을 삭제하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isDeleting}>
                취소
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleDeleteRule()
              }}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
