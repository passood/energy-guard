"use server"

import { revalidatePath } from "next/cache"
import { calculateEmission, calculateSiteEmissions } from "@/lib/carbon"
import { DEFAULT_EMISSION_FACTORS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"
import type {
  CarbonEmission,
  EmissionFactor,
  ReductionTarget,
  Site,
  EnergyType,
} from "@/types/database"

interface SiteCarbonSummary {
  siteId: string
  siteName: string
  totalEmission: number
  byType: { electricity: number; gas: number; water: number }
}

type SiteRow = Pick<Site, "id" | "name">

type CarbonEmissionSummaryRow = Pick<
  CarbonEmission,
  "site_id" | "energy_type" | "emission_value" | "period_start"
>

type MeterRow = {
  id: string
  site_id: string
  energy_type: EnergyType
  unit: string
}

type ReadingRow = {
  meter_id: string
  value: number | string | null
  unit: string | null
}

type ReductionTargetFormPayload = {
  siteId: string
  targetYear: number
  baseYear: number
  baseEmission: number
  targetEmission: number
  targetReductionPct: number
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function getEmptyByType(): SiteCarbonSummary["byType"] {
  return { electricity: 0, gas: 0, water: 0 }
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getFallbackFactors(year: number): EmissionFactor[] {
  const createdAt = new Date(0).toISOString()

  return [
    {
      id: `fallback-electricity-${year}`,
      energy_type: "electricity",
      factor_value: DEFAULT_EMISSION_FACTORS.electricity.value,
      factor_unit: DEFAULT_EMISSION_FACTORS.electricity.unit,
      year,
      source: "기본 배출계수",
      created_at: createdAt,
    },
    {
      id: `fallback-gas-${year}`,
      energy_type: "gas",
      factor_value: DEFAULT_EMISSION_FACTORS.gas.value,
      factor_unit: DEFAULT_EMISSION_FACTORS.gas.unit,
      year,
      source: "기본 배출계수",
      created_at: createdAt,
    },
    {
      id: `fallback-water-${year}`,
      energy_type: "water",
      factor_value: DEFAULT_EMISSION_FACTORS.water.value,
      factor_unit: DEFAULT_EMISSION_FACTORS.water.unit,
      year,
      source: "기본 배출계수",
      created_at: createdAt,
    },
  ]
}

function findBestFactor(
  energyType: EnergyType,
  year: number,
  factors: EmissionFactor[]
): EmissionFactor | null {
  let exactMatch: EmissionFactor | null = null
  let latestByYear: EmissionFactor | null = null

  for (const factor of factors) {
    if (factor.energy_type !== energyType) {
      continue
    }

    if (latestByYear === null || factor.year > latestByYear.year) {
      latestByYear = factor
    }

    if (factor.year === year) {
      exactMatch = factor
    }
  }

  return exactMatch ?? latestByYear
}

async function hasAccessibleSite(
  supabase: SupabaseClient,
  userId: string,
  siteId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("user_id", userId)
    .maybeSingle()

  return !error && !!data
}

function parseReductionTargetFormData(
  formData: FormData
): { payload?: ReductionTargetFormPayload; error?: string } {
  const siteId = formData.get("siteId")?.toString().trim() ?? ""
  if (!siteId) {
    return { error: "사업장을 선택해 주세요." }
  }

  const targetYearRaw = formData.get("targetYear")?.toString().trim() ?? ""
  const baseYearRaw = formData.get("baseYear")?.toString().trim() ?? ""
  const baseEmissionRaw = formData.get("baseEmission")?.toString().trim() ?? ""
  const targetEmissionRaw = formData.get("targetEmission")?.toString().trim() ?? ""
  const targetReductionPctRaw =
    formData.get("targetReductionPct")?.toString().trim() ?? ""

  const targetYear = Number(targetYearRaw)
  if (!Number.isInteger(targetYear)) {
    return { error: "목표 연도를 올바르게 입력해 주세요." }
  }

  const baseYear = Number(baseYearRaw)
  if (!Number.isInteger(baseYear)) {
    return { error: "기준 연도를 올바르게 입력해 주세요." }
  }

  const baseEmission = Number(baseEmissionRaw)
  if (!Number.isFinite(baseEmission) || baseEmission < 0) {
    return { error: "기준 배출량을 올바르게 입력해 주세요." }
  }

  const targetEmission = Number(targetEmissionRaw)
  if (!Number.isFinite(targetEmission) || targetEmission < 0) {
    return { error: "목표 배출량을 올바르게 입력해 주세요." }
  }

  const targetReductionPct = Number(targetReductionPctRaw)
  if (!Number.isFinite(targetReductionPct)) {
    return { error: "감축률을 올바르게 입력해 주세요." }
  }

  return {
    payload: {
      siteId,
      targetYear,
      baseYear,
      baseEmission,
      targetEmission,
      targetReductionPct,
    },
  }
}

export async function getEmissionFactors(): Promise<{
  data: EmissionFactor[]
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
    .from("emission_factors")
    .select("*")
    .order("year", { ascending: false })
    .order("energy_type", { ascending: true })

  if (error || !data) {
    return { data: [], error: "배출계수 조회 중 오류가 발생했습니다." }
  }

  return { data }
}

export async function getSiteCarbonSummary(
  year: number
): Promise<{ data: SiteCarbonSummary[]; error?: string }> {
  if (!Number.isInteger(year)) {
    return { data: [], error: "연도 정보가 올바르지 않습니다." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: [], error: "로그인이 필요합니다." }
  }

  const { data: siteData, error: siteError } = await supabase
    .from("sites")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (siteError || !siteData) {
    return { data: [], error: "사업장 정보를 조회하지 못했습니다." }
  }

  if (siteData.length === 0) {
    return { data: [] }
  }

  const sites = siteData as SiteRow[]
  const siteIds = sites.map((site) => site.id)
  const periodStart = `${year}-01-01`
  const periodEnd = `${year + 1}-01-01`

  const { data: factorData, error: factorError } = await supabase
    .from("emission_factors")
    .select("*")

  if (factorError) {
    return { data: [], error: "배출계수 정보를 조회하지 못했습니다." }
  }

  const resolvedFactors = (factorData as EmissionFactor[] | null)?.length
    ? ((factorData as EmissionFactor[]) ?? [])
    : getFallbackFactors(year)

  const { data: emissionData, error: emissionError } = await supabase
    .from("carbon_emissions")
    .select("site_id, energy_type, emission_value, period_start")
    .in("site_id", siteIds)
    .gte("period_start", periodStart)
    .lt("period_start", periodEnd)

  if (emissionError) {
    return { data: [], error: "탄소 배출량 정보를 조회하지 못했습니다." }
  }

  const byTypeBySite = new Map<string, SiteCarbonSummary["byType"]>()

  ;((emissionData ?? []) as CarbonEmissionSummaryRow[]).forEach((row) => {
    const current = byTypeBySite.get(row.site_id) ?? getEmptyByType()
    current[row.energy_type] += toNumber(row.emission_value)
    byTypeBySite.set(row.site_id, current)
  })

  const fallbackSiteIds = siteIds.filter((siteId) => !byTypeBySite.has(siteId))

  if (fallbackSiteIds.length > 0) {
    const { data: meterData, error: meterError } = await supabase
      .from("meters")
      .select("id, site_id, energy_type, unit")
      .in("site_id", fallbackSiteIds)

    if (meterError) {
      return { data: [], error: "계측기 정보를 조회하지 못했습니다." }
    }

    const meters = (meterData ?? []) as MeterRow[]
    const meterIds = meters.map((meter) => meter.id)

    if (meterIds.length > 0) {
      const meterById = new Map<string, MeterRow>()
      meters.forEach((meter) => {
        meterById.set(meter.id, meter)
      })

      const { data: readingData, error: readingError } = await supabase
        .from("energy_readings")
        .select("meter_id, value, unit")
        .in("meter_id", meterIds)
        .gte("timestamp", `${periodStart}T00:00:00.000Z`)
        .lt("timestamp", `${periodEnd}T00:00:00.000Z`)

      if (readingError) {
        return { data: [], error: "에너지 데이터를 조회하지 못했습니다." }
      }

      const readingsBySite = new Map<
        string,
        Array<{ energy_type: EnergyType; value: number; unit: string }>
      >()

      ;((readingData ?? []) as ReadingRow[]).forEach((reading) => {
        const meter = meterById.get(reading.meter_id)
        if (!meter) {
          return
        }

        const rows = readingsBySite.get(meter.site_id) ?? []
        rows.push({
          energy_type: meter.energy_type,
          value: toNumber(reading.value),
          unit: reading.unit ?? meter.unit,
        })
        readingsBySite.set(meter.site_id, rows)
      })

      fallbackSiteIds.forEach((siteId) => {
        const calculated = calculateSiteEmissions(
          readingsBySite.get(siteId) ?? [],
          resolvedFactors,
          year
        )

        byTypeBySite.set(siteId, {
          electricity: calculated.electricity,
          gas: calculated.gas,
          water: calculated.water,
        })
      })
    }
  }

  return {
    data: sites.map((site) => {
      const byType = byTypeBySite.get(site.id) ?? getEmptyByType()

      return {
        siteId: site.id,
        siteName: site.name,
        totalEmission: byType.electricity + byType.gas + byType.water,
        byType,
      }
    }),
  }
}

export async function calculateAndSaveEmissions(
  siteId: string,
  year: number,
  month: number
): Promise<{ error?: string }> {
  if (!siteId.trim()) {
    return { error: "사업장을 선택해 주세요." }
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "연도 또는 월 정보가 올바르지 않습니다." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  if (!(await hasAccessibleSite(supabase, user.id, siteId))) {
    return { error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  const { data: meterData, error: meterError } = await supabase
    .from("meters")
    .select("id, site_id, energy_type, unit")
    .eq("site_id", siteId)

  if (meterError || !meterData) {
    return { error: "계측기 정보를 조회하지 못했습니다." }
  }

  const meters = meterData as MeterRow[]

  if (meters.length === 0) {
    return { error: "등록된 계측기가 없습니다." }
  }

  const periodStartDate = new Date(Date.UTC(year, month - 1, 1))
  const periodEndDateExclusive = new Date(Date.UTC(year, month, 1))
  const periodEndDate = new Date(Date.UTC(year, month, 0))

  const { data: yearlyFactors, error: yearlyFactorError } = await supabase
    .from("emission_factors")
    .select("*")
    .eq("year", year)

  if (yearlyFactorError) {
    return { error: "배출계수 정보를 조회하지 못했습니다." }
  }

  let factorsForCalculation = (yearlyFactors ?? []) as EmissionFactor[]

  if (factorsForCalculation.length === 0) {
    const { data: allFactors, error: allFactorError } = await supabase
      .from("emission_factors")
      .select("*")

    if (allFactorError || !allFactors || allFactors.length === 0) {
      return { error: "사용 가능한 배출계수가 없습니다." }
    }

    factorsForCalculation = allFactors as EmissionFactor[]
  }

  const meterIds = meters.map((meter) => meter.id)
  const { data: readingData, error: readingError } = await supabase
    .from("energy_readings")
    .select("meter_id, value")
    .in("meter_id", meterIds)
    .gte("timestamp", periodStartDate.toISOString())
    .lt("timestamp", periodEndDateExclusive.toISOString())

  if (readingError) {
    return { error: "에너지 데이터를 조회하지 못했습니다." }
  }

  const usageByMeter = new Map<string, number>()

  ;((readingData ?? []) as Array<{ meter_id: string; value: number | string | null }>).forEach(
    (reading) => {
      usageByMeter.set(
        reading.meter_id,
        (usageByMeter.get(reading.meter_id) ?? 0) + toNumber(reading.value)
      )
    }
  )

  const rowsToUpsert: Array<Omit<CarbonEmission, "id" | "created_at">> = []

  for (const meter of meters) {
    const factor = findBestFactor(meter.energy_type, year, factorsForCalculation)
    if (!factor) {
      return { error: `${meter.energy_type} 배출계수를 찾지 못했습니다.` }
    }

    const energyAmount = usageByMeter.get(meter.id) ?? 0
    const { emissionValue } = calculateEmission(
      {
        energyType: meter.energy_type,
        amount: energyAmount,
        year,
      },
      factorsForCalculation
    )

    rowsToUpsert.push({
      site_id: siteId,
      meter_id: meter.id,
      period_start: toDateOnly(periodStartDate),
      period_end: toDateOnly(periodEndDate),
      energy_type: meter.energy_type,
      energy_amount: energyAmount,
      emission_factor_id: factor.id,
      emission_value: emissionValue,
    })
  }

  const { error: upsertError } = await supabase.from("carbon_emissions").upsert(
    rowsToUpsert as never,
    {
      onConflict: "site_id,meter_id,period_start,period_end",
    }
  )

  if (upsertError) {
    return { error: "탄소 배출량 저장 중 오류가 발생했습니다." }
  }

  revalidatePath("/carbon")
  return {}
}

export async function getReductionTargets(
  siteId: string
): Promise<{ data: ReductionTarget[]; error?: string }> {
  if (!siteId.trim()) {
    return { data: [] }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: [], error: "로그인이 필요합니다." }
  }

  if (!(await hasAccessibleSite(supabase, user.id, siteId))) {
    return { data: [], error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  const { data, error } = await supabase
    .from("reduction_targets")
    .select("*")
    .eq("site_id", siteId)
    .order("target_year", { ascending: false })
    .order("created_at", { ascending: false })

  if (error || !data) {
    return { data: [], error: "감축 목표를 조회하지 못했습니다." }
  }

  return { data }
}

export async function createReductionTarget(
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = parseReductionTargetFormData(formData)

  if (parsed.error || !parsed.payload) {
    return { error: parsed.error ?? "입력값을 확인해 주세요." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  if (!(await hasAccessibleSite(supabase, user.id, parsed.payload.siteId))) {
    return { error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  const { error } = await supabase.from("reduction_targets").insert({
    site_id: parsed.payload.siteId,
    target_year: parsed.payload.targetYear,
    base_year: parsed.payload.baseYear,
    base_emission: parsed.payload.baseEmission,
    target_emission: parsed.payload.targetEmission,
    target_reduction_pct: parsed.payload.targetReductionPct,
  } as never)

  if (error) {
    if (error.code === "23505") {
      return { error: "해당 목표 연도는 이미 등록되어 있습니다." }
    }

    return { error: "감축 목표 등록 중 오류가 발생했습니다." }
  }

  revalidatePath("/carbon/targets")
  return {}
}

export async function deleteReductionTarget(id: string): Promise<{ error?: string }> {
  if (!id.trim()) {
    return { error: "삭제할 목표 정보가 올바르지 않습니다." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  const { data, error } = await supabase
    .from("reduction_targets")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "감축 목표 삭제 중 오류가 발생했습니다." }
  }

  if (!data) {
    return { error: "삭제할 감축 목표를 찾을 수 없습니다." }
  }

  revalidatePath("/carbon/targets")
  return {}
}
