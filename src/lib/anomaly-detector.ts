import type { AnomalyType, SeverityLevel } from "@/types/database"

interface ReadingDataPoint {
  timestamp: string
  value: number
}

interface DetectedAnomaly {
  timestamp: string
  value: number
  expectedValue: number
  anomalyType: AnomalyType
  severity: SeverityLevel
  zScore: number
  description: string
}

interface AnomalyDetectorConfig {
  zScoreThreshold?: number
  iqrMultiplier?: number
  minDataPoints?: number
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0
  }

  if (sortedValues.length === 1) {
    return sortedValues[0]
  }

  const position = (sortedValues.length - 1) * percentile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  const weight = position - lowerIndex
  const lowerValue = sortedValues[lowerIndex]
  const upperValue = sortedValues[upperIndex]

  return lowerValue + (upperValue - lowerValue) * weight
}

function formatAnomalyDescription(value: number, mean: number, zScore: number): string {
  const percentBase = Math.abs(mean)
  const percentChange =
    percentBase === 0 ? 0 : Math.abs(((value - mean) / percentBase) * 100)
  const direction = value >= mean ? "증가" : "감소"

  return `평균 ${mean.toFixed(2)} 대비 ${percentChange.toFixed(1)}% ${direction} (z-score: ${zScore.toFixed(2)})`
}

export function detectAnomalies(
  data: ReadingDataPoint[],
  config: AnomalyDetectorConfig = {}
): DetectedAnomaly[] {
  const { zScoreThreshold = 2.5, iqrMultiplier = 1.5, minDataPoints = 7 } =
    config

  const sortedData = [...data].sort((a, b) => {
    const timeA = Date.parse(a.timestamp)
    const timeB = Date.parse(b.timestamp)

    if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
      return a.timestamp.localeCompare(b.timestamp)
    }

    return timeA - timeB
  })

  if (sortedData.length < minDataPoints) {
    return []
  }

  const values = sortedData.map((point) => point.value)
  const stats = calculateStatistics(values)
  const iqrLowerBound = stats.q1 - iqrMultiplier * stats.iqr
  const iqrUpperBound = stats.q3 + iqrMultiplier * stats.iqr

  return sortedData.flatMap((point) => {
    const zScore = calculateZScore(point.value, stats.mean, stats.stdDev)
    const isZScoreAnomaly = Math.abs(zScore) > zScoreThreshold
    const isIqrAnomaly =
      point.value < iqrLowerBound || point.value > iqrUpperBound

    if (!isZScoreAnomaly || !isIqrAnomaly) {
      return []
    }

    const expectedValue = stats.mean

    return [
      {
        timestamp: point.timestamp,
        value: point.value,
        expectedValue,
        anomalyType: determineAnomalyType(point.value, expectedValue),
        severity: determineSeverity(zScore),
        zScore,
        description: formatAnomalyDescription(point.value, expectedValue, zScore),
      },
    ]
  })
}

export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) {
    return 0
  }

  return (value - mean) / stdDev
}

export function calculateStatistics(values: number[]): {
  mean: number
  median: number
  stdDev: number
  q1: number
  q3: number
  iqr: number
  lowerBound: number
  upperBound: number
} {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      lowerBound: 0,
      upperBound: 0,
    }
  }

  const sortedValues = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)
  const median = calculatePercentile(sortedValues, 0.5)
  const q1 = calculatePercentile(sortedValues, 0.25)
  const q3 = calculatePercentile(sortedValues, 0.75)
  const iqr = q3 - q1

  return {
    mean,
    median,
    stdDev,
    q1,
    q3,
    iqr,
    lowerBound: q1 - 1.5 * iqr,
    upperBound: q3 + 1.5 * iqr,
  }
}

export function determineSeverity(zScore: number): SeverityLevel {
  const absoluteZScore = Math.abs(zScore)

  if (absoluteZScore < 2) {
    return "low"
  }

  if (absoluteZScore < 3) {
    return "medium"
  }

  return "high"
}

export function determineAnomalyType(
  value: number,
  expectedValue: number
): AnomalyType {
  if (value > expectedValue * 1.1) {
    return "spike"
  }

  if (value < expectedValue * 0.9) {
    return "drop"
  }

  return "pattern_change"
}
