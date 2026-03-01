"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { BuildingType, Site } from "@/types/database"

interface SiteFormPayload {
  name: string
  address: string
  area_sqm: number | null
  building_type: BuildingType
  toe_annual: number | null
  description: string | null
}

function parseSiteFormData(
  formData: FormData
): { error?: string; payload?: SiteFormPayload } {
  const name = formData.get("name")?.toString().trim() ?? ""
  if (name === "") return { error: "사업장 이름을 입력해주세요." }

  const address = formData.get("address")?.toString().trim() ?? ""
  if (address === "") return { error: "사업장 주소를 입력해주세요." }

  const areaValue = formData.get("area_sqm")?.toString().trim() ?? ""
  const area_sqm = areaValue === "" ? null : Number(areaValue)
  if (area_sqm !== null && Number.isNaN(area_sqm)) {
    return { error: "면적은 숫자로 입력해주세요." }
  }

  const toeValue = formData.get("toe_annual")?.toString().trim() ?? ""
  const toe_annual = toeValue === "" ? null : Number(toeValue)
  if (toe_annual !== null && Number.isNaN(toe_annual)) {
    return { error: "연간 에너지 사용량은 숫자로 입력해주세요." }
  }

  const buildingTypeRaw = formData.get("building_type")?.toString().trim() ?? "other"
  const building_type: BuildingType =
    buildingTypeRaw === "office" ||
    buildingTypeRaw === "factory" ||
    buildingTypeRaw === "commercial" ||
    buildingTypeRaw === "other"
      ? buildingTypeRaw
      : "other"

  const descriptionValue = formData.get("description")?.toString().trim() ?? ""
  const description = descriptionValue === "" ? null : descriptionValue

  return {
    payload: {
      name,
      address,
      area_sqm,
      building_type,
      toe_annual,
      description,
    },
  }
}

export async function getSites(): Promise<Site[]> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return []

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error || !data) return []
  return data
}

export async function getSiteById(id: string): Promise<Site | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function createSite(
  formData: FormData
): Promise<{ error?: string; site?: Site }> {
  const parsed = parseSiteFormData(formData)
  if (parsed.error || !parsed.payload) {
    return { error: parsed.error ?? "입력값을 확인해주세요." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("sites")
    .insert({
      user_id: user.id,
      ...parsed.payload,
    } as never)
    .select("*")
    .single()

  if (error || !data) return { error: "사업장 등록 중 오류가 발생했습니다." }

  revalidatePath("/sites")
  return { site: data }
}

export async function updateSite(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = parseSiteFormData(formData)
  if (parsed.error || !parsed.payload) {
    return { error: parsed.error ?? "입력값을 확인해주세요." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("sites")
    .update(parsed.payload as never)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle()

  if (error) return { error: "사업장 수정 중 오류가 발생했습니다." }
  if (!data) return { error: "수정할 사업장을 찾을 수 없습니다." }

  revalidatePath("/sites")
  return {}
}

export async function deleteSite(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("sites")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle()

  if (error) return { error: "사업장 삭제 중 오류가 발생했습니다." }
  if (!data) return { error: "삭제할 사업장을 찾을 수 없습니다." }

  revalidatePath("/sites")
  return {}
}
