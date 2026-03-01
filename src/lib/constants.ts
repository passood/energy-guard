// 에너지 유형별 설정
export const ENERGY_TYPES = {
  electricity: { label: "전기", unit: "kWh", color: "#3b82f6" },
  gas: { label: "가스", unit: "m3", color: "#f59e0b" },
  water: { label: "수도", unit: "ton", color: "#06b6d4" },
} as const

export const BUILDING_TYPES = {
  office: "사무실",
  factory: "공장",
  commercial: "상업시설",
  other: "기타",
} as const

export const CONDITION_TYPES = {
  exceeds: "초과",
  drops_below: "미만",
  rate_of_change: "변화율",
} as const

export const TIME_WINDOWS = {
  hourly: "시간별",
  daily: "일별",
  monthly: "월별",
} as const

export const ALERT_STATUSES = {
  triggered: "발생",
  acknowledged: "확인",
  resolved: "해결",
} as const

export const DATA_SOURCES = {
  manual: "수동 입력",
  excel_upload: "엑셀 업로드",
  api: "API 연동",
} as const

// Phase 2 상수

export const RATE_TYPES = {
  industrial_a: "산업용(갑)",
  industrial_b: "산업용(을)",
  general: "일반용",
  educational: "교육용",
  other: "기타",
} as const

export const WIDGET_TYPES = {
  summary: "요약 카드",
  usage_line: "사용량 추이",
  usage_bar: "에너지원별 사용량",
  yoy_comparison: "전년 동기 대비",
  cost_summary: "비용 요약",
  site_comparison: "사업장 비교",
} as const

// 엑셀 업로드 제한
export const MAX_EXCEL_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Phase 3 상수

// 탄소 배출계수 기본값 (환경부 2024 기준, DB에도 저장됨)
export const DEFAULT_EMISSION_FACTORS = {
  electricity: { value: 0.4781, unit: "tCO2eq/MWh", conversionFromKwh: 0.001 },
  gas: { value: 2.176, unit: "tCO2eq/1000m3", conversionFromM3: 0.001 },
  water: { value: 0.237, unit: "tCO2eq/1000ton", conversionFromTon: 0.001 },
} as const

export const ANOMALY_TYPES = {
  spike: "급증",
  drop: "급감",
  pattern_change: "패턴 변화",
} as const

export const SEVERITY_LEVELS = {
  low: { label: "낮음", color: "#22c55e" },
  medium: { label: "보통", color: "#f59e0b" },
  high: { label: "높음", color: "#ef4444" },
} as const

export const DEVICE_TYPES = {
  sensor: "센서",
  gateway: "게이트웨이",
} as const

export const IOT_PROTOCOLS = {
  rest: "REST API",
  mqtt: "MQTT",
} as const

// 에너지이용합리화법 관련 상수
export const REGULATION_REPORT_TYPES = {
  energy_use: "에너지 사용량 신고서",
  egtips: "EG-TIPS 데이터",
} as const

// 위젯 타입 확장 (Phase 3)
export const WIDGET_TYPES_PHASE3 = {
  ...WIDGET_TYPES,
  carbon_overview: "탄소 배출 현황",
  anomaly_summary: "이상 감지 요약",
} as const
