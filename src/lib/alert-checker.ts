import { startOfDay, startOfMonth, subDays, subHours, subMonths } from "date-fns"
import { CONDITION_TYPES, TIME_WINDOWS } from "@/lib/constants"
import { sendAlertEmail } from "@/lib/email"
import { createClient } from "@/lib/supabase/server"
import type { AlertRule, ConditionType, TimeWindow } from "@/types/database"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type MeterSiteRow = {
  id: string
  site_id: string
}

type SiteNameRow = {
  id: string
  name: string
}

type AlertRuleCheckRow = Pick<
  AlertRule,
  | "id"
  | "site_id"
  | "meter_id"
  | "name"
  | "condition_type"
  | "threshold_value"
  | "threshold_unit"
  | "time_window"
  | "notify_email"
>

type SumRow = {
  sum: number | string | null
}

type WindowRange = {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? 0 : parsed
}

function toUniqueIds(ids: string[]): string[] {
  return Array.from(
    new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))
  )
}

function toSiteMeterMap(meters: MeterSiteRow[]): Map<string, string[]> {
  const siteMeterMap = new Map<string, string[]>()

  for (const meter of meters) {
    const meterIds = siteMeterMap.get(meter.site_id)

    if (meterIds) {
      meterIds.push(meter.id)
      continue
    }

    siteMeterMap.set(meter.site_id, [meter.id])
  }

  return siteMeterMap
}

function getWindowRange(timeWindow: TimeWindow, now: Date): WindowRange {
  if (timeWindow === "hourly") {
    const currentStart = subHours(now, 1)

    return {
      currentStart,
      currentEnd: now,
      previousStart: subHours(now, 2),
      previousEnd: currentStart,
    }
  }

  if (timeWindow === "daily") {
    const currentStart = startOfDay(now)

    return {
      currentStart,
      currentEnd: now,
      previousStart: subDays(currentStart, 1),
      previousEnd: currentStart,
    }
  }

  const currentStart = startOfMonth(now)

  return {
    currentStart,
    currentEnd: now,
    previousStart: startOfMonth(subMonths(now, 1)),
    previousEnd: currentStart,
  }
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
    .lt("timestamp", toIso)

  if (error) {
    return 0
  }

  const rows = data as SumRow[] | null

  return toNumber(rows?.[0]?.sum)
}

function evaluateRule(
  conditionType: ConditionType,
  thresholdValue: number,
  currentValue: number,
  previousValue: number
): { triggered: boolean; actualValue: number } {
  if (conditionType === "exceeds") {
    return { triggered: currentValue > thresholdValue, actualValue: currentValue }
  }

  if (conditionType === "drops_below") {
    return { triggered: currentValue < thresholdValue, actualValue: currentValue }
  }

  const rateForDecision =
    previousValue === 0
      ? currentValue === 0
        ? 0
        : Number.POSITIVE_INFINITY
      : Math.abs(((currentValue - previousValue) / previousValue) * 100)

  return {
    triggered: rateForDecision > thresholdValue,
    actualValue: Number.isFinite(rateForDecision) ? rateForDecision : 100,
  }
}

