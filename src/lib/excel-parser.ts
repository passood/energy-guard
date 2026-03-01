import * as XLSX from "xlsx"

interface ParsedReading {
  meter_id: string
  timestamp: string
  value: number
  unit: string
}

interface ParseResult {
  readings: ParsedReading[]
  errors: string[]
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/ /g, "")
    .toLowerCase()
}

function isEmptyCell(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }
  if (typeof value === "string") {
    return value.trim().length === 0
  }
  return false
}

function parseTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null
    }
    return value.toISOString()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) {
      return null
    }

    const seconds = Math.floor(parsed.S)
    const milliseconds = Math.round((parsed.S - seconds) * 1000)
    const date = new Date(
      Date.UTC(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H,
        parsed.M,
        seconds,
        milliseconds
      )
    )

    if (Number.isNaN(date.getTime())) {
      return null
    }
    return date.toISOString()
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return null
    }
    const date = new Date(trimmedValue)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    return date.toISOString()
  }

  return null
}

function parseUsage(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null
    }
    return value
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim()
    if (!normalized) {
      return null
    }
    const numericValue = Number(normalized)
    if (!Number.isFinite(numericValue)) {
      return null
    }
    return numericValue
  }

  return null
}

function findColumnIndex(
  headers: string[],
  candidates: string[],
  fallbackIndex: number
): number {
  const index = headers.findIndex((header) => candidates.includes(header))
  if (index < 0) {
    return fallbackIndex
  }
  return index
}

export function parseExcelFile(
  buffer: ArrayBuffer,
  meters: Array<{ id: string; name: string; unit: string }>
): ParseResult {
  const errors: string[] = []
  const readings: ParsedReading[] = []

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  if (workbook.SheetNames.length === 0) {
    return { readings, errors: ["엑셀 시트를 찾을 수 없습니다."] }
  }

  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) {
    return { readings, errors: ["엑셀 시트를 찾을 수 없습니다."] }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  })

  if (rows.length === 0) {
    return { readings, errors: ["엑셀 데이터가 비어 있습니다."] }
  }

  const meterMap = new Map<string, { id: string; unit: string }>()
  for (const meter of meters) {
    const nameKey = meter.name.trim().toLowerCase()
    if (nameKey && !meterMap.has(nameKey)) {
      meterMap.set(nameKey, { id: meter.id, unit: meter.unit })
    }

    const idKey = meter.id.trim().toLowerCase()
    if (idKey && !meterMap.has(idKey)) {
      meterMap.set(idKey, { id: meter.id, unit: meter.unit })
    }
  }

  const headerRow = rows[0] ?? []
  const normalizedHeaders = headerRow.map((headerCell) =>
    normalizeHeader(headerCell)
  )

  const meterColumnIndex = findColumnIndex(
    normalizedHeaders,
    ["계측기명", "계측기id", "계측기", "meter", "meterid", "meter_id"],
    0
  )
  const timestampColumnIndex = findColumnIndex(
    normalizedHeaders,
    ["측정일시", "측정시간", "timestamp", "datetime", "date"],
    1
  )
  const usageColumnIndex = findColumnIndex(
    normalizedHeaders,
    ["사용량", "value", "usage"],
    2
  )

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const excelRowNumber = rowIndex + 1

    const meterCell = row[meterColumnIndex]
    const timestampCell = row[timestampColumnIndex]
    const usageCell = row[usageColumnIndex]

    if (
      isEmptyCell(meterCell) &&
      isEmptyCell(timestampCell) &&
      isEmptyCell(usageCell)
    ) {
      continue
    }

    const meterKey = String(meterCell ?? "").trim().toLowerCase()
    if (!meterKey) {
      errors.push(`${excelRowNumber}행: 계측기명이 비어 있습니다`)
      continue
    }

    const mappedMeter = meterMap.get(meterKey)
    if (!mappedMeter) {
      errors.push(`${excelRowNumber}행: 계측기명을 찾을 수 없습니다`)
      continue
    }

    const timestamp = parseTimestamp(timestampCell)
    if (!timestamp) {
      errors.push(`${excelRowNumber}행: 측정일시 형식이 올바르지 않습니다`)
      continue
    }

    const value = parseUsage(usageCell)
    if (value === null) {
      errors.push(`${excelRowNumber}행: 사용량이 숫자가 아닙니다`)
      continue
    }
    if (value <= 0) {
      errors.push(`${excelRowNumber}행: 사용량은 0보다 커야 합니다`)
      continue
    }

    readings.push({
      meter_id: mappedMeter.id,
      timestamp,
      value,
      unit: mappedMeter.unit,
    })
  }

  return { readings, errors }
}

export function generateTemplate(
  meters: Array<{ id: string; name: string; unit: string }>
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  const templateSheet = XLSX.utils.aoa_to_sheet([["계측기명", "측정일시", "사용량"]])
  const meterListSheet = XLSX.utils.aoa_to_sheet([
    ["계측기명", "계측기 ID", "단위"],
    ...meters.map((meter) => [meter.name, meter.id, meter.unit]),
  ])

  templateSheet["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 16 }]
  meterListSheet["!cols"] = [{ wch: 24 }, { wch: 40 }, { wch: 12 }]

  XLSX.utils.book_append_sheet(workbook, templateSheet, "입력템플릿")
  XLSX.utils.book_append_sheet(workbook, meterListSheet, "계측기목록")

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
}
