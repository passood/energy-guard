"use client"

import { LogOutIcon, MenuIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { JSX } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

export function Header(): JSX.Element {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleMobileSidebarToggle = () => {
    document.getElementById("mobile-sidebar-trigger")?.click()
  }

  const handleSignOut = async () => {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      router.replace("/login")
      router.refresh()
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={handleMobileSidebarToggle}
          aria-label="메뉴 열기"
        >
          <MenuIcon className="size-5" />
        </Button>
        <p className="text-sm text-muted-foreground">에너지 관리 시스템</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto rounded-full px-2 py-1.5"
          >
            <Avatar size="sm">
              <AvatarFallback>관</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">관리자</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
            <LogOutIcon className="size-4" />
            <span>{isSigningOut ? "로그아웃 중..." : "로그아웃"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
