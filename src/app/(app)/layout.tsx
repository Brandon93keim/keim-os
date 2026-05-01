import { BottomNav } from "@/components/layout/BottomNav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          // Bottom padding to clear the fixed nav bar (56px) + safe area
          paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
