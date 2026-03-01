import type { JSX, ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface SummaryCardProps {
  title: string
  value: string | number
  unit?: string
  change?: number
  icon: ReactNode
}

const valueFormatter = new Intl.NumberFormat("ko-KR")
const changeFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 1,
})

export function SummaryCard({
  title,
  value,
  unit,
  change,
  icon,
}: SummaryCardProps): JSX.Element {
  const numericValue = Number(value)
  const displayValue = Number.isNaN(numericValue)
    ? String(value)
    : valueFormatter.format(numericValue)

  const hasChange = change !== undefined
  const absChange = hasChange ? Math.abs(change) : 0
  const changeText = `${changeFormatter.format(absChange)}%`

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0">
        <p className="text-muted-foreground text-sm">{title}</p>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-end gap-1">
          <p className="text-3xl leading-none font-semibold tracking-tight">
            {displayValue}
          </p>
          {unit ? (
            <span className="text-muted-foreground text-sm font-medium">
              {unit}
            </span>
          ) : null}
        </div>

        {hasChange ? (
          <p
            className={
              change > 0
                ? "text-sm font-medium text-emerald-600"
                : change < 0
                  ? "text-sm font-medium text-red-600"
                  : "text-muted-foreground text-sm font-medium"
            }
          >
            {change > 0 ? `▲ ${changeText}` : change < 0 ? `▼ ${changeText}` : changeText}
          </p>
        ) : (
          <div className="h-5" aria-hidden="true" />
        )}
      </CardContent>
    </Card>
  )
}
