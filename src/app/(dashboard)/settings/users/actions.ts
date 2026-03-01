"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import type { User, UserRole } from "@/types/database"

function parseRole(value: string): UserRole | null {
  if (value === "admin" || value === "viewer") {
    return value
  }

  return null
}

function getNameFromEmail(email: string): string {
  const [name] = email.split("@")

  if (!name || name.trim() === "") {
    return "신규 사용자"
  }

  return name.trim()
}

export async function getTeamUsers(): Promise<{ data: User[]; error?: string }> {
  await requireAdmin()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return { data: [], error: "사용자 목록을 불러오지 못했습니다." }
  }

  return { data: (data ?? []) as User[] }
}

export async function inviteUser(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin()

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? ""
  const roleValue = formData.get("role")?.toString().trim() ?? ""
  const role = parseRole(roleValue)

  if (!email) {
    return { error: "이메일을 입력해주세요." }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "올바른 이메일 형식을 입력해주세요." }
  }

  if (!role) {
    return { error: "역할을 선택해주세요." }
  }

  const supabase = await createClient()
  const { data: existingUser, error: existingError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existingError) {
    return { error: "기존 사용자 확인 중 오류가 발생했습니다." }
  }

  if (existingUser) {
    return { error: "이미 등록된 이메일입니다." }
  }

  const { error } = await supabase.from("users").insert({
    id: crypto.randomUUID(),
    email,
    name: getNameFromEmail(email),
    role,
    avatar_url: null,
  } as never)

  if (error) {
    return { error: "사용자 초대 등록에 실패했습니다." }
  }

  revalidatePath("/settings/users")
  return {}
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ error?: string }> {
  const currentUser = await requireAdmin()

  if (userId.trim() === "") {
    return { error: "변경할 사용자를 찾을 수 없습니다." }
  }

  if (userId === currentUser.id) {
    return { error: "자기 자신의 역할은 변경할 수 없습니다." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .update({ role } as never)
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "사용자 역할 변경에 실패했습니다." }
  }

  if (!data) {
    return { error: "해당 사용자를 찾을 수 없습니다." }
  }

  revalidatePath("/settings/users")
  return {}
}

export async function removeUser(userId: string): Promise<{ error?: string }> {
  const currentUser = await requireAdmin()

  if (userId.trim() === "") {
    return { error: "삭제할 사용자를 찾을 수 없습니다." }
  }

  if (userId === currentUser.id) {
    return { error: "자기 자신은 삭제할 수 없습니다." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: "사용자 삭제에 실패했습니다." }
  }

  if (!data) {
    return { error: "해당 사용자를 찾을 수 없습니다." }
  }

  revalidatePath("/settings/users")
  return {}
}
