"use server"

import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subYears,
} from "date-fns"
import { createClient } from "@/lib/supabase/server"
import type { EnergyType } from "@/types/database"

interface DashboardSummary {
  totalSites: number
  totalMeters: number
  todayUsage: { electricity: number; gas: number; water: number }
  monthUsage: { electricity: number; gas: number; water: number }
  recentAlerts: number
}

interface DailyUsage {
  date: string
  electricity: number
  gas: number
  water: number
}

export interface YearOverYearData {
  currentMonth: { electricity: number; gas: number; water: number }
  previousYearMonth: { electricity: number; gas: number; water: number }
  changePercent: { electricity: number; gas: number; water: number }
}

type UsageByEnergy = {
  electricity: number
  gas: number
  water: number
}

type MeterSummaryRow = {
  id: string
  energy_type: EnergyType
}

type ReadingRow = {
  meter_id: string
  timestamp: string
  value: number | string | null
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function getEmptyUsage(): UsageByEnergy {
  return { electricity: 0, gas: 0, water: 0 }
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? 0 : parsed
}

async function getUsageSum(
  supabase: SupabaseClient,
  meterIds: string[],
  fromIso: string,
  toIso: string
): Promise<number> {
  if (meterIds.length === 0) {
    return 0
  }

  const { data, error } = await supabase
    .from("energy_readings")
    .select("value.sum()")
    .in("meter_id", meterIds)
    .gte("timestamp", fromIso)
    .lte("timestamp", toIso)

  if (error) {
    return 0
  }

  const rows = data as Array<{ sum: number | string | null }> | null

  return toNumber(rows?.[0]?.sum)
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const monthStart = startOfMonth(now).toISOString()
  const nowIso = now.toISOString()

  const [
    totalSitesResult,
    totalMetersResult,
    recentAlertsResult,
    meterSummaryResult,
  ] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }),
    supabase.from("meters").select("id", { count: "exact", head: true }),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .in("status", ["triggered", "acknowledged"]),
    supabase.from("meters").select("id, energy_type"),
  ])

  const meterRows = (meterSummaryResult.data ?? []) as MeterSummaryRow[]

  const meterIdsByEnergy: Record<EnergyType, string[]> = {
    electricity: [],
    gas: [],
    water: [],
  }

  meterRows.forEach((meter) => {
    meterIdsByEnergy[meter.energy_type].push(meter.id)
  })

  const [
    todayElectricity,
    todayGas,
    todayWater,
    monthElectricity,
    monthGas,
    monthWater,
  ] = await Promise.all([
    getUsageSum(supabase, meterIdsByEnergy.electricity, todayStart, nowIso),
    getUsageSum(supabase, meterIdsByEnergy.gas, todayStart, nowIso),
    getUsageSum(supabase, meterIdsByEnergy.water, todayStart, nowIso),
    getUsageSum(supabase, meterIdsByEnergy.electricity, monthStart, nowIso),
    getUsageSum(supabase, meterIdsByEnergy.gas, monthStart, nowIso),
    getUsageSum(supabase, meterIdsByEnergy.water, monthStart, nowIso),
  ])

  return {
    totalSites: totalSitesResult.error ? 0 : totalSitesResult.count ?? 0,
    totalMeters: totalMetersResult.error ? 0 : totalMetersResult.count ?? 0,
    todayUsage: {
      electricity: todayElectricity,
      gas: todayGas,
      water: todayWater,
    },
    monthUsage: {
      electricity: monthElectricity,
      gas: monthGas,
      water: monthWater,
    },
    recentAlerts: recentAlertsResult.error ? 0 : recentAlertsResult.count ?? 0,
  }
}

