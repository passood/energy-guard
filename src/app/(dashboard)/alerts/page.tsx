import Link from "next/link"
import { ALERT_STATUSES, CONDITION_TYPES } from "@/lib/constants"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { AlertStatus } from "@/types/database"
import { getAlerts, updateAlertStatus } from "./actions"

const statusBadgeClassName: Record<AlertStatus, string> = {
  triggered: "border-red-200 bg-red-50 text-red-700",
  acknowledged: "border-yellow-200 bg-yellow-50 text-yellow-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

function formatKstDate(dateString: string): string {
  return kstDateFormatter.format(new Date(dateString))
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2,
  }).format(value)
}

async function acknowledgeAlertAction(formData: FormData): Promise<void> {
  "use server"

  const alertId = formData.get("alert_id")?.toString().trim() ?? ""

  if (!alertId) return

  await updateAlertStatus(alertId, "acknowledged")
}

async function resolveAlertAction(formData: FormData): Promise<void> {
  "use server"

  const alertId = formData.get("alert_id")?.toString().trim() ?? ""
  const note = formData.get("note")?.toString().trim() ?? ""

  if (!alertId) return

  await updateAlertStatus(alertId, "resolved", note)
}

export default async function AlertsPage() {
  const alerts = await getAlerts()

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">알림 관리</h1>
        <p className="text-muted-foreground text-sm">
          조건 유형: {Object.values(CONDITION_TYPES).join(" / ")}
        </p>
      </div>

      <Tabs value="history" className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="history" className="w-auto px-4">
            알림 이력
          </TabsTrigger>
          <TabsTrigger value="rules" className="w-auto px-4" asChild>
            <Link href="/alerts/rules">알림 규칙</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="rounded-xl border">
        {alerts.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>발생시각</TableHead>
                <TableHead>규칙명</TableHead>
                <TableHead>사업장</TableHead>
                <TableHead>실제값/임계값</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>{formatKstDate(alert.triggered_at)}</TableCell>
                  <TableCell className="font-medium">{alert.rule_name}</TableCell>
                  <TableCell>{alert.site_name}</TableCell>
                  <TableCell>
                    {formatNumber(alert.actual_value)} / {formatNumber(alert.threshold_value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant="outline"
                        className={statusBadgeClassName[alert.status]}
                      >
                        {ALERT_STATUSES[alert.status]}
                      </Badge>
                      {alert.status === "resolved" && alert.note ? (
                        <span className="text-muted-foreground max-w-[220px] truncate text-xs">
                          메모: {alert.note}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {alert.status === "triggered" ? (
                      <form action={acknowledgeAlertAction} className="inline-block">
                        <input type="hidden" name="alert_id" value={alert.id} />
                        <Button type="submit" size="sm" variant="outline">
                          확인
                        </Button>
                      </form>
                    ) : null}

                    {alert.status === "acknowledged" ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm">해결</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>알림 해결 처리</DialogTitle>
                            <DialogDescription>
                              해결 메모를 입력하면 알림 상태를 해결로 변경합니다.
                            </DialogDescription>
                          </DialogHeader>
                          <form action={resolveAlertAction} className="space-y-4">
                            <input type="hidden" name="alert_id" value={alert.id} />
                            <Textarea
                              name="note"
                              placeholder="조치 내용을 입력해 주세요."
                              rows={4}
                            />
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  취소
                                </Button>
                              </DialogClose>
                              <Button type="submit">해결 완료</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-52 items-center justify-center px-6 text-sm text-slate-500">
            최근 발생한 알림이 없습니다.
          </div>
        )}
      </section>
    </main>
  )
}
