"use server"

import { createClient } from "@/lib/supabase/server"
import type { EnergyType } from "@/types/database"

interface RegulationSiteData {
  site: {
    name: string
    address: string
    area_sqm: number | null
    building_type: string
    toe_annual: number | null
  }
  meters: Array<{ name: string; energy_type: EnergyType; unit: string }>
  readings: Array<{ timestamp: string; value: number; unit: string; energy_type: EnergyType }>
}

type SiteRow = {
  name: string
  address: string
  area_sqm: number | string | null
  building_type: string
  toe_annual: number | string | null
}

type MeterRow = {
  id: string
  name: string
  energy_type: EnergyType
  unit: string
}

type ReadingRow = {
  meter_id: string
  timestamp: string
  value: number | string | null
  unit: string
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export async function getRegulationData(
  siteId: string,
  year: number,
): Promise<{ data: RegulationSiteData | null; error?: string }> {
  if (!siteId.trim()) {
    return { data: null, error: "사업장 정보가 올바르지 않습니다." }
  }

  if (!Number.isInteger(year)) {
    return { data: null, error: "연도 정보가 올바르지 않습니다." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: null, error: "로그인이 필요합니다." }
  }

  const { data: siteData, error: siteError } = await supabase
    .from("sites")
    .select("name, address, area_sqm, building_type, toe_annual")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (siteError) {
    return { data: null, error: "사업장 정보를 조회하지 못했습니다." }
  }

  if (!siteData) {
    return { data: null, error: "사업장을 찾을 수 없습니다." }
  }

  const { data: meterData, error: meterError } = await supabase
    .from("meters")
    .select("id, name, energy_type, unit")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true })

  if (meterError) {
    return { data: null, error: "계측기 정보를 조회하지 못했습니다." }
  }

  const typedMeters = (meterData ?? []) as MeterRow[]
  const meterTypeById = new Map<string, EnergyType>()
  const meterIds = typedMeters.map((meter) => meter.id)

  typedMeters.forEach((meter) => {
    meterTypeById.set(meter.id, meter.energy_type)
  })

  const yearStart = `${year}-01-01T00:00:00.000Z`
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`
  let readingRows: ReadingRow[] = []

  if (meterIds.length > 0) {
    const { data: readingData, error: readingError } = await supabase
      .from("energy_readings")
      .select("meter_id, timestamp, value, unit")
      .in("meter_id", meterIds)
      .gte("timestamp", yearStart)
      .lt("timestamp", yearEnd)
      .order("timestamp", { ascending: true })

    if (readingError) {
      return { data: null, error: "사용량 데이터를 조회하지 못했습니다." }
    }

    readingRows = (readingData ?? []) as ReadingRow[]
  }

  const readings = readingRows
    .map((reading) => {
      const energyType = meterTypeById.get(reading.meter_id)
      if (!energyType) {
        return null
      }

      return {
        timestamp: reading.timestamp,
        value: toNumber(reading.value),
        unit: reading.unit,
        energy_type: energyType,
      }
    })
    .filter(
      (
        reading,
      ): reading is {
        timestamp: string
        value: number
        unit: string
        energy_type: EnergyType
      } => reading !== null,
    )

  const siteRow = siteData as SiteRow

  return {
    data: {
      site: {
        name: siteRow.name,
        address: siteRow.address,
        area_sqm: toNullableNumber(siteRow.area_sqm),
        building_type: siteRow.building_type,
        toe_annual: toNullableNumber(siteRow.toe_annual),
      },
      meters: typedMeters.map((meter) => ({
        name: meter.name,
        energy_type: meter.energy_type,
        unit: meter.unit,
      })),
      readings,
    },
  }
}

export async function getSitesForRegulation(): Promise<{
  data: Array<{ id: string; name: string }>
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: [], error: "로그인이 필요합니다." }
  }

  const { data, error } = await supabase
    .from("sites")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  if (error) {
    return { data: [], error: "사업장 목록을 조회하지 못했습니다." }
  }

  return { data: (data ?? []).map((site) => ({ id: site.id, name: site.name })) }
}
