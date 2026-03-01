-- EnergyGuard Phase 1 초기 스키마
-- PRD/02_DATA_MODEL.md 기반

-- Users 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sites (사업장)
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  area_sqm NUMERIC,
  building_type TEXT NOT NULL DEFAULT 'office' CHECK (building_type IN ('office', 'factory', 'commercial', 'other')),
  toe_annual NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meters (계측기)
CREATE TABLE IF NOT EXISTS meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  energy_type TEXT NOT NULL CHECK (energy_type IN ('electricity', 'gas', 'water')),
  unit TEXT NOT NULL CHECK (unit IN ('kWh', 'm3', 'ton')),
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Energy Readings (에너지 사용량 데이터)
CREATE TABLE IF NOT EXISTS energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kWh', 'm3', 'ton')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'excel_upload', 'api')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 시계열 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_readings_meter_timestamp ON energy_readings(meter_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON energy_readings(timestamp DESC);

-- Alert Rules (알림 규칙)
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  meter_id UUID REFERENCES meters(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('exceeds', 'drops_below', 'rate_of_change')),
  threshold_value NUMERIC NOT NULL,
  threshold_unit TEXT NOT NULL,
  time_window TEXT NOT NULL DEFAULT 'daily' CHECK (time_window IN ('hourly', 'daily', 'monthly')),
  notify_email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts (알림 이력)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual_value NUMERIC NOT NULL,
  threshold_value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved')),
  resolved_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts(rule_id, triggered_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- 모든 테이블에 RLS 활성화. 사용자는 자신의 데이터만 접근 가능.
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users: 본인 프로필만 조회/수정
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- Sites: 본인이 소유한 사업장만
CREATE POLICY "sites_select_own" ON sites FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sites_insert_own" ON sites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sites_update_own" ON sites FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "sites_delete_own" ON sites FOR DELETE USING (user_id = auth.uid());

-- Meters: 본인 사업장 소속 계측기만
CREATE POLICY "meters_select_own" ON meters FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "meters_insert_own" ON meters FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "meters_update_own" ON meters FOR UPDATE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "meters_delete_own" ON meters FOR DELETE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Energy Readings: 본인 사업장의 계측기 데이터만
CREATE POLICY "readings_select_own" ON energy_readings FOR SELECT
  USING (meter_id IN (SELECT m.id FROM meters m JOIN sites s ON m.site_id = s.id WHERE s.user_id = auth.uid()));
CREATE POLICY "readings_insert_own" ON energy_readings FOR INSERT
  WITH CHECK (meter_id IN (SELECT m.id FROM meters m JOIN sites s ON m.site_id = s.id WHERE s.user_id = auth.uid()));
CREATE POLICY "readings_delete_own" ON energy_readings FOR DELETE
  USING (meter_id IN (SELECT m.id FROM meters m JOIN sites s ON m.site_id = s.id WHERE s.user_id = auth.uid()));

-- Alert Rules: 본인 사업장의 알림 규칙만
CREATE POLICY "alert_rules_select_own" ON alert_rules FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "alert_rules_insert_own" ON alert_rules FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "alert_rules_update_own" ON alert_rules FOR UPDATE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "alert_rules_delete_own" ON alert_rules FOR DELETE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Alerts: 본인 사업장의 알림 이력만
CREATE POLICY "alerts_select_own" ON alerts FOR SELECT
  USING (rule_id IN (SELECT ar.id FROM alert_rules ar JOIN sites s ON ar.site_id = s.id WHERE s.user_id = auth.uid()));
CREATE POLICY "alerts_update_own" ON alerts FOR UPDATE
  USING (rule_id IN (SELECT ar.id FROM alert_rules ar JOIN sites s ON ar.site_id = s.id WHERE s.user_id = auth.uid()));
