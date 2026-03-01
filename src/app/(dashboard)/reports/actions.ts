"use server"

import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns"
import { createClient } from "@/lib/supabase/server"
import type { EnergyType } from "@/types/database"

interface ReportData {
  site: { name: string; address: string; areaSqm: number | null }
  period: { start: string; end: string }
  usage: { electricity: number; gas: number; water: number }
  dailyBreakdown: Array<{ date: string; electricity: number; gas: number; water: number }>
  costs: { electricity: number; gas: number; water: number } | null
}

type UsageSummary = {
  electricity: number
  gas: number
  water: number
}

type SiteRow = {
  name: string
  address: string
  area_sqm: number | string | null
}

type MeterRow = {
  id: string
  energy_type: EnergyType
}

type ReadingRow = {
  meter_id: string
  timestamp: string
  value: number | string | null
}

type CostRow = {
  energy_type: EnergyType
  cost_krw: number | string | null
}

function getEmptyUsage(): UsageSummary {
  return { electricity: 0, gas: 0, water: 0 }
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

export async function getReportData(
  siteId: string,
  year: number,
  month: number
): Promise<{ data: ReportData | null; error?: string }> {
  if (!siteId.trim()) {
    return { data: null, error: "사업장 정보가 올바르지 않습니다." }
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { data: null, error: "조회 기간이 올바르지 않습니다." }
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
    .select("name, address, area_sqm")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (siteError) {
    return { data: null, error: "사업장 정보를 조회하지 못했습니다." }
  }

  if (!siteData) {
    return { data: null, error: "사업장을 찾을 수 없습니다." }
  }

  const periodStartDate = startOfMonth(new Date(year, month - 1, 1))
  const periodEndDate = endOfMonth(periodStartDate)
  const periodStart = format(periodStartDate, "yyyy-MM-dd")
  const periodEnd = format(periodEndDate, "yyyy-MM-dd")

  const usage = getEmptyUsage()
  const dailyByDate = new Map<string, { date: string; electricity: number; gas: number; water: number }>()

  eachDayOfInterval({ start: periodStartDate, end: periodEndDate }).forEach((date) => {
    const key = format(date, "yyyy-MM-dd")
    dailyByDate.set(key, { date: key, ...getEmptyUsage() })
  })

  const { data: meterData, error: meterError } = await supabase
    .from("meters")
    .select("id, energy_type")
    .eq("site_id", siteId)

  if (meterError) {
    return { data: null, error: "계측기 정보를 조회하지 못했습니다." }
  }

  const meters = (meterData ?? []) as MeterRow[]
  const meterIds = meters.map((meter) => meter.id)

  if (meterIds.length > 0) {
    const meterTypeById = new Map<string, EnergyType>()
    meters.forEach((meter) => {
      meterTypeById.set(meter.id, meter.energy_type)
    })

    const { data: readingData, error: readingError } = await supabase
      .from("energy_readings")
      .select("meter_id, timestamp, value")
      .in("meter_id", meterIds)
      .gte("timestamp", periodStartDate.toISOString())
      .lt("timestamp", addMonths(periodStartDate, 1).toISOString())

    if (readingError) {
      return { data: null, error: "사용량 데이터를 조회하지 못했습니다." }
    }

    ;(readingData as ReadingRow[] | null)?.forEach((reading) => {
      const energyType = meterTypeById.get(reading.meter_id)
      if (!energyType) {
        return
      }

      const dateKey = format(new Date(reading.timestamp), "yyyy-MM-dd")
      const daily = dailyByDate.get(dateKey)
      if (!daily) {
        return
      }

      const value = toNumber(reading.value)
      daily[energyType] += value
      usage[energyType] += value
    })
  }

  const { data: costData, error: costError } = await supabase
    .from("energy_costs")
    .select("energy_type, cost_krw")
    .eq("site_id", siteId)
    .lte("period_start", periodEnd)
    .gte("period_end", periodStart)

  if (costError) {
    return { data: null, error: "비용 데이터를 조회하지 못했습니다." }
  }

  let costs: { electricity: number; gas: number; water: number } | null = null

  if ((costData?.length ?? 0) > 0) {
    const costTotals = getEmptyUsage()

    ;(costData as CostRow[]).forEach((costRow) => {
      costTotals[costRow.energy_type] += toNumber(costRow.cost_krw)
    })

    costs = costTotals
  }

  const siteRow = siteData as SiteRow

  return {
    data: {
      site: {
        name: siteRow.name,
        address: siteRow.address,
        areaSqm: toNullableNumber(siteRow.area_sqm),
      },
      period: {
        start: periodStart,
        end: periodEnd,
      },
      usage,
      dailyBreakdown: Array.from(dailyByDate.values()),
      costs,
    },
  }
}

