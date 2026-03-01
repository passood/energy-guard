"use server"

import { revalidatePath } from "next/cache"
import { checkAlertRules } from "@/lib/alert-checker"
import { createClient } from "@/lib/supabase/server"
import type { EnergyReading, Meter, MeasurementUnit } from "@/types/database"

type MeterUnitRow = {
  id: string
  unit: MeasurementUnit
}

type MeterWithSiteRow = Meter & {
  sites: { name: string } | Array<{ name: string }> | null
}

export async function createReading(
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  const meterId = formData.get("meter_id")?.toString().trim() ?? ""
  const timestampValue = formData.get("timestamp")?.toString().trim() ?? ""
  const valueRaw = formData.get("value")?.toString().trim() ?? ""

  if (!meterId) {
    return { error: "계측기를 선택해 주세요." }
  }
  if (!timestampValue) {
    return { error: "측정일시를 입력해 주세요." }
  }
  if (!valueRaw) {
    return { error: "사용량을 입력해 주세요." }
  }

  const value = Number(valueRaw)
  if (!Number.isFinite(value)) {
    return { error: "사용량은 숫자로 입력해 주세요." }
  }
  if (value <= 0) {
    return { error: "사용량은 0보다 커야 합니다." }
  }

  const timestamp = new Date(timestampValue)
  if (Number.isNaN(timestamp.getTime())) {
    return { error: "측정일시 형식이 올바르지 않습니다." }
  }

  const { data: meter, error: meterError } = await supabase
    .from("meters")
    .select("unit")
    .eq("id", meterId)
    .single()

  const meterRow = meter as { unit: MeasurementUnit } | null
  if (meterError || !meterRow) {
    return { error: "계측기 정보를 확인할 수 없습니다." }
  }

  const { error } = await supabase.from("energy_readings").insert(
    {
      meter_id: meterId,
      timestamp: timestamp.toISOString(),
      value,
      unit: meterRow.unit,
      source: "manual",
    } as never
  )

  if (error) {
    return { error: "데이터 저장에 실패했습니다." }
  }

  void checkAlertRules([meterId]).catch(() => {})
  revalidatePath("/data")
  return {}
}

export async function createBulkReadings(
  readings: Array<{
    meter_id: string
    timestamp: string
    value: number
    unit: string
  }>
): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  if (readings.length === 0) {
    return { error: "저장할 데이터가 없습니다." }
  }

  const meterIds = Array.from(
    new Set(
      readings
        .map((reading) => reading.meter_id.trim())
        .filter((meterId) => meterId.length > 0)
    )
  )

  if (meterIds.length === 0) {
    return { error: "유효한 계측기 정보가 없습니다." }
  }

  const { data: meterRows, error: meterError } = await supabase
    .from("meters")
    .select("id, unit")
    .in("id", meterIds)

  if (meterError || !meterRows) {
    return { error: "계측기 정보를 불러오지 못했습니다." }
  }

  const meterUnitMap = new Map<string, MeasurementUnit>()
  for (const meterRow of meterRows as MeterUnitRow[]) {
    meterUnitMap.set(meterRow.id, meterRow.unit)
  }

  const payload: Array<{
    meter_id: string
    timestamp: string
    value: number
    unit: MeasurementUnit
    source: "excel_upload"
  }> = []

  for (let index = 0; index < readings.length; index += 1) {
    const reading = readings[index]
    const meterId = reading.meter_id.trim()

    if (!meterId) {
      return { error: `${index + 1}번째 데이터의 계측기 ID가 비어 있습니다.` }
    }

    const unit = meterUnitMap.get(meterId)
    if (!unit) {
      return { error: `${index + 1}번째 데이터의 계측기를 찾을 수 없습니다.` }
    }

    if (!Number.isFinite(reading.value)) {
      return {
        error: `${index + 1}번째 데이터의 사용량은 숫자로 입력해 주세요.`,
      }
    }
    if (reading.value <= 0) {
      return {
        error: `${index + 1}번째 데이터의 사용량은 0보다 커야 합니다.`,
      }
    }

    const timestamp = new Date(reading.timestamp)
    if (Number.isNaN(timestamp.getTime())) {
      return {
        error: `${index + 1}번째 데이터의 측정일시 형식이 올바르지 않습니다.`,
      }
    }

    payload.push({
      meter_id: meterId,
      timestamp: timestamp.toISOString(),
      value: reading.value,
      unit,
      source: "excel_upload",
    })
  }

  const { error } = await supabase
    .from("energy_readings")
    .insert(payload as never)
  if (error) {
    return { error: "엑셀 데이터 저장에 실패했습니다." }
  }

  void checkAlertRules(meterIds).catch(() => {})
  revalidatePath("/data")
  return { count: payload.length }
}

export async function getReadings(
  meterId: string,
  startDate?: string,
  endDate?: string
): Promise<EnergyReading[]> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user || !meterId.trim()) {
    return []
  }

  let normalizedStart = startDate?.trim() ? new Date(startDate) : undefined
  let normalizedEnd = endDate?.trim() ? new Date(endDate) : undefined

  if (normalizedStart && Number.isNaN(normalizedStart.getTime())) {
    return []
  }
  if (normalizedEnd && Number.isNaN(normalizedEnd.getTime())) {
    return []
  }

  if (
    normalizedStart &&
    normalizedEnd &&
    normalizedStart.getTime() > normalizedEnd.getTime()
  ) {
    const swapped = normalizedStart
    normalizedStart = normalizedEnd
    normalizedEnd = swapped
  }

  let query = supabase
    .from("energy_readings")
    .select("*")
    .eq("meter_id", meterId)
    .order("timestamp", { ascending: false })

  if (normalizedStart) {
    query = query.gte("timestamp", normalizedStart.toISOString())
  }
  if (normalizedEnd) {
    query = query.lte("timestamp", normalizedEnd.toISOString())
  }

  const { data, error } = await query
  if (error || !data) {
    return []
  }

  return data as EnergyReading[]
}

export async function getUserMeters(): Promise<(Meter & { site_name: string })[]> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return []
  }

  const { data, error } = await supabase
    .from("meters")
    .select(
      "id, site_id, name, energy_type, unit, location, is_active, created_at, sites!inner(name)"
    )
    .order("name", { ascending: true })

  if (error || !data) {
    return []
  }

  return (data as unknown as MeterWithSiteRow[]).map((meterRow) => {
    const site = Array.isArray(meterRow.sites) ? meterRow.sites[0] : meterRow.sites
    return {
      id: meterRow.id,
      site_id: meterRow.site_id,
      name: meterRow.name,
      energy_type: meterRow.energy_type,
      unit: meterRow.unit,
      location: meterRow.location,
      is_active: meterRow.is_active,
      created_at: meterRow.created_at,
      site_name: site?.name ?? "사업장",
    }
  })
}
