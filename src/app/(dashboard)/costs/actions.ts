"use server"

import { revalidatePath } from "next/cache"
import { ENERGY_TYPES, RATE_TYPES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"
import type { EnergyCost, EnergyType, RateType } from "@/types/database"

export type EnergyCostWithSite = EnergyCost & {
  sites: { name: string }
}

type EnergyCostWithSiteRow = EnergyCost & {
  sites: { name: string } | Array<{ name: string }> | null
}

type CostFormPayload = {
  site_id: string
  period_start: string
  period_end: string
  energy_type: EnergyType
  amount_kwh: number
  cost_krw: number
  rate_type: RateType | null
}

type MeterEnergyRow = {
  id: string
  energy_type: EnergyType
}

type CostRateRow = Pick<EnergyCost, "energy_type" | "amount_kwh" | "cost_krw"> & {
  period_end: string
  created_at: string
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type UsageByEnergy = {
  electricity: number
  gas: number
  water: number
}

function getEmptyUsage(): UsageByEnergy {
  return { electricity: 0, gas: 0, water: 0 }
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function toEnergyCostWithSite(row: EnergyCostWithSiteRow): EnergyCostWithSite {
  const resolvedSite = Array.isArray(row.sites) ? row.sites[0] : row.sites

  return {
    ...row,
    sites: { name: resolvedSite?.name ?? "미확인 사업장" },
  }
}

function parseCostFormData(
  formData: FormData
): { payload?: CostFormPayload; error?: string } {
  const site_id = formData.get("site_id")?.toString().trim() ?? ""
  if (!site_id) return { error: "사업장을 선택해 주세요." }

  let period_start = formData.get("period_start")?.toString().trim() ?? ""
  let period_end = formData.get("period_end")?.toString().trim() ?? ""

  if (!/^\d{4}-\d{2}-\d{2}$/.test(period_start)) {
    return { error: "시작일 형식이 올바르지 않습니다." }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(period_end)) {
    return { error: "종료일 형식이 올바르지 않습니다." }
  }

  if (period_start > period_end) {
    const swapped = period_start
    period_start = period_end
    period_end = swapped
  }

  const energyTypeValue = formData.get("energy_type")?.toString().trim() ?? ""
  if (!(energyTypeValue in ENERGY_TYPES)) {
    return { error: "에너지 유형이 올바르지 않습니다." }
  }

  const amountValue = formData.get("amount_kwh")?.toString().trim() ?? ""
  if (!amountValue) return { error: "사용량을 입력해 주세요." }

  const amount_kwh = Number(amountValue)
  if (!Number.isFinite(amount_kwh)) {
    return { error: "사용량은 숫자로 입력해 주세요." }
  }
  if (amount_kwh <= 0) {
    return { error: "사용량은 0보다 커야 합니다." }
  }

  const costValue = formData.get("cost_krw")?.toString().trim() ?? ""
  if (!costValue) return { error: "비용을 입력해 주세요." }

  const cost_krw = Number(costValue)
  if (!Number.isFinite(cost_krw)) {
    return { error: "비용은 숫자로 입력해 주세요." }
  }
  if (cost_krw < 0) {
    return { error: "비용은 0 이상이어야 합니다." }
  }

  const rateTypeValue = formData.get("rate_type")?.toString().trim() ?? ""
  if (rateTypeValue && !(rateTypeValue in RATE_TYPES)) {
    return { error: "요금 유형이 올바르지 않습니다." }
  }

  return {
    payload: {
      site_id,
      period_start,
      period_end,
      energy_type: energyTypeValue as EnergyType,
      amount_kwh,
      cost_krw,
      rate_type: rateTypeValue ? (rateTypeValue as RateType) : null,
    },
  }
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

async function hasAccessibleCost(
  supabase: SupabaseClient,
  userId: string,
  costId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("energy_costs")
    .select("id, sites!inner(user_id)")
    .eq("id", costId)
    .eq("sites.user_id", userId)
    .maybeSingle()

  return !error && !!data
}

async function getReadingUsageSum(
  supabase: SupabaseClient,
  meterIds: string[],
  fromIso: string,
  toIso: string
): Promise<number> {
  if (meterIds.length === 0) return 0

  const { data, error } = await supabase
    .from("energy_readings")
    .select("value.sum()")
    .in("meter_id", meterIds)
    .gte("timestamp", fromIso)
    .lt("timestamp", toIso)

  if (error || !data?.length) return 0

  return toNumber((data as Array<{ sum: number | string | null }>)[0].sum)
}

export async function getCosts(
  siteId?: string
): Promise<{ data: EnergyCostWithSite[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { data: [], error: "로그인이 필요합니다." }

  let query = supabase
    .from("energy_costs")
    .select(
      "id, site_id, period_start, period_end, energy_type, amount_kwh, cost_krw, rate_type, created_at, sites!inner(name)"
    )
    .eq("sites.user_id", user.id)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false })

  if (siteId?.trim()) {
    query = query.eq("site_id", siteId.trim())
  }

  const { data, error } = await query
  if (error || !data) {
    return { data: [], error: "비용 목록을 불러오는 중 오류가 발생했습니다." }
  }

  return {
    data: (data as unknown as EnergyCostWithSiteRow[]).map(toEnergyCostWithSite),
  }
}

export async function getCostById(
  id: string
): Promise<{ data: EnergyCostWithSite | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { data: null, error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("energy_costs")
    .select(
      "id, site_id, period_start, period_end, energy_type, amount_kwh, cost_krw, rate_type, created_at, sites!inner(name)"
    )
    .eq("id", id)
    .eq("sites.user_id", user.id)
    .maybeSingle()

  if (error) {
    return { data: null, error: "비용 정보를 불러오는 중 오류가 발생했습니다." }
  }

  if (!data) {
    return { data: null }
  }

  return { data: toEnergyCostWithSite(data as unknown as EnergyCostWithSiteRow) }
}

export async function createCost(formData: FormData): Promise<{ error?: string }> {
  const parsed = parseCostFormData(formData)
  if (parsed.error || !parsed.payload) {
    return { error: parsed.error ?? "입력값을 확인해 주세요." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "로그인이 필요합니다." }

  if (!(await hasAccessibleSite(supabase, user.id, parsed.payload.site_id))) {
    return { error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  const { error } = await supabase
    .from("energy_costs")
    .insert(parsed.payload as never)

  if (error) return { error: "비용 등록 중 오류가 발생했습니다." }

  revalidatePath("/costs")
  return {}
}

export async function updateCost(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = parseCostFormData(formData)
  if (parsed.error || !parsed.payload) {
    return { error: parsed.error ?? "입력값을 확인해 주세요." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "로그인이 필요합니다." }

  if (!(await hasAccessibleCost(supabase, user.id, id))) {
    return { error: "수정할 비용 정보를 찾을 수 없습니다." }
  }

  if (!(await hasAccessibleSite(supabase, user.id, parsed.payload.site_id))) {
    return { error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  const { data, error } = await supabase
    .from("energy_costs")
    .update(parsed.payload as never)
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) return { error: "비용 수정 중 오류가 발생했습니다." }
  if (!data) return { error: "수정할 비용 정보를 찾을 수 없습니다." }

  revalidatePath("/costs")
  return {}
}

export async function deleteCost(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "로그인이 필요합니다." }

  if (!(await hasAccessibleCost(supabase, user.id, id))) {
    return { error: "삭제할 비용 정보를 찾을 수 없습니다." }
  }

  const { data, error } = await supabase
    .from("energy_costs")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) return { error: "비용 삭제 중 오류가 발생했습니다." }
  if (!data) return { error: "삭제할 비용 정보를 찾을 수 없습니다." }

  revalidatePath("/costs")
  return {}
}

export async function getEstimatedMonthlyCost(
  siteId: string
): Promise<{ electricity: number; gas: number; water: number }> {
  const empty = getEmptyUsage()
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return empty
  if (!(await hasAccessibleSite(supabase, user.id, siteId))) return empty

  const { data: costData } = await supabase
    .from("energy_costs")
    .select("energy_type, amount_kwh, cost_krw, period_end, created_at")
    .eq("site_id", siteId)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })

  const unitCostByEnergy = getEmptyUsage()
  const resolvedEnergyTypes = new Set<EnergyType>()

  for (const costRow of (costData ?? []) as CostRateRow[]) {
    if (resolvedEnergyTypes.has(costRow.energy_type)) continue

    const amount = toNumber(costRow.amount_kwh)
    if (amount <= 0) continue

    unitCostByEnergy[costRow.energy_type] = toNumber(costRow.cost_krw) / amount
    resolvedEnergyTypes.add(costRow.energy_type)

    if (resolvedEnergyTypes.size === 3) break
  }

  const { data: meterData, error: meterError } = await supabase
    .from("meters")
    .select("id, energy_type")
    .eq("site_id", siteId)

  if (meterError || !meterData?.length) return empty

  const meterIdsByEnergy: Record<EnergyType, string[]> = {
    electricity: [],
    gas: [],
    water: [],
  }

  ;(meterData as MeterEnergyRow[]).forEach((meter) => {
    meterIdsByEnergy[meter.energy_type].push(meter.id)
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [electricityUsage, gasUsage, waterUsage] = await Promise.all([
    getReadingUsageSum(
      supabase,
      meterIdsByEnergy.electricity,
      monthStart.toISOString(),
      nextMonthStart.toISOString()
    ),
    getReadingUsageSum(
      supabase,
      meterIdsByEnergy.gas,
      monthStart.toISOString(),
      nextMonthStart.toISOString()
    ),
    getReadingUsageSum(
      supabase,
      meterIdsByEnergy.water,
      monthStart.toISOString(),
      nextMonthStart.toISOString()
    ),
  ])

  return {
    electricity: Math.round(unitCostByEnergy.electricity * electricityUsage),
    gas: Math.round(unitCostByEnergy.gas * gasUsage),
    water: Math.round(unitCostByEnergy.water * waterUsage),
  }
}