export async function checkAlertRules(meterIds: string[]): Promise<void> {
  const scopedMeterIds = toUniqueIds(meterIds)

  if (scopedMeterIds.length === 0) {
    return
  }

  const supabase = await createClient()

  const { data: inputMeters, error: inputMetersError } = await supabase
    .from("meters")
    .select("id, site_id")
    .in("id", scopedMeterIds)

  if (inputMetersError || !inputMeters?.length) {
    return
  }

  const scopedMeters = inputMeters as MeterSiteRow[]
  const scopedSiteIds = toUniqueIds(scopedMeters.map((meter) => meter.site_id))

  if (scopedSiteIds.length === 0) {
    return
  }

  const [
    siteMetersResult,
    meterRulesResult,
    siteRulesResult,
  ] = await Promise.all([
    supabase.from("meters").select("id, site_id").in("site_id", scopedSiteIds),
    supabase
      .from("alert_rules")
      .select(
        "id, site_id, meter_id, name, condition_type, threshold_value, threshold_unit, time_window, notify_email"
      )
      .eq("is_active", true)
      .in("meter_id", scopedMeterIds),
    supabase
      .from("alert_rules")
      .select(
        "id, site_id, meter_id, name, condition_type, threshold_value, threshold_unit, time_window, notify_email"
      )
      .eq("is_active", true)
      .is("meter_id", null)
      .in("site_id", scopedSiteIds),
  ])

  if (siteMetersResult.error || !siteMetersResult.data) {
    return
  }

  const rulesMap = new Map<string, AlertRuleCheckRow>()

  if (!meterRulesResult.error && meterRulesResult.data) {
    for (const rule of meterRulesResult.data as AlertRuleCheckRow[]) {
      rulesMap.set(rule.id, rule)
    }
  }

  if (!siteRulesResult.error && siteRulesResult.data) {
    for (const rule of siteRulesResult.data as AlertRuleCheckRow[]) {
      rulesMap.set(rule.id, rule)
    }
  }

  const rules = Array.from(rulesMap.values())

  if (rules.length === 0) {
    return
  }

  const siteMeterMap = toSiteMeterMap(siteMetersResult.data as MeterSiteRow[])
  const ruleIds = rules.map((rule) => rule.id)
  const ruleSiteIds = toUniqueIds(rules.map((rule) => rule.site_id))

  const now = new Date()
  const nowIso = now.toISOString()
  const oneHourAgoIso = subHours(now, 1).toISOString()

  const [
    recentAlertsResult,
    siteNamesResult,
  ] = await Promise.all([
    supabase
      .from("alerts")
      .select("rule_id")
      .in("rule_id", ruleIds)
      .eq("status", "triggered")
      .gte("triggered_at", oneHourAgoIso),
    supabase.from("sites").select("id, name").in("id", ruleSiteIds),
  ])

  if (recentAlertsResult.error) {
    return
  }

  const recentlyTriggeredRuleIds = new Set(
    (recentAlertsResult.data ?? []).map((row) => row.rule_id)
  )

  const siteNameMap = new Map<string, string>()

  if (!siteNamesResult.error && siteNamesResult.data) {
    for (const site of siteNamesResult.data as SiteNameRow[]) {
      siteNameMap.set(site.id, site.name)
    }
  }

  for (const rule of rules) {
    if (recentlyTriggeredRuleIds.has(rule.id)) {
      continue
    }
    if (!(rule.condition_type in CONDITION_TYPES)) {
      continue
    }
    if (!(rule.time_window in TIME_WINDOWS)) {
      continue
    }

    const ruleMeterIds = rule.meter_id
      ? [rule.meter_id]
      : siteMeterMap.get(rule.site_id) ?? []

    if (ruleMeterIds.length === 0) {
      continue
    }

    const windowRange = getWindowRange(rule.time_window, now)
    const currentValue = await getUsageSum(
      supabase,
      ruleMeterIds,
      windowRange.currentStart.toISOString(),
      windowRange.currentEnd.toISOString()
    )

    let previousValue = 0

    if (rule.condition_type === "rate_of_change") {
      previousValue = await getUsageSum(
        supabase,
        ruleMeterIds,
        windowRange.previousStart.toISOString(),
        windowRange.previousEnd.toISOString()
      )
    }

    const { triggered, actualValue } = evaluateRule(
      rule.condition_type,
      rule.threshold_value,
      currentValue,
      previousValue
    )

    if (!triggered) {
      continue
    }

    const { error: insertError } = await supabase.from("alerts").insert({
      rule_id: rule.id,
      triggered_at: nowIso,
      actual_value: actualValue,
      threshold_value: rule.threshold_value,
      status: "triggered",
      resolved_at: null,
      note: null,
    })

    if (insertError) {
      continue
    }

    recentlyTriggeredRuleIds.add(rule.id)

    try {
      await sendAlertEmail({
        to: rule.notify_email,
        ruleName: rule.name,
        siteName: siteNameMap.get(rule.site_id) ?? "알 수 없는 사업장",
        actualValue,
        thresholdValue: rule.threshold_value,
        thresholdUnit: rule.threshold_unit,
        conditionType: rule.condition_type,
        triggeredAt: nowIso,
      })
    } catch {
      // 이메일 발송 실패는 알림 저장 결과에 영향이 없어야 함
    }
  }
}
