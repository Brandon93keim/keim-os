import { BUSINESSES } from "@/lib/constants"

export default function DashboardPage() {
  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to Keim OS</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Businesses
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {BUSINESSES.map((biz) => (
            <div
              key={biz.id}
              className="flex items-center gap-3 rounded-xl p-4"
              style={{ backgroundColor: biz.color }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: biz.textColor }}
              >
                {biz.name}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
