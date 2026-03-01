import { getMonth, getYear } from "date-fns"
import { ENERGY_TYPES } from "@/lib/constants"
import type { Site, Meter, EnergyReading, EnergyType } from "@/types/database"

interface SiteEnergyData {
  site: Pick<Site, "name" | "address" | "area_sqm" | "building_type" | "toe_annual">
  meters: Array<Pick<Meter, "name" | "energy_type" | "unit">>
  readings: Array<Pick<EnergyReading, "timestamp" | "value" | "unit"> & { energy_type: EnergyType }>
}

interface EnergyUseReportRow {
  siteName: string
  address: string
  areaSqm: number | null
  buildingType: string
  energyType: string
  annualUsage: number
  unit: string
  toeConversion: number
}

interface EgTipsExportRow {
  facilityName: string
  facilityAddress: string
  meterName: string
  energySource: string
  year: number
  month: number
  usage: number
  unit: string
}

const ENERGY_TYPE_ORDER: EnergyType[] = ["electricity", "gas", "water"]

const TOE_CONVERSION_FACTORS: Record<EnergyType, number> = {
  electricity: 0.000215,
  gas: 0.00105,
  water: 0.0000342,
}

function getReadingsByYear(
  readings: Array<Pick<EnergyReading, "timestamp" | "value" | "unit"> & { energy_type: EnergyType }>,
  year: number,
): Array<Pick<EnergyReading, "timestamp" | "value" | "unit"> & { energy_type: EnergyType }> {
  return readings.filter((reading) => getYear(new Date(reading.timestamp)) === year)
}

function getIncludedEnergyTypes(
  data: SiteEnergyData,
  yearlyReadings: Array<Pick<EnergyReading, "timestamp" | "value" | "unit"> & { energy_type: EnergyType }>,
): EnergyType[] {
  const energyTypes = new Set<EnergyType>()

  for (const meter of data.meters) {
    energyTypes.add(meter.energy_type)
  }

  for (const reading of yearlyReadings) {
    energyTypes.add(reading.energy_type)
  }

  return ENERGY_TYPE_ORDER.filter((energyType) => energyTypes.has(energyType))
}

function resolveUnit(
  data: SiteEnergyData,
  yearlyReadings: Array<Pick<EnergyReading, "timestamp" | "value" | "unit"> & { energy_type: EnergyType }>,
  energyType: EnergyType,
): string {
  const meterUnit = data.meters.find((meter) => meter.energy_type === energyType)?.unit
  if (meterUnit) {
    return meterUnit
  }

  const readingUnit = yearlyReadings.find((reading) => reading.energy_type === energyType)?.unit
  if (readingUnit) {
    return readingUnit
  }

  return ENERGY_TYPES[energyType].unit
}

function resolveMeterName(data: SiteEnergyData, energyType: EnergyType): string {
  return data.meters.find((meter) => meter.energy_type === energyType)?.name ?? `${energyType} meter`
}

export function generateEnergyUseReport(data: SiteEnergyData, year: number): EnergyUseReportRow[] {
  const yearlyReadings = getReadingsByYear(data.readings, year)
  const includedEnergyTypes = getIncludedEnergyTypes(data, yearlyReadings)

  if (includedEnergyTypes.length === 0) {
    return []
  }

  const annualUsageByType: Record<EnergyType, number> = {
    electricity: 0,
    gas: 0,
    water: 0,
  }

  for (const reading of yearlyReadings) {
    annualUsageByType[reading.energy_type] += reading.value
  }

  return includedEnergyTypes.map((energyType) => {
    const annualUsage = annualUsageByType[energyType]

    return {
      siteName: data.site.name,
      address: data.site.address,
      areaSqm: data.site.area_sqm,
      buildingType: data.site.building_type,
      energyType: ENERGY_TYPES[energyType].label,
      annualUsage,
      unit: resolveUnit(data, yearlyReadings, energyType),
      toeConversion: convertToToe(annualUsage, energyType),
    }
  })
}

export function generateEgTipsExport(data: SiteEnergyData, year: number): EgTipsExportRow[] {
  const yearlyReadings = getReadingsByYear(data.readings, year)
  const includedEnergyTypes = getIncludedEnergyTypes(data, yearlyReadings)

  if (includedEnergyTypes.length === 0) {
    return []
  }

  const monthlyUsageByType: Record<EnergyType, number[]> = {
    electricity: Array(12).fill(0),
    gas: Array(12).fill(0),
    water: Array(12).fill(0),
  }

  for (const reading of yearlyReadings) {
    const monthIndex = getMonth(new Date(reading.timestamp))
    if (monthIndex >= 0 && monthIndex < 12) {
      monthlyUsageByType[reading.energy_type][monthIndex] += reading.value
    }
  }

  const rows: EgTipsExportRow[] = []

  for (const energyType of includedEnergyTypes) {
    const meterName = resolveMeterName(data, energyType)
    const unit = resolveUnit(data, yearlyReadings, energyType)

    for (let month = 1; month <= 12; month += 1) {
      rows.push({
        facilityName: data.site.name,
        facilityAddress: data.site.address,
        meterName,
        energySource: ENERGY_TYPES[energyType].label,
        year,
        month,
        usage: monthlyUsageByType[energyType][month - 1],
        unit,
      })
    }
  }

  return rows
}

function escapeCsvString(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`
}

function formatRowsAsCsv<T extends object>(rows: T[]): string {
  if (rows.length === 0) {
    return "\uFEFF"
  }

  const headers = Object.keys(rows[0]) as Array<keyof T>
  const lines: string[] = [headers.join(",")]

  for (const row of rows) {
    lines.push(
      headers
        .map((header) => {
          const value = row[header]
          if (typeof value === "string") {
            return escapeCsvString(value)
          }
          if (value === null || value === undefined) {
            return ""
          }
          return String(value)
        })
        .join(","),
    )
  }

  return `\uFEFF${lines.join("\r\n")}`
}

export function formatReportAsCsv(rows: EnergyUseReportRow[] | EgTipsExportRow[]): string {
  if (rows.length === 0) {
    return "\uFEFF"
  }

  if ("siteName" in rows[0]) {
    return formatRowsAsCsv(rows as EnergyUseReportRow[])
  }

  return formatRowsAsCsv(rows as EgTipsExportRow[])
}

export function convertToToe(amount: number, energyType: EnergyType): number {
  return amount * TOE_CONVERSION_FACTORS[energyType]
}
