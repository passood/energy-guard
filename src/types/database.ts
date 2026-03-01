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
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
