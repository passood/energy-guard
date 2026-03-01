"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { DeviceType, IotDevice, IotProtocol } from "@/types/database"

interface IotDeviceWithMeter extends IotDevice {
  meters?: { name: string; energy_type: string } | null
}

function parseDeviceType(value: string): DeviceType | null {
  if (value === "sensor" || value === "gateway") {
    return value
  }

  return null
}

function parseProtocol(value: string): IotProtocol | null {
  if (value === "rest" || value === "mqtt") {
    return value
  }

  return null
}

function parseMeterId(value: string): string | null {
  if (value === "" || value === "none") {
    return null
  }

  return value
}

async function getAuthenticatedSupabase(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  return { supabase, userId: user.id }
}

export async function getIotDevices(
  siteId?: string
): Promise<{ data: IotDeviceWithMeter[]; error?: string }> {
  const authResult = await getAuthenticatedSupabase()
  if ("error" in authResult) {
    return { data: [], error: authResult.error }
  }

  let query = authResult.supabase
    .from("iot_devices")
    .select("*, meters(name, energy_type)")
    .order("created_at", { ascending: false })

  if (siteId) {
    query = query.eq("site_id", siteId)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error: "IoT 디바이스 목록을 불러오지 못했습니다." }
  }

  return { data: ((data ?? []) as unknown) as IotDeviceWithMeter[] }
}

export async function createIotDevice(formData: FormData): Promise<{ error?: string }> {
  const siteId = formData.get("siteId")?.toString().trim() ?? ""
  const meterId = parseMeterId(formData.get("meterId")?.toString().trim() ?? "")
  const deviceName = formData.get("deviceName")?.toString().trim() ?? ""
  const deviceTypeValue = formData.get("deviceType")?.toString().trim() ?? ""
  const protocolValue = formData.get("protocol")?.toString().trim() ?? ""

  if (!siteId || !deviceName || !deviceTypeValue || !protocolValue) {
    return { error: "사업장, 디바이스 이름, 유형, 프로토콜은 필수 입력 항목입니다." }
  }

  const deviceType = parseDeviceType(deviceTypeValue)
  if (!deviceType) {
    return { error: "디바이스 유형이 올바르지 않습니다." }
  }

  const protocol = parseProtocol(protocolValue)
  if (!protocol) {
    return { error: "프로토콜 값이 올바르지 않습니다." }
  }

  const authResult = await getAuthenticatedSupabase()
  if ("error" in authResult) {
    return { error: authResult.error }
  }

  const { data: site, error: siteError } = await authResult.supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("user_id", authResult.userId)
    .maybeSingle()

  if (siteError || !site) {
    return { error: "선택한 사업장을 찾을 수 없거나 접근 권한이 없습니다." }
  }

  if (meterId) {
    const { data: meter, error: meterError } = await authResult.supabase
      .from("meters")
      .select("id")
      .eq("id", meterId)
      .eq("site_id", siteId)
      .maybeSingle()

    if (meterError || !meter) {
      return { error: "선택한 계측기를 찾을 수 없습니다." }
    }
  }

  const { error } = await authResult.supabase.from("iot_devices").insert(
    {
      site_id: siteId,
      meter_id: meterId,
      device_name: deviceName,
      device_type: deviceType,
      protocol,
      api_key: crypto.randomUUID(),
      is_active: true,
    } as never
  )

  if (error) {
    return { error: "IoT 디바이스 등록에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  revalidatePath("/iot")
  return {}
}

export async function updateIotDevice(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const deviceName = formData.get("deviceName")?.toString().trim() ?? ""
  const deviceTypeValue = formData.get("deviceType")?.toString().trim() ?? ""
  const protocolValue = formData.get("protocol")?.toString().trim() ?? ""
  const meterId = parseMeterId(formData.get("meterId")?.toString().trim() ?? "")
  const isActiveValue = formData.get("isActive")?.toString().trim() ?? ""

  if (!deviceName || !deviceTypeValue || !protocolValue) {
    return { error: "디바이스 이름, 유형, 프로토콜은 필수 입력 항목입니다." }
  }

  const deviceType = parseDeviceType(deviceTypeValue)
  if (!deviceType) {
    return { error: "디바이스 유형이 올바르지 않습니다." }
  }

  const protocol = parseProtocol(protocolValue)
  if (!protocol) {
    return { error: "프로토콜 값이 올바르지 않습니다." }
  }

  if (isActiveValue && isActiveValue !== "true" && isActiveValue !== "false") {
    return { error: "활성 상태 값이 올바르지 않습니다." }
  }

  const authResult = await getAuthenticatedSupabase()
  if ("error" in authResult) {
    return { error: authResult.error }
  }

  const { data: currentDevice, error: deviceError } = await authResult.supabase
    .from("iot_devices")
    .select("id, site_id")
    .eq("id", id)
    .maybeSingle()

  if (deviceError) {
    return { error: "IoT 디바이스 정보를 확인하지 못했습니다." }
  }

  if (!currentDevice) {
    return { error: "수정할 IoT 디바이스를 찾을 수 없습니다." }
  }

  if (meterId) {
    const { data: meter, error: meterError } = await authResult.supabase
      .from("meters")
      .select("id")
      .eq("id", meterId)
      .eq("site_id", currentDevice.site_id)
      .maybeSingle()

    if (meterError || !meter) {
      return { error: "선택한 계측기를 찾을 수 없습니다." }
    }
  }

  const updatePayload: {
    device_name: string
    device_type: DeviceType
    protocol: IotProtocol
    meter_id: string | null
    is_active?: boolean
  } = {
    device_name: deviceName,
    device_type: deviceType,
    protocol,
    meter_id: meterId,
  }

  if (isActiveValue === "true" || isActiveValue === "false") {
    updatePayload.is_active = isActiveValue === "true"
  }

  const { data: updated, error: updateError } = await authResult.supabase
    .from("iot_devices")
    .update(updatePayload as never)
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (updateError) {
    return { error: "IoT 디바이스 수정에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  if (!updated) {
    return { error: "수정할 IoT 디바이스를 찾을 수 없습니다." }
  }

  revalidatePath("/iot")
  return {}
}

export async function deleteIotDevice(id: string): Promise<{ error?: string }> {
  const authResult = await getAuthenticatedSupabase()
  if ("error" in authResult) {
    return { error: authResult.error }
  }

  const { data, error } = await authResult.supabase
    .from("iot_devices")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "IoT 디바이스 삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  if (!data) {
    return { error: "삭제할 IoT 디바이스를 찾을 수 없습니다." }
  }

  revalidatePath("/iot")
  return {}
}

export async function regenerateApiKey(
  id: string
): Promise<{ newKey: string; error?: string }> {
  const authResult = await getAuthenticatedSupabase()
  if ("error" in authResult) {
    return { newKey: "", error: authResult.error }
  }

  const newKey = crypto.randomUUID()

  const { data, error } = await authResult.supabase
    .from("iot_devices")
    .update({ api_key: newKey } as never)
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { newKey: "", error: "API 키 재발급에 실패했습니다. 잠시 후 다시 시도해주세요." }
  }

  if (!data) {
    return { newKey: "", error: "API 키를 재발급할 디바이스를 찾을 수 없습니다." }
  }

  revalidatePath("/iot")
  return { newKey }
}
