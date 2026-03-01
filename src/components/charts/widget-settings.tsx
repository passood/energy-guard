"use client"

import { useEffect, useState, type JSX } from "react"
import { ChevronDown, ChevronUp, Eye, EyeOff, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveDashboardPreference } from "@/app/(dashboard)/dashboard-actions"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { WIDGET_TYPES } from "@/lib/constants"
import type { WidgetType } from "@/types/database"

interface WidgetSettingsProps {
  currentOrder: WidgetType[]
  hiddenWidgets: WidgetType[]
}

const DEFAULT_WIDGET_ORDER = Object.keys(WIDGET_TYPES) as WidgetType[]
const WIDGET_TYPE_SET = new Set<WidgetType>(DEFAULT_WIDGET_ORDER)

function normalizeWidgetOrder(widgetOrder: WidgetType[]): WidgetType[] {
  const uniqueWidgetOrder: WidgetType[] = []
  const includedWidgets = new Set<WidgetType>()

  widgetOrder.forEach((widget) => {
    if (!WIDGET_TYPE_SET.has(widget) || includedWidgets.has(widget)) {
      return
    }

    includedWidgets.add(widget)
    uniqueWidgetOrder.push(widget)
  })

  DEFAULT_WIDGET_ORDER.forEach((widget) => {
    if (includedWidgets.has(widget)) {
      return
    }

    uniqueWidgetOrder.push(widget)
  })

  return uniqueWidgetOrder
}

function normalizeHiddenWidgets(hiddenWidgets: WidgetType[]): WidgetType[] {
  const uniqueHiddenWidgets: WidgetType[] = []
  const hiddenWidgetSet = new Set<WidgetType>()

  hiddenWidgets.forEach((widget) => {
    if (!WIDGET_TYPE_SET.has(widget) || hiddenWidgetSet.has(widget)) {
      return
    }

    hiddenWidgetSet.add(widget)
    uniqueHiddenWidgets.push(widget)
  })

  return uniqueHiddenWidgets
}

export function WidgetSettings(props: WidgetSettingsProps): JSX.Element {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [widgetOrder, setWidgetOrder] = useState<WidgetType[]>(() =>
    normalizeWidgetOrder(props.currentOrder)
  )
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetType[]>(() =>
    normalizeHiddenWidgets(props.hiddenWidgets)
  )

  useEffect(() => {
    setWidgetOrder(normalizeWidgetOrder(props.currentOrder))
    setHiddenWidgets(normalizeHiddenWidgets(props.hiddenWidgets))
  }, [props.currentOrder, props.hiddenWidgets])

  function handleOpenChange(open: boolean): void {
    setIsOpen(open)

    if (!open) {
      return
    }

    setWidgetOrder(normalizeWidgetOrder(props.currentOrder))
    setHiddenWidgets(normalizeHiddenWidgets(props.hiddenWidgets))
  }

  function moveWidget(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= widgetOrder.length) {
      return
    }

    setWidgetOrder((current) => {
      const next = [...current]
      const targetWidget = next[targetIndex]

      next[targetIndex] = next[index]
      next[index] = targetWidget

      return next
    })
  }

  function toggleWidgetVisibility(widget: WidgetType): void {
    setHiddenWidgets((current) =>
      current.includes(widget)
        ? current.filter((currentWidget) => currentWidget !== widget)
        : [...current, widget]
    )
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true)

    try {
      const result = await saveDashboardPreference(widgetOrder, hiddenWidgets)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("대시보드 설정이 저장되었습니다.")
      setIsOpen(false)
      router.refresh()
    } catch {
      toast.error("대시보드 설정 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="대시보드 설정">
          <Settings className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>대시보드 위젯 설정</SheetTitle>
          <SheetDescription>
            위젯 표시 여부를 바꾸고 화살표 버튼으로 표시 순서를 조정하세요.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {widgetOrder.map((widget, index) => {
            const isHidden = hiddenWidgets.includes(widget)

            return (
              <div
                key={widget}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {isHidden ? (
                      <EyeOff className="text-muted-foreground size-4" />
                    ) : (
                      <Eye className="text-primary size-4" />
                    )}
                    <span>{WIDGET_TYPES[widget]}</span>
                  </p>
                  <label className="text-muted-foreground flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggleWidgetVisibility(widget)}
                      disabled={isSaving}
                      className="size-4 rounded border"
                    />
                    {isHidden ? "숨김" : "표시"}
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveWidget(index, -1)}
                    disabled={index === 0 || isSaving}
                    aria-label="위로 이동"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveWidget(index, 1)}
                    disabled={index === widgetOrder.length - 1 || isSaving}
                    aria-label="아래로 이동"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <SheetFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
          >
            취소
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
