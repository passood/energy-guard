import { Resend } from 'resend'

interface AlertEmailParams {
  to: string
  ruleName: string
  siteName: string
  actualValue: number
  thresholdValue: number
  thresholdUnit: string
  conditionType: string
  triggeredAt: string
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatConditionType = (conditionType: string): string => {
  const normalized = conditionType.trim().toLowerCase()

  if (
    normalized === 'gt' ||
    normalized === 'greater_than' ||
    normalized === 'over' ||
    normalized === 'exceed' ||
    normalized === '초과'
  ) {
    return '초과'
  }

  if (
    normalized === 'lt' ||
    normalized === 'less_than' ||
    normalized === 'under' ||
    normalized === 'below' ||
    normalized === '미만'
  ) {
    return '미만'
  }

  if (
    normalized === 'rate_change' ||
    normalized === 'change_rate' ||
    normalized === 'delta_rate' ||
    normalized === '변화율'
  ) {
    return '변화율'
  }

  return conditionType
}

export async function sendAlertEmail(
  params: AlertEmailParams,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? ''

  if (!apiKey) {
    console.warn('RESEND_API_KEY가 설정되지 않았습니다. 이메일을 발송하지 않습니다.')
    return { success: true }
  }

  const resend = new Resend(apiKey)
  const subject = `[EnergyGuard] 에너지 사용량 알림 - ${params.ruleName}`
  const ruleName = escapeHtml(params.ruleName)
  const siteName = escapeHtml(params.siteName)
  const thresholdUnit = escapeHtml(params.thresholdUnit)
  const conditionType = escapeHtml(formatConditionType(params.conditionType))
  const triggeredAt = escapeHtml(params.triggeredAt)
  const actualValue = params.actualValue.toLocaleString('ko-KR')
  const thresholdValue = params.thresholdValue.toLocaleString('ko-KR')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111827; background: #f9fafb; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
        <h1 style="margin: 0 0 16px; font-size: 20px;">에너지 사용량 알림</h1>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">알림 규칙명</td>
            <td style="padding: 8px 0; font-weight: 600;">${ruleName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">사업장명</td>
            <td style="padding: 8px 0;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">실제 사용량</td>
            <td style="padding: 8px 0;">${actualValue} ${thresholdUnit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">임계값</td>
            <td style="padding: 8px 0;">${thresholdValue} ${thresholdUnit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">조건 유형</td>
            <td style="padding: 8px 0;">${conditionType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">발생 시각</td>
            <td style="padding: 8px 0;">${triggeredAt}</td>
          </tr>
        </table>
        <p style="margin: 20px 0 0; font-size: 13px; color: #4b5563;">EnergyGuard 대시보드에서 상세 확인하세요.</p>
      </div>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'EnergyGuard <onboarding@resend.dev>',
      to: params.to,
      subject,
      html,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '이메일 발송 중 알 수 없는 오류가 발생했습니다.',
    }
  }
}
