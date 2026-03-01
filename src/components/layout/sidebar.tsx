"use client"

import type { LucideIcon } from "lucide-react"
import {
  ActivityIcon,
  BarChart3Icon,
  BellIcon,
  BuildingIcon,
  CpuIcon,
  DollarSignIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  LeafIcon,
  ScrollTextIcon,
  SettingsIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { JSX } from "react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface NavigationItem {
  href: string
  icon: LucideIcon
  label: string
}

const navigationItems: NavigationItem[] = [
  { href: "/", icon: HomeIcon, label: "대시보드" },
  { href: "/sites", icon: BuildingIcon, label: "사업장 관리" },
  { href: "/meters", icon: GaugeIcon, label: "계측기 관리" },
  { href: "/data", icon: FileSpreadsheetIcon, label: "데이터 입력" },
  { href: "/costs", icon: DollarSignIcon, label: "비용 관리" },
  { href: "/comparison", icon: BarChart3Icon, label: "사업장 비교" },
  { href: "/carbon", icon: LeafIcon, label: "탄소 배출" },
  { href: "/predictions", icon: ActivityIcon, label: "AI 예측" },
  { href: "/regulations", icon: ScrollTextIcon, label: "법규 보고서" },
  { href: "/iot", icon: CpuIcon, label: "IoT 관리" },
  { href: "/reports", icon: FileTextIcon, label: "리포트" },
  { href: "/alerts", icon: BellIcon, label: "알림" },
  { href: "/settings", icon: SettingsIcon, label: "설정" },
]

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarNavigation({ isMobile }: { isMobile: boolean }): JSX.Element {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {navigationItems.map((item) => {
        const Icon = item.icon
        const active = isActivePath(pathname, item.href)
        const link = (
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        )

        if (!isMobile) {
          return <div key={item.href}>{link}</div>
        }

        return (
          <SheetClose asChild key={item.href}>
            {link}
          </SheetClose>
        )
      })}
    </nav>
  )
}

export function Sidebar(): JSX.Element {
  return (
    <>
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-60 md:flex-col md:border-r md:bg-background">
        <div className="border-b px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            EnergyGuard
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNavigation isMobile={false} />
        </div>
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <button id="mobile-sidebar-trigger" type="button" className="hidden" aria-label="메뉴 열기" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-left text-lg font-semibold tracking-tight">
              EnergyGuard
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <SidebarNavigation isMobile={true} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
