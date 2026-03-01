import type React from "react"
import type { JSX } from "react"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/sonner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar />
      <div className="flex min-h-screen flex-col md:pl-60">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}
