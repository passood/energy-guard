import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types/database"

type CurrentUser = {
  id: string
  email: string
  role: UserRole
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      id: user.id,
      email: user.email ?? "",
      role: "viewer",
    }
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
  }
}

export async function requireAdmin(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== "admin") {
    redirect("/")
  }

  return currentUser
}
