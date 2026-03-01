"use server"

import { startOfMonth, startOfQuarter, startOfYear } from "date-fns"
import { createClient } from "@/lib/supabase/server"
import type { EnergyType } from "@/types/database"

interface SiteEfficiency {
  siteId: string
  siteName: string
  areaSqm: number
  electricity: { total: number; perSqm: number }
  gas: { total: number; perSqm: number }
  water: { total: number; perSqm: number }
}

type Period = "month" | "quarter" | "year"

type SiteRow = {
  id: string
  name: string
  area_sqm: number | null
}

type MeterRow = {
  id: string
  site_id: string
  energy_type: EnergyType
}

type ReadingRow = {
  meter_id: string
  value: number | string | null
}

type UsageByEnergy = {
  electricity: number
  gas: number
  water: number
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? 0 : parsed
}

function getPeriodStart(period: Period, now: Date): Date {
  if (period === "quarter") {
    return startOfQuarter(now)
  }

  if (period === "year") {
    return startOfYear(now)
  }

  return startOfMonth(now)
}

function getPerSqm(total: number, areaSqm: number): number {
  if (areaSqm <= 0) {
    return 0
  }

  return Number((total / areaSqm).toFixed(2))
}

function getEmptyUsage(): UsageByEnergy {
  return { electricity: 0, gas: 0, water: 0 }
}

export async function getSiteComparison(
  period: "month" | "quarter" | "year"
): Promise<SiteEfficiency[]> {
  const supabase = await createClient()
  const now = new Date()
  const periodStart = getPeriodStart(period, now)

  const { data: siteData, error: siteError } = await supabase
    .from("sites")
    .select("id, name, area_sqm")
    .not("area_sqm", "is", null)
    .order("name")

  if (siteError || !siteData?.length) {
    return []
  }

  const sites = (siteData as SiteRow[]).map((site) => ({
    siteId: site.id,
    siteName: site.name,
    areaSqm: toNumber(site.area_sqm),
  }))

  const siteIds = sites.map((site) => site.siteId)

  const { data: meterData, error: meterError } = await supabase
    .from("meters")
    .select("id, site_id, energy_type")
    .in("site_id", siteIds)

  const usageBySite = new Map<string, UsageByEnergy>()

  sites.forEach((site) => {
    usageBySite.set(site.siteId, getEmptyUsage())
  })

  if (!meterError && meterData?.length) {
    const meters = meterData as MeterRow[]
    const meterById = new Map<string, MeterRow>()
    const meterIds: string[] = []

    meters.forEach((meter) => {
      meterById.set(meter.id, meter)
      meterIds.push(meter.id)
    })

    if (meterIds.length > 0) {
      const { data: readingData, error: readingError } = await supabase
        .from("energy_readings")
        .select("meter_id, value")
        .in("meter_id", meterIds)
        .gte("timestamp", periodStart.toISOString())
        .lte("timestamp", now.toISOString())

      if (!readingError && readingData?.length) {
        ;(readingData as ReadingRow[]).forEach((reading) => {
          const meter = meterById.get(reading.meter_id)

          if (!meter) {
            return
          }

          const usage = usageBySite.get(meter.site_id)

          if (!usage) {
            return
          }

          usage[meter.energy_type] += toNumber(reading.value)
        })
      }
    }
  }

  return sites.map((site) => {
    const usage = usageBySite.get(site.siteId) ?? getEmptyUsage()
    const electricityTotal = usage.electricity
    const gasTotal = usage.gas
    const waterTotal = usage.water

    return {
      siteId: site.siteId,
      siteName: site.siteName,
      areaSqm: site.areaSqm,
      electricity: {
        total: electricityTotal,
        perSqm: getPerSqm(electricityTotal, site.areaSqm),
      },
      gas: {
        total: gasTotal,
        perSqm: getPerSqm(gasTotal, site.areaSqm),
      },
      water: {
        total: waterTotal,
        perSqm: getPerSqm(waterTotal, site.areaSqm),
      },
    }
  })
}
