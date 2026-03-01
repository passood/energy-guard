-- EnergyGuard Phase 3 스키마 추가
-- ESG + 지능화: 탄소 관리, 이상 감지, IoT 연동

-- ============================================================
-- 탄소 배출 관리
-- ============================================================

-- 배출계수 (환경부 국가 온실가스 인벤토리 기반)
CREATE TABLE IF NOT EXISTS emission_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  energy_type TEXT NOT NULL CHECK (energy_type IN ('electricity', 'gas', 'water')),
  factor_value NUMERIC NOT NULL,
  factor_unit TEXT NOT NULL,
  year INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT '환경부 국가 온실가스 인벤토리',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(energy_type, year)
);

-- 탄소 배출량 (자동 계산 결과)
CREATE TABLE IF NOT EXISTS carbon_emissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  energy_type TEXT NOT NULL CHECK (energy_type IN ('electricity', 'gas', 'water')),
  energy_amount NUMERIC NOT NULL,
  emission_factor_id UUID NOT NULL REFERENCES emission_factors(id),
  emission_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carbon_emissions_site ON carbon_emissions(site_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_carbon_emissions_meter ON carbon_emissions(meter_id, period_start DESC);

-- 감축 목표
CREATE TABLE IF NOT EXISTS reduction_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  target_year INTEGER NOT NULL,
  base_year INTEGER NOT NULL,
  base_emission NUMERIC NOT NULL,
  target_emission NUMERIC NOT NULL,
  target_reduction_pct NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, target_year)
);

-- ============================================================
-- IoT 디바이스
-- ============================================================

CREATE TABLE IF NOT EXISTS iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  meter_id UUID REFERENCES meters(id) ON DELETE SET NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'sensor' CHECK (device_type IN ('sensor', 'gateway')),
  protocol TEXT NOT NULL DEFAULT 'rest' CHECK (protocol IN ('rest', 'mqtt')),
  api_key TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  last_seen_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_site ON iot_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_api_key ON iot_devices(api_key);

-- ============================================================
-- 이상 감지
-- ============================================================

CREATE TABLE IF NOT EXISTS anomaly_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('spike', 'drop', 'pattern_change')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  expected_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  z_score NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_meter ON anomaly_detections(meter_id, detected_at DESC);

-- ============================================================
-- 초기 배출계수 데이터 (환경부 2024-2025 공식 데이터)
-- ============================================================

INSERT INTO emission_factors (energy_type, factor_value, factor_unit, year, source) VALUES
  ('electricity', 0.4781, 'tCO2eq/MWh', 2024, '환경부 국가 온실가스 인벤토리'),
  ('electricity', 0.4600, 'tCO2eq/MWh', 2025, '환경부 국가 온실가스 인벤토리 (추정)'),
  ('electricity', 0.4500, 'tCO2eq/MWh', 2026, '환경부 국가 온실가스 인벤토리 (추정)'),
  ('gas', 2.176, 'tCO2eq/1000m3', 2024, '환경부 국가 온실가스 인벤토리'),
  ('gas', 2.176, 'tCO2eq/1000m3', 2025, '환경부 국가 온실가스 인벤토리'),
  ('gas', 2.176, 'tCO2eq/1000m3', 2026, '환경부 국가 온실가스 인벤토리'),
  ('water', 0.237, 'tCO2eq/1000ton', 2024, '환경부 국가 온실가스 인벤토리'),
  ('water', 0.237, 'tCO2eq/1000ton', 2025, '환경부 국가 온실가스 인벤토리'),
  ('water', 0.237, 'tCO2eq/1000ton', 2026, '환경부 국가 온실가스 인벤토리')
ON CONFLICT (energy_type, year) DO NOTHING;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reduction_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detections ENABLE ROW LEVEL SECURITY;

-- 배출계수: 모든 인증 사용자가 읽기 가능 (공용 데이터)
CREATE POLICY "emission_factors_select_all" ON emission_factors FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 탄소 배출량: 본인 사업장만
CREATE POLICY "carbon_emissions_select_own" ON carbon_emissions FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "carbon_emissions_insert_own" ON carbon_emissions FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "carbon_emissions_delete_own" ON carbon_emissions FOR DELETE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- 감축 목표: 본인 사업장만
CREATE POLICY "reduction_targets_select_own" ON reduction_targets FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "reduction_targets_insert_own" ON reduction_targets FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "reduction_targets_update_own" ON reduction_targets FOR UPDATE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "reduction_targets_delete_own" ON reduction_targets FOR DELETE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- IoT 디바이스: 본인 사업장만
CREATE POLICY "iot_devices_select_own" ON iot_devices FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "iot_devices_insert_own" ON iot_devices FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "iot_devices_update_own" ON iot_devices FOR UPDATE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "iot_devices_delete_own" ON iot_devices FOR DELETE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- 이상 감지: 본인 사업장의 계측기만
CREATE POLICY "anomaly_detections_select_own" ON anomaly_detections FOR SELECT
  USING (meter_id IN (SELECT m.id FROM meters m JOIN sites s ON m.site_id = s.id WHERE s.user_id = auth.uid()));
CREATE POLICY "anomaly_detections_update_own" ON anomaly_detections FOR UPDATE
  USING (meter_id IN (SELECT m.id FROM meters m JOIN sites s ON m.site_id = s.id WHERE s.user_id = auth.uid()));
CREATE POLICY "anomaly_detections_insert_own" ON anomaly_detections FOR INSERT
  WITH CHECK (meter_id IN (SELECT m.id FROM meters m JOIN sites s ON m.site_id = s.id WHERE s.user_id = auth.uid()));
