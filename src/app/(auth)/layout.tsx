import type { JSX, ReactNode } from "react"

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-50">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-10">
        <section className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
              Energy Management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">EnergyGuard</h1>
          </div>
          {children}
        </section>
      </main>
    </div>
  )
}
