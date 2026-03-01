"use client"

import { Suspense, useState, type JSX } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type OAuthProvider = "google" | "kakao"

function LoginForm(): JSX.Element {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const handleOAuthLogin = async (provider: OAuthProvider): Promise<void> => {
    if (loadingProvider) {
      return
    }

    setErrorMessage("")
    setLoadingProvider(provider)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    })

    if (error) {
      setErrorMessage("로그인 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
      setLoadingProvider(null)
    }
  }

  const displayError = errorMessage || searchParams.get("error") || ""

  return (
    <Card className="w-full max-w-md border-slate-200/80 bg-white/95 shadow-xl backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
          EnergyGuard
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-slate-600">
          다소비 사업장 에너지 현황을 안전하게 관리하려면 로그인해 주세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          onClick={() => void handleOAuthLogin("google")}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === "google" ? "Google 로그인 중..." : "Google로 로그인"}
        </Button>
        <Button
          variant="outline"
          className="w-full border-yellow-300 bg-yellow-200 text-slate-900 hover:bg-yellow-300"
          onClick={() => void handleOAuthLogin("kakao")}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === "kakao" ? "Kakao 로그인 중..." : "Kakao로 로그인"}
        </Button>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {displayError ? (
          <p className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            {displayError}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">계정이 없으면 소셜 로그인 후 자동으로 가입됩니다.</p>
      </CardFooter>
    </Card>
  )
}

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-md border-slate-200/80 bg-white/95 shadow-xl backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">EnergyGuard</CardTitle>
          <CardDescription className="text-sm text-slate-600">로딩 중...</CardDescription>
        </CardHeader>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  )
}
