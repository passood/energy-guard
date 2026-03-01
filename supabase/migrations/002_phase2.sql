-- EnergyGuard Phase 2 스키마 추가
-- 에너지 비용 관리 + 대시보드 커스터마이징

-- Energy Costs (에너지 비용)
CREATE TABLE IF NOT EXISTS energy_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  energy_type TEXT NOT NULL CHECK (energy_type IN ('electricity', 'gas', 'water')),
  amount_kwh NUMERIC NOT NULL DEFAULT 0,
  cost_krw NUMERIC NOT NULL DEFAULT 0,
  rate_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_energy_costs_site ON energy_costs(site_id, period_start DESC);

-- Dashboard Preferences (대시보드 커스터마이징)
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  widget_order JSONB NOT NULL DEFAULT '["summary","usage_line","usage_bar","yoy_comparison","cost_summary","site_comparison"]',
  hidden_widgets JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE energy_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Energy Costs: 본인 사업장의 비용 데이터만
CREATE POLICY "energy_costs_select_own" ON energy_costs FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "energy_costs_insert_own" ON energy_costs FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "energy_costs_update_own" ON energy_costs FOR UPDATE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "energy_costs_delete_own" ON energy_costs FOR DELETE
  USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Dashboard Preferences: 본인 설정만
CREATE POLICY "dashboard_prefs_select_own" ON dashboard_preferences FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "dashboard_prefs_insert_own" ON dashboard_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dashboard_prefs_update_own" ON dashboard_preferences FOR UPDATE
  USING (user_id = auth.uid());
