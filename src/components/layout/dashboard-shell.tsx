import type React from "react"
import type { JSX } from "react"

interface DashboardShellProps {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function DashboardShell({
  title,
  description,
  children,
  action,
}: DashboardShellProps): JSX.Element {
  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
