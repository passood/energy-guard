"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import { DownloadIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MAX_EXCEL_FILE_SIZE } from "@/lib/constants"
import { parseExcelFile, generateTemplate } from "@/lib/excel-parser"
import { cn } from "@/lib/utils"
import type { Meter } from "@/types/database"
import { createBulkReadings, getUserMeters } from "../actions"

type UserMeter = Meter & { site_name: string }

type ParsedReadingInput = {
  meter_id: string
  timestamp: string
  value: number
  unit: string
}

type PreviewRow = {
  rowNumber: number
  meter: string
  timestamp: string
  value: string
  errorMessage?: string
}

function buildPreviewRows(buffer: ArrayBuffer, errors: string[]): PreviewRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  if (workbook.SheetNames.length === 0) {
    return []
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) {
    return []
  }

  const rows = XLSX.utils.sheet_to_json<Array<string | number | Date>>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  })

  const errorByRow = new Map<number, string>()
  for (const error of errors) {
    const matched = error.match(/^(\d+)행:\s*(.+)$/)
    if (matched) {
      errorByRow.set(Number(matched[1]), matched[2])
    }
  }

  const previewRows: PreviewRow[] = []
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const rowNumber = rowIndex + 1

    const meter = String(row[0] ?? "").trim()
    const timestamp = String(row[1] ?? "").trim()
    const value = String(row[2] ?? "").trim()

    if (!meter && !timestamp && !value) {
      continue
    }

    previewRows.push({
      rowNumber,
      meter,
      timestamp,
      value,
      errorMessage: errorByRow.get(rowNumber),
    })
  }

  const existingRows = new Set(previewRows.map((row) => row.rowNumber))
  for (const [rowNumber, errorMessage] of errorByRow.entries()) {
    if (!existingRows.has(rowNumber)) {
      previewRows.push({
        rowNumber,
        meter: "",
        timestamp: "",
        value: "",
        errorMessage,
      })
    }
  }

  return previewRows.sort((a, b) => a.rowNumber - b.rowNumber)
}

export default function DataUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [meters, setMeters] = useState<UserMeter[]>([])
  const [isLoadingMeters, setIsLoadingMeters] = useState(true)
  const [isDragActive, setIsDragActive] = useState(false)
  const [fileName, setFileName] = useState("")
  const [readings, setReadings] = useState<ParsedReadingInput[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadMeters() {
      setIsLoadingMeters(true)
      try {
        const loadedMeters = await getUserMeters()
        if (mounted) {
          setMeters(loadedMeters)
        }
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

  const parserMeters = useMemo(
    () => meters.map((meter) => ({ id: meter.id, name: meter.name, unit: meter.unit })),
    [meters]
  )

  async function handleFile(file: File) {
    if (file.size > MAX_EXCEL_FILE_SIZE) {
      toast.error("파일 크기는 10MB 이하여야 합니다.")
      return
    }
    if (parserMeters.length === 0) {
      toast.error("등록된 계측기가 없어 업로드할 수 없습니다.")
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const parseResult = parseExcelFile(buffer, parserMeters)
      const preview = buildPreviewRows(buffer, parseResult.errors)

      setFileName(file.name)
      setReadings(parseResult.readings)
      setErrors(parseResult.errors)
      setPreviewRows(preview)

      if (parseResult.readings.length > 0) {
        toast.success(`저장 가능한 데이터 ${parseResult.readings.length}건을 확인했습니다.`)
      }
      if (parseResult.errors.length > 0) {
        toast.warning(`오류가 있는 행 ${parseResult.errors.length}건이 있습니다.`)
      }
      if (parseResult.readings.length === 0 && parseResult.errors.length === 0) {
        toast.error("업로드할 데이터 행을 찾지 못했습니다.")
      }
    } catch {
      setReadings([])
      setErrors([])
      setPreviewRows([])
      toast.error("엑셀 파일 파싱에 실패했습니다.")
    }
  }

  function handleSelectClick() {
    if (isLoadingMeters) {
      return
    }
    inputRef.current?.click()
  }

  async function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      await handleFile(selectedFile)
    }
    event.target.value = ""
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      await handleFile(droppedFile)
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
  }

  async function handleSave() {
    if (readings.length === 0) {
      toast.error("저장할 데이터가 없습니다.")
      return
    }

    setIsSaving(true)
    try {
      const result = await createBulkReadings(readings)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(`${result.count ?? readings.length}건의 데이터가 저장되었습니다.`)
    } catch {
      toast.error("데이터 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTemplateDownload() {
    setIsDownloadingTemplate(true)
    try {
      const buffer = generateTemplate(parserMeters)
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = "energy-data-template.xlsx"
      link.click()
      URL.revokeObjectURL(downloadUrl)
    } catch {
      toast.error("템플릿 생성에 실패했습니다.")
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">에너지 데이터 입력</h1>
        <p className="text-muted-foreground text-sm">
          엑셀 파일을 업로드해 계측기 데이터를 한 번에 등록할 수 있습니다.
        </p>
        <div className="inline-flex rounded-lg border p-1">
          <Link
            href="/data"
            className="text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            수동 입력
          </Link>
          <span className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
            엑셀 업로드
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>파일 업로드</CardTitle>
            <CardDescription>
              최대 {MAX_EXCEL_FILE_SIZE / 1024 / 1024}MB 파일까지 업로드할 수 있습니다.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleTemplateDownload}
            disabled={isDownloadingTemplate || isLoadingMeters}
          >
            <DownloadIcon className="size-4" />
            템플릿 다운로드
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInputChange}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={handleSelectClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                handleSelectClick()
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "border-muted-foreground/30 hover:border-primary hover:bg-muted/30 flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              isDragActive && "border-primary bg-primary/5",
              isLoadingMeters && "cursor-not-allowed opacity-60"
            )}
            aria-disabled={isLoadingMeters}
          >
            <UploadIcon className="text-muted-foreground size-7" />
            <div className="space-y-1">
              <p className="font-medium">파일을 드래그하거나 클릭해서 업로드하세요</p>
              <p className="text-muted-foreground text-sm">
                지원 형식: .xlsx, .xls / 최대 10MB
              </p>
            </div>
          </div>
          {fileName && (
            <p className="text-sm">
              업로드 파일: <span className="font-medium">{fileName}</span>
            </p>
          )}
          {meters.length === 0 && !isLoadingMeters && (
            <p className="text-destructive text-sm">
              등록된 계측기가 없어 업로드를 진행할 수 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {(previewRows.length > 0 || errors.length > 0) && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>파싱 결과 미리보기</CardTitle>
              <CardDescription>
                오류가 있는 행은 빨간색으로 표시되며 저장 대상에서 제외됩니다.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">저장 가능 {readings.length}건</Badge>
              <Badge variant={errors.length > 0 ? "destructive" : "secondary"}>
                오류 {errors.length}건
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">행</TableHead>
                    <TableHead>계측기명/ID</TableHead>
                    <TableHead>측정일시</TableHead>
                    <TableHead>사용량</TableHead>
                    <TableHead className="w-44">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow
                      key={row.rowNumber}
                      className={cn(row.errorMessage && "bg-destructive/10 hover:bg-destructive/15")}
                    >
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.meter || "-"}</TableCell>
                      <TableCell>{row.timestamp || "-"}</TableCell>
                      <TableCell>{row.value || "-"}</TableCell>
                      <TableCell>
                        {row.errorMessage ? (
                          <span className="text-destructive text-sm">{row.errorMessage}</span>
                        ) : (
                          <Badge variant="secondary">정상</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || readings.length === 0}
            >
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
