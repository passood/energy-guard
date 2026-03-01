import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"

const LOGIN_PATH = "/login"
const CALLBACK_PATH = "/callback"
const DASHBOARD_PATH = "/"

function applyCookies(source: NextResponse, target: NextResponse): void {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname === LOGIN_PATH
  const isCallbackRoute = pathname === CALLBACK_PATH
  const isProtectedRoute = !isLoginRoute && !isCallbackRoute && !pathname.startsWith("/api")

  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = LOGIN_PATH
    redirectUrl.searchParams.set("error", "로그인이 필요합니다.")

    const redirectResponse = NextResponse.redirect(redirectUrl)
    applyCookies(response, redirectResponse)

    return redirectResponse
  }

  if (user && isLoginRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = DASHBOARD_PATH
    redirectUrl.search = ""

    const redirectResponse = NextResponse.redirect(redirectUrl)
    applyCookies(response, redirectResponse)

    return redirectResponse
  }

  return response
}

export const config: { matcher: string[] } = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
}
