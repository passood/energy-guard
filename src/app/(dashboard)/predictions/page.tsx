import type { JSX } from "react"
import { getMeters } from "@/app/(dashboard)/meters/actions"
import { getSites } from "@/app/(dashboard)/sites/actions"
import { AnomalyPanel } from "@/components/charts/anomaly-timeline"
import { PredictionPanel } from "@/components/charts/prediction-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAnomalyHistory } from "./actions"

interface PredictionsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSingleSearchParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default async function PredictionsPage({
  searchParams,
}: PredictionsPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = (await searchParams) ?? {}
  const requestedSiteId = getSingleSearchParam(resolvedSearchParams.siteId)
  const requestedTab = getSingleSearchParam(resolvedSearchParams.tab)

  const [sites, meters] = await Promise.all([getSites(), getMeters()])

  const selectedSiteId =
    requestedSiteId && sites.some((site) => site.id === requestedSiteId)
      ? requestedSiteId
      : sites[0]?.id
  const activeTab = requestedTab === "anomalies" ? "anomalies" : "predictions"

  const anomalyHistoryResult = selectedSiteId
    ? await getAnomalyHistory(selectedSiteId)
    : { data: [] }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">AI 사용량 예측 및 이상 감지</h1>
        <p className="text-muted-foreground text-sm">
          AI 예측으로 향후 사용량을 확인하고, 이상 탐지로 급증/급감 패턴을 빠르게 파악하세요.
        </p>
      </header>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="predictions" className="w-auto px-4">
            AI 예측
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="w-auto px-4">
            이상 감지
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="mt-4">
          <PredictionPanel
            sites={sites.map((site) => ({ id: site.id, name: site.name }))}
            meters={meters.map((meter) => ({
              id: meter.id,
              site_id: meter.site_id,
              name: meter.name,
            }))}
            initialSiteId={selectedSiteId}
          />
        </TabsContent>

        <TabsContent value="anomalies" className="mt-4">
          {anomalyHistoryResult.error ? (
            <Card>
              <CardHeader>
                <CardTitle>이상 감지 이력 조회 오류</CardTitle>
                <CardDescription>
                  데이터를 불러오는 중 문제가 발생했습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{anomalyHistoryResult.error}</p>
              </CardContent>
            </Card>
          ) : (
            <AnomalyPanel
              sites={sites.map((site) => ({ id: site.id, name: site.name }))}
              meters={meters.map((meter) => ({
                id: meter.id,
                site_id: meter.site_id,
                name: meter.name,
              }))}
              initialSiteId={selectedSiteId}
              initialAnomalies={anomalyHistoryResult.data}
            />
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
