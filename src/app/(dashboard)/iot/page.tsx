import { DEVICE_TYPES, ENERGY_TYPES, IOT_PROTOCOLS } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import { getMeters } from "../meters/actions"
import { getSites } from "../sites/actions"
import { createIotDevice, deleteIotDevice, getIotDevices, regenerateApiKey } from "./actions"

interface IotPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const lastSeenDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function getSiteIdFromSearchParams(
  params: Record<string, string | string[] | undefined>
): string | undefined {
  const value = params.siteId
  const selectedValue = Array.isArray(value) ? value[0] : value

  if (!selectedValue || selectedValue === "all") {
    return undefined
  }

  return selectedValue
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "****"
  }

  return `${apiKey.slice(0, 4)}${"*".repeat(Math.max(0, apiKey.length - 8))}${apiKey.slice(-4)}`
}

function formatLastSeen(value: string | null): string {
  if (!value) {
    return "미통신"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "-"
  }

  return lastSeenDateFormatter.format(parsed)
}

async function createIotDeviceAction(formData: FormData): Promise<void> {
  "use server"

  await createIotDevice(formData)
}

export default async function IotPage({ searchParams }: IotPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedSiteId = getSiteIdFromSearchParams(resolvedSearchParams)
  const sites = await getSites()
  const selectedSiteId = sites.some((site) => site.id === requestedSiteId)
    ? requestedSiteId
    : undefined

  const [meters, devicesResult] = await Promise.all([
    getMeters(),
    getIotDevices(selectedSiteId),
  ])

  const devices = devicesResult.data
  const defaultCreateSiteId = selectedSiteId ?? sites[0]?.id ?? ""
  const siteNameMap = new Map(sites.map((site) => [site.id, site.name]))
  const selectableMeters = selectedSiteId
    ? meters.filter((meter) => meter.site_id === selectedSiteId)
    : meters

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">IoT 디바이스 관리</h1>
          <p className="text-muted-foreground text-sm">
            센서 디바이스를 등록하고 API 연동 상태를 확인하세요.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button disabled={sites.length === 0}>새 디바이스 등록</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 IoT 디바이스 등록</DialogTitle>
              <DialogDescription>
                사업장과 계측기를 연결한 뒤 API 키를 발급받아 센서에서 사용하세요.
              </DialogDescription>
            </DialogHeader>
            <form action={createIotDeviceAction} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="create-site-id">
                  사업장
                </label>
                <Select defaultValue={defaultCreateSiteId} name="siteId" required>
                  <SelectTrigger id="create-site-id" className="w-full">
                    <SelectValue placeholder="사업장을 선택하세요." />
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="create-meter-id">
                  계측기
                </label>
                <Select defaultValue="none" name="meterId">
                  <SelectTrigger id="create-meter-id" className="w-full">
                    <SelectValue placeholder="연결할 계측기를 선택하세요." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">연결 안 함</SelectItem>
                    {selectableMeters.map((meter) => (
                      <SelectItem key={meter.id} value={meter.id}>
                        {siteNameMap.get(meter.site_id) ?? "미확인 사업장"} · {meter.name} (
                        {ENERGY_TYPES[meter.energy_type].label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="create-device-name">
                  디바이스 이름
                </label>
                <Input
                  id="create-device-name"
                  maxLength={100}
                  name="deviceName"
                  placeholder="예: 본관 전력 센서 #01"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="create-device-type">
                    디바이스 유형
                  </label>
                  <Select defaultValue="sensor" name="deviceType" required>
                    <SelectTrigger id="create-device-type" className="w-full">
                      <SelectValue placeholder="유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEVICE_TYPES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="create-protocol">
                    프로토콜
                  </label>
                  <Select defaultValue="rest" name="protocol" required>
                    <SelectTrigger id="create-protocol" className="w-full">
                      <SelectValue placeholder="프로토콜 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rest">{IOT_PROTOCOLS.rest}</SelectItem>
                      <SelectItem value="mqtt">{IOT_PROTOCOLS.mqtt}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    취소
                  </Button>
                </DialogClose>
                <Button type="submit">등록</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      {sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>사업장이 없습니다</CardTitle>
            <CardDescription>
              IoT 디바이스를 등록하려면 먼저 사업장과 계측기를 생성해 주세요.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">사업장 필터</CardTitle>
            <CardDescription>조회할 사업장을 선택하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap items-center gap-2" method="get">
              <Select defaultValue={selectedSiteId ?? "all"} name="siteId">
                <SelectTrigger className="h-9 min-w-[220px]" id="filter-site-id">
                  <SelectValue placeholder="사업장을 선택하세요." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 사업장</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" type="submit">
                적용
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>디바이스 목록</CardTitle>
          <CardDescription>
            {selectedSiteId
              ? `${siteNameMap.get(selectedSiteId) ?? "선택 사업장"} 기준 ${devices.length}대`
              : `전체 사업장 기준 ${devices.length}대`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devicesResult.error ? (
            <p className="text-destructive py-10 text-center text-sm">{devicesResult.error}</p>
          ) : devices.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              등록된 IoT 디바이스가 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>프로토콜</TableHead>
                  <TableHead>연결 계측기</TableHead>
                  <TableHead>API 키</TableHead>
                  <TableHead>마지막 통신</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.device_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{DEVICE_TYPES[device.device_type]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          device.protocol === "rest"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }
                      >
                        {IOT_PROTOCOLS[device.protocol]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {device.meters ? (
                        <div className="space-y-0.5">
                          <p>{device.meters.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {ENERGY_TYPES[device.meters.energy_type as keyof typeof ENERGY_TYPES]
                              ?.label ?? device.meters.energy_type}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">미연결</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">
                          {maskApiKey(device.api_key)}
                        </code>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              보기
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>API 키</DialogTitle>
                              <DialogDescription>
                                아래 키를 Authorization 헤더에 Bearer 토큰으로 전달하세요.
                              </DialogDescription>
                            </DialogHeader>
                            <code className="block rounded-md bg-slate-100 p-3 font-mono text-xs break-all">
                              {device.api_key}
                            </code>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  닫기
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                    <TableCell>{formatLastSeen(device.last_seen_at)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          device.is_active
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100"
                        }
                        variant="secondary"
                      >
                        {device.is_active ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              API 키 재발급
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>API 키를 재발급할까요?</DialogTitle>
                              <DialogDescription>
                                기존 키는 즉시 무효화됩니다. 연동 시스템의 키를 함께 변경해 주세요.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  취소
                                </Button>
                              </DialogClose>
                              <form
                                action={async () => {
                                  "use server"
                                  await regenerateApiKey(device.id)
                                }}
                              >
                                <Button type="submit">재발급</Button>
                              </form>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              삭제
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>디바이스를 삭제할까요?</DialogTitle>
                              <DialogDescription>
                                삭제 후에는 복구할 수 없으며 API 키도 함께 폐기됩니다.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  취소
                                </Button>
                              </DialogClose>
                              <form
                                action={async () => {
                                  "use server"
                                  await deleteIotDevice(device.id)
                                }}
                              >
                                <Button type="submit" variant="destructive">
                                  삭제
                                </Button>
                              </form>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API 연동 가이드</CardTitle>
          <CardDescription>IoT 센서에서 아래 형식으로 데이터를 전송하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border bg-slate-50 p-4 text-xs leading-relaxed">
{`POST /api/iot/readings
Headers:
  Authorization: Bearer {api_key}
Body:
  {
    "device_id": "your-device-id",
    "readings": [
      { "timestamp": "2026-03-01T12:00:00+09:00", "value": 123.45 }
    ]
  }`}
          </pre>
        </CardContent>
      </Card>
    </main>
  )
}
