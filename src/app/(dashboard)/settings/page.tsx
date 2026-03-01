import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
        <p className="text-muted-foreground text-sm">
          운영 설정을 관리하는 허브입니다. 기능은 계속 확장될 예정입니다.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>사용자 관리</CardTitle>
            <CardDescription>
              사용자 초대, 역할(admin/viewer) 변경, 삭제를 수행합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              관리자만 접근 가능한 관리 화면입니다.
            </p>
            <Button asChild>
              <Link href="/settings/users">바로가기</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
