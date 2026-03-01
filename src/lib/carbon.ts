import type { EnergyType, EmissionFactor, CarbonEmission } from "@/types/database"

interface EmissionCalculationInput {
  energyType: EnergyType
  amount: number
  year: number
}

interface EmissionCalculationResult {
  emissionValue: number
  factorUsed: number
  factorUnit: string
}

type EmissionValueEntry = Pick<CarbonEmission, "emission_value">

function findFactor(
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

function convertToFactorBaseUnit(energyType: EnergyType, amount: number): number {
  if (energyType === "electricity") {
    return amount / 1000
  }

  if (energyType === "gas") {
    return amount / 1000
  }

  return amount / 1000
}

function sumEmissionValues(entries: EmissionValueEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.emission_value, 0)
}

export function calculateEmission(
  input: EmissionCalculationInput,
  factors: EmissionFactor[]
): EmissionCalculationResult {
  const factor = findFactor(input.energyType, input.year, factors)

  if (!factor) {
    return { emissionValue: 0, factorUsed: 0, factorUnit: "" }
  }

  const normalizedAmount = convertToFactorBaseUnit(input.energyType, input.amount)

  return {
    emissionValue: normalizedAmount * factor.factor_value,
    factorUsed: factor.factor_value,
    factorUnit: factor.factor_unit,
  }
}

export function calculateSiteEmissions(
  readings: Array<{ energy_type: EnergyType; value: number; unit: string }>,
  factors: EmissionFactor[],
  year: number
): { electricity: number; gas: number; water: number; total: number } {
  const totals: Record<EnergyType, number> = {
    electricity: 0,
    gas: 0,
    water: 0,
  }

  for (const reading of readings) {
    totals[reading.energy_type] += reading.value
  }

  const electricity = calculateEmission(
    { energyType: "electricity", amount: totals.electricity, year },
    factors
  ).emissionValue
  const gas = calculateEmission(
    { energyType: "gas", amount: totals.gas, year },
    factors
  ).emissionValue
  const water = calculateEmission(
    { energyType: "water", amount: totals.water, year },
    factors
  ).emissionValue

  return {
    electricity,
    gas,
    water,
    total: sumEmissionValues([
      { emission_value: electricity },
      { emission_value: gas },
      { emission_value: water },
    ]),
  }
}

export function calculateReductionProgress(
  currentEmission: number,
  baseEmission: number,
  targetEmission: number
): {
  currentReductionPct: number
  targetReductionPct: number
  onTrack: boolean
  remainingToTarget: number
} {
  if (baseEmission === 0) {
    return {
      currentReductionPct: 0,
      targetReductionPct: 0,
      onTrack: currentEmission <= targetEmission,
      remainingToTarget: currentEmission - targetEmission,
    }
  }

  return {
    currentReductionPct: (1 - currentEmission / baseEmission) * 100,
    targetReductionPct: (1 - targetEmission / baseEmission) * 100,
    onTrack: currentEmission <= targetEmission,
    remainingToTarget: currentEmission - targetEmission,
  }
}

export function formatEmission(value: number): string {
  const rounded = Math.round(value * 1000) / 1000

  return `${Object.is(rounded, -0) ? 0 : rounded} tCO2eq`
}