export async function getDailyUsage(
  siteId?: string,
  days = 30
): Promise<DailyUsage[]> {
  const safeDays = Math.max(1, Math.floor(days))
  const endDate = new Date()
  const startDate = startOfDay(subDays(endDate, safeDays - 1))
  const endExclusiveDate = addDays(startOfDay(endDate), 1)
  const supabase = await createClient()

  const usageByDate = new Map<string, DailyUsage>()

  Array.from({ length: safeDays }, (_, index) => addDays(startDate, index)).forEach(
    (date) => {
      const key = format(date, "yyyy-MM-dd")
      usageByDate.set(key, { date: key, ...getEmptyUsage() })
    }
  )

  let metersQuery = supabase.from("meters").select("id, energy_type")

  if (siteId) {
    metersQuery = metersQuery.eq("site_id", siteId)
  }

  const { data: meterData, error: meterError } = await metersQuery

  if (meterError || !meterData?.length) {
    return Array.from(usageByDate.values())
  }

  const meters = meterData as MeterSummaryRow[]
  const meterIds = meters.map((meter) => meter.id)
  const meterTypeById = new Map<string, EnergyType>()

  meters.forEach((meter) => {
    meterTypeById.set(meter.id, meter.energy_type)
  })

  const { data: readingData, error: readingError } = await supabase
    .from("energy_readings")
    .select("meter_id, timestamp, value")
    .in("meter_id", meterIds)
    .gte("timestamp", startDate.toISOString())
    .lt("timestamp", endExclusiveDate.toISOString())

  if (readingError || !readingData?.length) {
    return Array.from(usageByDate.values())
  }

  ;(readingData as ReadingRow[]).forEach((reading) => {
    const energyType = meterTypeById.get(reading.meter_id)

    if (!energyType) {
      return
    }

    const dateKey = format(new Date(reading.timestamp), "yyyy-MM-dd")
    const usage = usageByDate.get(dateKey)

    if (!usage) {
      return
    }

    usage[energyType] += toNumber(reading.value)
  })

  return Array.from(usageByDate.values())
}

export async function getYearOverYearUsage(
  siteId?: string
): Promise<YearOverYearData> {
  const supabase = await createClient()
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const elapsedDays = differenceInCalendarDays(now, currentMonthStart)
  const previousYearMonthStart = subYears(currentMonthStart, 1)
  const previousYearMonthEnd = addDays(previousYearMonthStart, elapsedDays)

  previousYearMonthEnd.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  )

  let metersQuery = supabase.from("meters").select("id, energy_type")

  if (siteId) {
    metersQuery = metersQuery.eq("site_id", siteId)
  }

  const { data: meterData, error: meterError } = await metersQuery

  if (meterError || !meterData?.length) {
    return {
      currentMonth: getEmptyUsage(),
      previousYearMonth: getEmptyUsage(),
      changePercent: getEmptyUsage(),
    }
  }

  const meters = meterData as MeterSummaryRow[]
  const meterIdsByEnergy: Record<EnergyType, string[]> = {
    electricity: [],
    gas: [],
    water: [],
  }

  meters.forEach((meter) => {
    meterIdsByEnergy[meter.energy_type].push(meter.id)
  })

  const [
    currentElectricity,
    currentGas,
    currentWater,
    previousElectricity,
    previousGas,
    previousWater,
  ] = await Promise.all([
    getUsageSum(
      supabase,
      meterIdsByEnergy.electricity,
      currentMonthStart.toISOString(),
      now.toISOString()
    ),
    getUsageSum(
      supabase,
      meterIdsByEnergy.gas,
      currentMonthStart.toISOString(),
      now.toISOString()
    ),
    getUsageSum(
      supabase,
      meterIdsByEnergy.water,
      currentMonthStart.toISOString(),
      now.toISOString()
    ),
    getUsageSum(
      supabase,
      meterIdsByEnergy.electricity,
      previousYearMonthStart.toISOString(),
      previousYearMonthEnd.toISOString()
    ),
    getUsageSum(
      supabase,
      meterIdsByEnergy.gas,
      previousYearMonthStart.toISOString(),
      previousYearMonthEnd.toISOString()
    ),
    getUsageSum(
      supabase,
      meterIdsByEnergy.water,
      previousYearMonthStart.toISOString(),
      previousYearMonthEnd.toISOString()
    ),
  ])

  const currentMonth = {
    electricity: currentElectricity,
    gas: currentGas,
    water: currentWater,
  }

  const previousYearMonth = {
    electricity: previousElectricity,
    gas: previousGas,
    water: previousWater,
  }

  const calculateChangePercent = (current: number, previous: number): number => {
    if (previous === 0) {
      return current > 0 ? 100 : 0
    }

    return ((current - previous) / previous) * 100
  }

  return {
    currentMonth,
    previousYearMonth,
    changePercent: {
      electricity: calculateChangePercent(
        currentMonth.electricity,
        previousYearMonth.electricity
      ),
      gas: calculateChangePercent(currentMonth.gas, previousYearMonth.gas),
      water: calculateChangePercent(currentMonth.water, previousYearMonth.water),
    },
  }
}
