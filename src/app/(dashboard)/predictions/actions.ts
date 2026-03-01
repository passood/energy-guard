"use server"

import { subDays } from "date-fns"
import { revalidatePath } from "next/cache"
import { calculateStatistics, detectAnomalies } from "@/lib/anomaly-detector"
import { createClient } from "@/lib/supabase/server"
import type { AnomalyDetection, Database } from "@/types/database"

export interface PredictionResult {
  predictions: Array<{
    date: string
    predicted: number
    confidence: { low: number; high: number }
  }>
  insight: string
}

type RawReadingRow = {
  timestamp: string
  value: number | string | null
}

type RawAnomalyHistoryRow = {
  id: string
  meter_id: string
  detected_at: string
  anomaly_type: AnomalyDetection["anomaly_type"]
  severity: AnomalyDetection["severity"]
  expected_value: number | string | null
  actual_value: number | string | null
  z_score: number | string | null
  description: string
  is_acknowledged: boolean
  created_at: string
  meters?: { site_id: string } | null
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? 0 : parsed
}

export async function getMeterReadingsForPrediction(
  meterId: string,
  days: number
): Promise<{ data: Array<{ timestamp: string; value: number }>; error?: string }> {
  const trimmedMeterId = meterId.trim()

  if (!trimmedMeterId) {
    return { data: [], error: "계측기 ID가 올바르지 않습니다." }
  }

  const safeDays = Math.max(1, Math.floor(days))
  const fromDate = subDays(new Date(), safeDays)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("energy_readings")
    .select("timestamp, value")
    .eq("meter_id", trimmedMeterId)
    .gte("timestamp", fromDate.toISOString())
    .order("timestamp", { ascending: true })

  if (error) {
    return { data: [], error: "계측기 데이터를 불러오지 못했습니다." }
  }

  return {
    data: ((data ?? []) as RawReadingRow[]).map((reading) => ({
      timestamp: reading.timestamp,
      value: toNumber(reading.value),
    })),
  }
}

export async function getAnomalyHistory(
  siteId: string
): Promise<{ data: AnomalyDetection[]; error?: string }> {
  const trimmedSiteId = siteId.trim()

  if (!trimmedSiteId) {
    return { data: [] }
  }

  const supabase = await createClient()
  const query = supabase
    .from("anomaly_detections")
    .select(
      "id, meter_id, detected_at, anomaly_type, severity, expected_value, actual_value, z_score, description, is_acknowledged, created_at, meters!inner(site_id)"
    )
    .eq("meters.site_id", trimmedSiteId)
    .order("detected_at", { ascending: false })
    .limit(50)
  const { data, error } = (await query) as unknown as {
    data: RawAnomalyHistoryRow[] | null
    error: { message: string } | null
  }

  if (error) {
    return { data: [], error: "이상 감지 이력을 불러오지 못했습니다." }
  }

  return {
    data: (data ?? []).map((anomaly) => ({
      id: anomaly.id,
      meter_id: anomaly.meter_id,
      detected_at: anomaly.detected_at,
      anomaly_type: anomaly.anomaly_type,
      severity: anomaly.severity,
      expected_value: toNumber(anomaly.expected_value),
      actual_value: toNumber(anomaly.actual_value),
      z_score: toNumber(anomaly.z_score),
      description: anomaly.description,
      is_acknowledged: anomaly.is_acknowledged,
      created_at: anomaly.created_at,
    })),
  }
}

export async function runAnomalyDetection(
  meterId: string
): Promise<{ detected: number; error?: string }> {
  const trimmedMeterId = meterId.trim()

  if (!trimmedMeterId) {
    return { detected: 0, error: "계측기를 선택해 주세요." }
  }

  const readingsResult = await getMeterReadingsForPrediction(trimmedMeterId, 90)

  if (readingsResult.error) {
    return { detected: 0, error: readingsResult.error }
  }

  if (readingsResult.data.length === 0) {
    revalidatePath("/predictions")
    return { detected: 0 }
  }

  const stats = calculateStatistics(readingsResult.data.map((reading) => reading.value))
  const detectedAnomalies = detectAnomalies(readingsResult.data)

  if (detectedAnomalies.length === 0) {
    revalidatePath("/predictions")
    return { detected: 0 }
  }

  const insertPayload: Database["public"]["Tables"]["anomaly_detections"]["Insert"][] =
    detectedAnomalies.map((anomaly) => {
      const expectedValue = Number.isFinite(anomaly.expectedValue)
        ? anomaly.expectedValue
        : stats.mean

      return {
        meter_id: trimmedMeterId,
        detected_at: anomaly.timestamp,
        anomaly_type: anomaly.anomalyType,
        severity: anomaly.severity,
        expected_value: expectedValue,
        actual_value: anomaly.value,
        z_score: anomaly.zScore,
        description: anomaly.description,
        is_acknowledged: false,
      }
    })

  const supabase = await createClient()
  const { error } = await supabase
    .from("anomaly_detections")
    .insert(insertPayload as never)

  if (error) {
    return { detected: 0, error: "이상 감지 결과 저장에 실패했습니다." }
  }

  revalidatePath("/predictions")

  return { detected: detectedAnomalies.length }
}

export async function acknowledgeAnomaly(
  id: string
): Promise<{ error?: string }> {
  const trimmedId = id.trim()

  if (!trimmedId) {
    return { error: "이상 감지 ID가 올바르지 않습니다." }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("anomaly_detections")
    .update({ is_acknowledged: true })
    .eq("id", trimmedId)

  if (error) {
    return { error: "이상 감지 확인 처리에 실패했습니다." }
  }

  revalidatePath("/predictions")

  return {}
}
