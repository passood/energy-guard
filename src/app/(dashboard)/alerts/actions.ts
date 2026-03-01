"use server"

import { revalidatePath } from "next/cache"
import { ALERT_STATUSES, CONDITION_TYPES, TIME_WINDOWS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"
import type {
  Alert,
  AlertRule,
  AlertStatus,
  ConditionType,
  Database,
  Meter,
  Site,
  TimeWindow,
} from "@/types/database"

type SiteNameRow = Pick<Site, "id" | "name">
type MeterNameRow = Pick<Meter, "id" | "name">

type AlertRuleNameRow = Pick<AlertRule, "id" | "name" | "site_id">

function toNameMap(rows: Array<{ id: string; name: string }>): Record<string, string> {
  return rows.reduce<Record<string, string>>((map, row) => {
    map[row.id] = row.name
    return map
  }, {})
}

function toUniqueIds(ids: Array<string | null>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id)))
}

async function getAuthenticatedSupabase() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    supabase,
    isAuthenticated: !error && !!user,
  }
}

export async function getAlertRules(): Promise<
  (AlertRule & { site_name: string; meter_name?: string })[]
> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return []

  const { data: rawRules, error: rulesError } = await supabase
    .from("alert_rules")
    .select(
      "id, site_id, meter_id, name, condition_type, threshold_value, threshold_unit, time_window, notify_email, is_active, created_at"
    )
    .order("created_at", { ascending: false })

  if (rulesError || !rawRules) return []

  const rules = rawRules as AlertRule[]
  const siteIds = toUniqueIds(rules.map((rule) => rule.site_id))
  const meterIds = toUniqueIds(rules.map((rule) => rule.meter_id))

  let siteNameMap: Record<string, string> = {}
  let meterNameMap: Record<string, string> = {}

  if (siteIds.length) {
    const { data: rawSites } = await supabase
      .from("sites")
      .select("id, name")
      .in("id", siteIds)

    if (rawSites) siteNameMap = toNameMap(rawSites as SiteNameRow[])
  }

  if (meterIds.length) {
    const { data: rawMeters } = await supabase
      .from("meters")
      .select("id, name")
      .in("id", meterIds)

    if (rawMeters) meterNameMap = toNameMap(rawMeters as MeterNameRow[])
  }

  return rules.map((rule) => {
    const meterName = rule.meter_id ? meterNameMap[rule.meter_id] : undefined

    return {
      ...rule,
      site_name: siteNameMap[rule.site_id] ?? "알 수 없는 사업장",
      ...(meterName ? { meter_name: meterName } : {}),
    }
  })
}

export async function createAlertRule(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return { error: "로그인이 필요합니다." }

  const siteId = formData.get("site_id")?.toString().trim() ?? ""
  const meterId = formData.get("meter_id")?.toString().trim() ?? ""
  const name = formData.get("name")?.toString().trim() ?? ""
  const conditionTypeRaw =
    formData.get("condition_type")?.toString().trim() ?? ""
  const thresholdValue = Number(formData.get("threshold_value"))
  const thresholdUnit = formData.get("threshold_unit")?.toString().trim() ?? ""
  const timeWindowRaw = formData.get("time_window")?.toString().trim() ?? ""
  const notifyEmail = formData.get("notify_email")?.toString().trim() ?? ""

  if (!siteId) return { error: "사업장을 선택해 주세요." }
  if (!name) return { error: "규칙명을 입력해 주세요." }
  if (!(conditionTypeRaw in CONDITION_TYPES)) {
    return { error: "조건 유형이 올바르지 않습니다." }
  }
  if (!Number.isFinite(thresholdValue)) {
    return { error: "임계값은 숫자로 입력해 주세요." }
  }
  if (!thresholdUnit) return { error: "임계값 단위를 입력해 주세요." }
  if (!(timeWindowRaw in TIME_WINDOWS)) {
    return { error: "감시 기간이 올바르지 않습니다." }
  }
  if (!notifyEmail) return { error: "알림 이메일을 입력해 주세요." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
    return { error: "알림 이메일 형식이 올바르지 않습니다." }
  }

  const { error } = await supabase.from("alert_rules").insert({
    site_id: siteId,
    meter_id: meterId || null,
    name,
    condition_type: conditionTypeRaw as ConditionType,
    threshold_value: thresholdValue,
    threshold_unit: thresholdUnit,
    time_window: timeWindowRaw as TimeWindow,
    notify_email: notifyEmail,
    is_active: true,
  })

  if (error) return { error: "알림 규칙 생성에 실패했습니다." }

  revalidatePath("/alerts")
  revalidatePath("/alerts/rules")

  return {}
}

