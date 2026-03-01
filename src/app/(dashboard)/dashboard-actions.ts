"use server"

import { revalidatePath } from "next/cache"
import { WIDGET_TYPES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"
import type { DashboardPreference, WidgetType } from "@/types/database"

const DEFAULT_WIDGET_ORDER = Object.keys(WIDGET_TYPES) as WidgetType[]
const WIDGET_TYPE_SET = new Set<WidgetType>(DEFAULT_WIDGET_ORDER)

function normalizeWidgetOrder(widgetOrder: WidgetType[]): WidgetType[] {
  const uniqueWidgetOrder: WidgetType[] = []
  const addedWidgets = new Set<WidgetType>()

  widgetOrder.forEach((widget) => {
    if (!WIDGET_TYPE_SET.has(widget) || addedWidgets.has(widget)) {
      return
    }

    addedWidgets.add(widget)
    uniqueWidgetOrder.push(widget)
  })

  DEFAULT_WIDGET_ORDER.forEach((widget) => {
    if (addedWidgets.has(widget)) {
      return
    }

    uniqueWidgetOrder.push(widget)
  })

  return uniqueWidgetOrder
}

function normalizeHiddenWidgets(hiddenWidgets: WidgetType[]): WidgetType[] {
  const uniqueHiddenWidgets: WidgetType[] = []
  const hiddenWidgetSet = new Set<WidgetType>()

  hiddenWidgets.forEach((widget) => {
    if (!WIDGET_TYPE_SET.has(widget) || hiddenWidgetSet.has(widget)) {
      return
    }

    hiddenWidgetSet.add(widget)
    uniqueHiddenWidgets.push(widget)
  })

  return uniqueHiddenWidgets
}

export async function getDashboardPreference(): Promise<DashboardPreference | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from("dashboard_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

export async function saveDashboardPreference(
  widgetOrder: WidgetType[],
  hiddenWidgets: WidgetType[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "로그인이 필요합니다." }
  }

  const normalizedWidgetOrder = normalizeWidgetOrder(widgetOrder)
  const normalizedHiddenWidgets = normalizeHiddenWidgets(hiddenWidgets)

  const { error } = await supabase.from("dashboard_preferences").upsert(
    {
      user_id: user.id,
      widget_order: normalizedWidgetOrder,
      hidden_widgets: normalizedHiddenWidgets,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )

  if (error) {
    return { error: "대시보드 설정 저장 중 오류가 발생했습니다." }
  }

  revalidatePath("/")

  return {}
}
