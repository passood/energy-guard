"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { EnergyType, MeasurementUnit, Meter, Site } from "@/types/database"

const ENERGY_TYPE_VALUES: EnergyType[] = ["electricity", "gas", "water"]
const UNIT_VALUES: MeasurementUnit[] = ["kWh", "m3", "ton"]

export async function getMeters(siteId?: string): Promise<Meter[]> {
  const supabase = await createClient()

  let query = supabase
    .from("meters")
    .select("*")
    .order("created_at", { ascending: false })

  if (siteId) {
    query = query.eq("site_id", siteId)
  }

  const { data, error } = await query

  if (error) {
    return []
  }

  return data ?? []
}

export async function getMeterById(id: string): Promise<Meter | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("meters")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return null
  }

  return data
}

export async function createMeter(
  formData: FormData
): Promise<{ error?: string; meter?: Meter }> {
  const siteId = formData.get("site_id")?.toString().trim() ?? ""
  const name = formData.get("name")?.toString().trim() ?? ""
  const energyTypeValue = formData.get("energy_type")?.toString().trim() ?? ""
  const unitValue = formData.get("unit")?.toString().trim() ?? ""
  const locationValue = formData.get("location")?.toString().trim() ?? ""

  if (!siteId || !name || !energyTypeValue || !unitValue) {
    return { error: "사업장, 계측기명, 에너지 유형, 단위는 필수 입력 항목입니다." }
  }

  if (!ENERGY_TYPE_VALUES.includes(energyTypeValue as EnergyType)) {
    return { error: "에너지 유형이 올바르지 않습니다." }
  }

  if (!UNIT_VALUES.includes(unitValue as MeasurementUnit)) {
    return { error: "단위가 올바르지 않습니다." }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (siteError || !site) {
    return { error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  const insertPayload = {
    site_id: siteId,
    name,
    energy_type: energyTypeValue as EnergyType,
    unit: unitValue as MeasurementUnit,
    location: locationValue.length > 0 ? locationValue : null,
  }

  const { data, error } = await supabase
    .from("meters")
    .insert(insertPayload as never)
    .select("*")
    .single()

  if (error) {
    return { error: "계측기 등록에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  revalidatePath("/meters")
  return { meter: data }
}

export async function updateMeter(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const siteId = formData.get("site_id")?.toString().trim() ?? ""
  const name = formData.get("name")?.toString().trim() ?? ""
  const energyTypeValue = formData.get("energy_type")?.toString().trim() ?? ""
  const unitValue = formData.get("unit")?.toString().trim() ?? ""
  const locationValue = formData.get("location")?.toString().trim() ?? ""
  const isActiveValue = formData.get("is_active")?.toString().trim() ?? "true"

  if (!siteId || !name || !energyTypeValue || !unitValue) {
    return { error: "사업장, 계측기명, 에너지 유형, 단위는 필수 입력 항목입니다." }
  }

  if (!ENERGY_TYPE_VALUES.includes(energyTypeValue as EnergyType)) {
    return { error: "에너지 유형이 올바르지 않습니다." }
  }

  if (!UNIT_VALUES.includes(unitValue as MeasurementUnit)) {
    return { error: "단위가 올바르지 않습니다." }
  }

  if (isActiveValue !== "true" && isActiveValue !== "false") {
    return { error: "계측기 상태 값이 올바르지 않습니다." }
  }

  const supabase = await createClient()

  const updatePayload = {
    site_id: siteId,
    name,
    energy_type: energyTypeValue as EnergyType,
    unit: unitValue as MeasurementUnit,
    location: locationValue.length > 0 ? locationValue : null,
    is_active: isActiveValue === "true",
  }

  const { data, error } = await supabase
    .from("meters")
    .update(updatePayload as never)
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "계측기 수정에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  if (!data) {
    return { error: "수정할 계측기를 찾을 수 없습니다." }
  }

  revalidatePath("/meters")
  return {}
}

export async function deleteMeter(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("meters")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "계측기 삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  if (!data) {
    return { error: "삭제할 계측기를 찾을 수 없습니다." }
  }

  revalidatePath("/meters")
  return {}
}

export async function getUserSites(): Promise<Site[]> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return []
  }

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  if (error) {
    return []
  }

  return data ?? []
}
