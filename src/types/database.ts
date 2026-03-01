// EnergyGuard 데이터 모델 타입 정의
// PRD/02_DATA_MODEL.md 기반

export type EnergyType = "electricity" | "gas" | "water"
export type MeasurementUnit = "kWh" | "m3" | "ton"
export type BuildingType = "office" | "factory" | "commercial" | "other"
export type UserRole = "admin" | "viewer"
export type DataSource = "manual" | "excel_upload" | "api"
export type ConditionType = "exceeds" | "drops_below" | "rate_of_change"
export type TimeWindow = "hourly" | "daily" | "monthly"
export type AlertStatus = "triggered" | "acknowledged" | "resolved"

export interface User {
  [key: string]: unknown
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
}

export interface Site {
  [key: string]: unknown
  id: string
  user_id: string
  name: string
  address: string
  area_sqm: number | null
  building_type: BuildingType
  toe_annual: number | null
  description: string | null
  created_at: string
}

export interface Meter {
  [key: string]: unknown
  id: string
  site_id: string
  name: string
  energy_type: EnergyType
  unit: MeasurementUnit
  location: string | null
  is_active: boolean
  created_at: string
}

export interface EnergyReading {
  [key: string]: unknown
  id: string
  meter_id: string
  timestamp: string
  value: number
  unit: MeasurementUnit
  source: DataSource
  created_at: string
}

export interface AlertRule {
  [key: string]: unknown
  id: string
  site_id: string
  meter_id: string | null
  name: string
  condition_type: ConditionType
  threshold_value: number
  threshold_unit: string
  time_window: TimeWindow
  notify_email: string
  is_active: boolean
  created_at: string
}

export interface Alert {
  [key: string]: unknown
  id: string
  rule_id: string
  triggered_at: string
  actual_value: number
  threshold_value: number
  status: AlertStatus
  resolved_at: string | null
  note: string | null
}

// Phase 2 엔티티

export type RateType = "industrial_a" | "industrial_b" | "general" | "educational" | "other"

export interface EnergyCost {
  [key: string]: unknown
  id: string
  site_id: string
  period_start: string
  period_end: string
  energy_type: EnergyType
  amount_kwh: number
  cost_krw: number
  rate_type: RateType | null
  created_at: string
}

export type WidgetType = "summary" | "usage_line" | "usage_bar" | "yoy_comparison" | "cost_summary" | "site_comparison"

export interface DashboardPreference {
  [key: string]: unknown
  id: string
  user_id: string
  widget_order: WidgetType[]
  hidden_widgets: WidgetType[]
  created_at: string
  updated_at: string
}

// Phase 3 엔티티

export interface EmissionFactor {
  [key: string]: unknown
  id: string
  energy_type: EnergyType
  factor_value: number
  factor_unit: string
  year: number
  source: string
  created_at: string
}

export interface CarbonEmission {
  [key: string]: unknown
  id: string
  site_id: string
  meter_id: string
  period_start: string
  period_end: string
  energy_type: EnergyType
  energy_amount: number
  emission_factor_id: string
  emission_value: number
  created_at: string
}

export interface ReductionTarget {
  [key: string]: unknown
  id: string
  site_id: string
  target_year: number
  base_year: number
  base_emission: number
  target_emission: number
  target_reduction_pct: number
  description: string | null
  created_at: string
}

export type DeviceType = "sensor" | "gateway"
export type IotProtocol = "rest" | "mqtt"

export interface IotDevice {
  [key: string]: unknown
  id: string
  site_id: string
  meter_id: string | null
  device_name: string
  device_type: DeviceType
  protocol: IotProtocol
  api_key: string
  last_seen_at: string | null
  is_active: boolean
  created_at: string
}

export type AnomalyType = "spike" | "drop" | "pattern_change"
export type SeverityLevel = "low" | "medium" | "high"

export interface AnomalyDetection {
  [key: string]: unknown
  id: string
  meter_id: string
  detected_at: string
  anomaly_type: AnomalyType
  severity: SeverityLevel
  expected_value: number
  actual_value: number
  z_score: number
  description: string
  is_acknowledged: boolean
  created_at: string
}

// Supabase Database 타입 (자동 생성 대체용)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<User, "id">>
        Relationships: []
      }
      sites: {
        Row: Site
        Insert: Omit<Site, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<Site, "id">>
        Relationships: []
      }
      meters: {
        Row: Meter
        Insert: Omit<Meter, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<Meter, "id">>
        Relationships: []
      }
      energy_readings: {
        Row: EnergyReading
        Insert: Omit<EnergyReading, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<EnergyReading, "id">>
        Relationships: []
      }
      alert_rules: {
        Row: AlertRule
        Insert: Omit<AlertRule, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<AlertRule, "id">>
        Relationships: []
      }
      alerts: {
        Row: Alert
        Insert: Omit<Alert, "id"> & { id?: string }
        Update: Partial<Omit<Alert, "id">>
        Relationships: []
      }
      energy_costs: {
        Row: EnergyCost
        Insert: Omit<EnergyCost, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<EnergyCost, "id">>
        Relationships: []
      }
      dashboard_preferences: {
        Row: DashboardPreference
        Insert: Omit<DashboardPreference, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<DashboardPreference, "id">>
        Relationships: []
      }
      emission_factors: {
        Row: EmissionFactor
        Insert: Omit<EmissionFactor, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<EmissionFactor, "id">>
        Relationships: []
      }
      carbon_emissions: {
        Row: CarbonEmission
        Insert: Omit<CarbonEmission, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<CarbonEmission, "id">>
        Relationships: []
      }
      reduction_targets: {
        Row: ReductionTarget
        Insert: Omit<ReductionTarget, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<ReductionTarget, "id">>
        Relationships: []
      }
      iot_devices: {
        Row: IotDevice
        Insert: Omit<IotDevice, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<IotDevice, "id">>
        Relationships: []
      }
      anomaly_detections: {
        Row: AnomalyDetection
        Insert: Omit<AnomalyDetection, "id" | "created_at"> & { id?: string; created_at?: string }
        Update: Partial<Omit<AnomalyDetection, "id">>
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