export async function updateAlertRule(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return { error: "로그인이 필요합니다." }
  if (!id.trim()) return { error: "수정할 규칙 ID가 올바르지 않습니다." }

  const updates: Database["public"]["Tables"]["alert_rules"]["Update"] = {}

  if (formData.has("site_id")) {
    const siteId = formData.get("site_id")?.toString().trim() ?? ""

    if (!siteId) return { error: "사업장을 선택해 주세요." }

    updates.site_id = siteId
  }

  if (formData.has("meter_id")) {
    updates.meter_id = formData.get("meter_id")?.toString().trim() || null
  }

  if (formData.has("name")) {
    const name = formData.get("name")?.toString().trim() ?? ""

    if (!name) return { error: "규칙명을 입력해 주세요." }

    updates.name = name
  }

  if (formData.has("condition_type")) {
    const conditionTypeRaw =
      formData.get("condition_type")?.toString().trim() ?? ""

    if (!(conditionTypeRaw in CONDITION_TYPES)) {
      return { error: "조건 유형이 올바르지 않습니다." }
    }

    updates.condition_type = conditionTypeRaw as ConditionType
  }

  if (formData.has("threshold_value")) {
    const thresholdValue = Number(formData.get("threshold_value"))

    if (!Number.isFinite(thresholdValue)) {
      return { error: "임계값은 숫자로 입력해 주세요." }
    }

    updates.threshold_value = thresholdValue
  }

  if (formData.has("threshold_unit")) {
    const thresholdUnit = formData.get("threshold_unit")?.toString().trim() ?? ""

    if (!thresholdUnit) return { error: "임계값 단위를 입력해 주세요." }

    updates.threshold_unit = thresholdUnit
  }

  if (formData.has("time_window")) {
    const timeWindowRaw = formData.get("time_window")?.toString().trim() ?? ""

    if (!(timeWindowRaw in TIME_WINDOWS)) {
      return { error: "감시 기간이 올바르지 않습니다." }
    }

    updates.time_window = timeWindowRaw as TimeWindow
  }

  if (formData.has("notify_email")) {
    const notifyEmail = formData.get("notify_email")?.toString().trim() ?? ""

    if (!notifyEmail) return { error: "알림 이메일을 입력해 주세요." }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
      return { error: "알림 이메일 형식이 올바르지 않습니다." }
    }

    updates.notify_email = notifyEmail
  }

  if (formData.has("is_active")) {
    const isActiveRaw =
      formData.get("is_active")?.toString().trim().toLowerCase() ?? ""

    if (isActiveRaw === "true" || isActiveRaw === "1" || isActiveRaw === "on") {
      updates.is_active = true
    } else if (
      isActiveRaw === "false" ||
      isActiveRaw === "0" ||
      isActiveRaw === "off"
    ) {
      updates.is_active = false
    } else {
      return { error: "활성 상태 값이 올바르지 않습니다." }
    }
  }

  if (!Object.keys(updates).length) {
    return { error: "수정할 항목이 없습니다." }
  }

  const { error } = await supabase.from("alert_rules").update(updates).eq("id", id)

  if (error) return { error: "알림 규칙 수정에 실패했습니다." }

  revalidatePath("/alerts")
  revalidatePath("/alerts/rules")

  return {}
}

export async function deleteAlertRule(id: string): Promise<{ error?: string }> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return { error: "로그인이 필요합니다." }
  if (!id.trim()) return { error: "삭제할 규칙 ID가 올바르지 않습니다." }

  const { error } = await supabase.from("alert_rules").delete().eq("id", id)

  if (error) return { error: "알림 규칙 삭제에 실패했습니다." }

  revalidatePath("/alerts")
  revalidatePath("/alerts/rules")

  return {}
}

