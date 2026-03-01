import Link from "next/link"
import { requireAdmin } from "@/lib/auth-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UserRole } from "@/types/database"
import { getTeamUsers, inviteUser, removeUser, updateUserRole } from "./actions"

const joinedDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function getRoleLabel(role: UserRole): string {
  return role === "admin" ? "관리자" : "조회 전용"
}

function getRoleBadgeClassName(role: UserRole): string {
  return role === "admin"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-slate-200 bg-slate-50 text-slate-700"
}

function formatJoinedDate(dateString: string): string {
  return joinedDateFormatter.format(new Date(dateString))
}

async function updateUserRoleAction(formData: FormData): Promise<void> {
  "use server"

  const userId = formData.get("user_id")?.toString().trim() ?? ""
  const roleValue = formData.get("role")?.toString().trim() ?? ""

  if (!userId) {
    return
  }

  if (roleValue !== "admin" && roleValue !== "viewer") {
    return
  }

  await updateUserRole(userId, roleValue)
}

async function inviteUserAction(formData: FormData): Promise<void> {
  "use server"

  await inviteUser(formData)
}

async function removeUserAction(formData: FormData): Promise<void> {
  "use server"

  const userId = formData.get("user_id")?.toString().trim() ?? ""

  if (!userId) {
    return
  }

  await removeUser(userId)
}

export default async function SettingsUsersPage() {
  const currentUser = await requireAdmin()
  const { data: users, error } = await getTeamUsers()

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">사용자 관리</h1>
          <p className="text-muted-foreground text-sm">
            팀 사용자를 초대하고 역할을 관리합니다.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">설정 메인으로</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>사용자 초대</CardTitle>
          <CardDescription>이메일과 역할을 지정해 사용자를 사전 등록합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={inviteUserAction}
            className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_170px_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-sm font-medium">
                이메일
              </label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={120}
                placeholder="member@company.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="text-sm font-medium">
                역할
              </label>
              <Select defaultValue="viewer" name="role">
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="viewer">조회 전용</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="sm:w-auto">
              초대
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>팀 사용자 목록</CardTitle>
          <CardDescription>
            역할 변경과 사용자 삭제는 관리자 권한에서만 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              등록된 사용자가 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUser.id

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name.trim() === "" ? "-" : user.name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getRoleBadgeClassName(user.role)}
                        >
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatJoinedDate(user.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <form
                            action={updateUserRoleAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="user_id" value={user.id} />
                            <Select
                              defaultValue={user.role}
                              disabled={isCurrentUser}
                              name="role"
                            >
                              <SelectTrigger className="h-8 min-w-32">
                                <SelectValue placeholder="역할 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">관리자</SelectItem>
                                <SelectItem value="viewer">조회 전용</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={isCurrentUser}
                            >
                              변경
                            </Button>
                          </form>

                          {isCurrentUser ? (
                            <Button size="sm" variant="destructive" disabled>
                              본인 삭제 불가
                            </Button>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  삭제
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>사용자를 삭제할까요?</DialogTitle>
                                  <DialogDescription>
                                    삭제 후에는 복구할 수 없습니다.
                                  </DialogDescription>
                                </DialogHeader>
                                <form
                                  action={removeUserAction}
                                  className="space-y-4"
                                >
                                  <input type="hidden" name="user_id" value={user.id} />
                                  <p className="text-sm">
                                    대상: <span className="font-medium">{user.email}</span>
                                  </p>
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button type="button" variant="outline">
                                        취소
                                      </Button>
                                    </DialogClose>
                                    <Button type="submit" variant="destructive">
                                      삭제
                                    </Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
