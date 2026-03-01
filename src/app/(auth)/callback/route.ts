import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

function redirectToLogin(request: NextRequest, message: string): NextResponse {
  const redirectUrl = new URL("/login", request.url)
  redirectUrl.searchParams.set("error", message)

  return NextResponse.redirect(redirectUrl)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code")

  if (!code) {
    return redirectToLogin(request, "인증 코드가 없어 로그인을 완료할 수 없습니다.")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: exchangeError,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !user || !user.email) {
    return redirectToLogin(request, "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.")
  }

  const emailLocalPart = user.email.split("@")[0]
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? emailLocalPart
  const name = String(metadataName).trim() || emailLocalPart
  const avatarUrl = user.user_metadata?.avatar_url ? String(user.user_metadata.avatar_url) : null

  const { error: upsertError } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      name,
      role: "admin",
      avatar_url: avatarUrl,
    },
    { onConflict: "id" }
  )

  if (upsertError) {
    return redirectToLogin(request, "사용자 정보를 저장하지 못했습니다. 다시 시도해 주세요.")
  }

  const dashboardUrl = new URL("/", request.url)

  return NextResponse.redirect(dashboardUrl)
}