export async function getAlerts(
  ruleId?: string
): Promise<(Alert & { rule_name: string; site_name: string })[]> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return []

  let query = supabase
    .from("alerts")
    .select(
      "id, rule_id, triggered_at, actual_value, threshold_value, status, resolved_at, note"
    )
    .order("triggered_at", { ascending: false })
    .limit(50)

  if (ruleId?.trim()) {
    query = query.eq("rule_id", ruleId.trim())
  }

  const { data: rawAlerts, error: alertsError } = await query

  if (alertsError || !rawAlerts) return []

  const alerts = rawAlerts as Alert[]
  const ruleIds = toUniqueIds(alerts.map((alert) => alert.rule_id))

  const ruleMap: Record<string, AlertRuleNameRow> = {}

  if (ruleIds.length) {
    const { data: rawRules } = await supabase
      .from("alert_rules")
      .select("id, name, site_id")
      .in("id", ruleIds)

    for (const rule of (rawRules ?? []) as AlertRuleNameRow[]) {
      ruleMap[rule.id] = rule
    }
  }

  const siteIds = toUniqueIds(
    Object.values(ruleMap).map((rule) => rule.site_id)
  )
  let siteNameMap: Record<string, string> = {}

  if (siteIds.length) {
    const { data: rawSites } = await supabase
      .from("sites")
      .select("id, name")
      .in("id", siteIds)

    if (rawSites) siteNameMap = toNameMap(rawSites as SiteNameRow[])
  }

  return alerts.map((alert) => {
    const rule = ruleMap[alert.rule_id]

    return {
      ...alert,
      rule_name: rule?.name ?? "삭제된 규칙",
      site_name: rule ? siteNameMap[rule.site_id] ?? "알 수 없는 사업장" : "알 수 없는 사업장",
    }
  })
}

export async function updateAlertStatus(
  id: string,
  status: AlertStatus,
  note?: string
): Promise<{ error?: string }> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return { error: "로그인이 필요합니다." }
  if (!id.trim()) return { error: "알림 ID가 올바르지 않습니다." }
  if (!(status in ALERT_STATUSES)) {
    return { error: "알림 상태 값이 올바르지 않습니다." }
  }

  const { data: currentAlert, error: fetchError } = await supabase
    .from("alerts")
    .select("status")
    .eq("id", id)
    .single()

  if (fetchError || !currentAlert) {
    return { error: "알림을 찾을 수 없습니다." }
  }

  const currentStatus = currentAlert.status as AlertStatus
  const nextStatus: AlertStatus | null =
    currentStatus === "triggered"
      ? "acknowledged"
      : currentStatus === "acknowledged"
        ? "resolved"
        : null

  if (!nextStatus) return { error: "이미 해결된 알림입니다." }
  if (status !== nextStatus) {
    return {
      error: `상태는 ${ALERT_STATUSES[nextStatus]} 단계로만 변경할 수 있습니다.`,
    }
  }

  const updates: Database["public"]["Tables"]["alerts"]["Update"] = { status }

  if (status === "resolved") {
    updates.resolved_at = new Date().toISOString()
    updates.note = note?.trim() ? note.trim() : null
  }

  const { error } = await supabase.from("alerts").update(updates).eq("id", id)

  if (error) return { error: "알림 상태 변경에 실패했습니다." }

  revalidatePath("/alerts")

  return {}
}

export async function getUserSitesAndMeters(): Promise<Array<Site & { meters: Meter[] }>> {
  const { supabase, isAuthenticated } = await getAuthenticatedSupabase()

  if (!isAuthenticated) return []

  const { data: rawSites, error: sitesError } = await supabase
    .from("sites")
    .select("id, user_id, name, address, area_sqm, building_type, toe_annual, description, created_at")
    .order("name", { ascending: true })

  if (sitesError || !rawSites) return []

  const sites = rawSites as Site[]

  if (!sites.length) return []

  const { data: rawMeters, error: metersError } = await supabase
    .from("meters")
    .select("id, site_id, name, energy_type, unit, location, is_active, created_at")
    .in(
      "site_id",
      sites.map((site) => site.id)
    )

  const metersBySite = ((metersError || !rawMeters ? [] : rawMeters) as Meter[]).reduce<
    Record<string, Meter[]>
  >((map, meter) => {
    if (!map[meter.site_id]) map[meter.site_id] = []
    map[meter.site_id].push(meter)
    return map
  }, {})

  return sites.map((site) => ({
    ...site,
    meters: (metersBySite[site.id] ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "ko-KR")
    ),
  }))
}
