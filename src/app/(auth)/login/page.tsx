export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Keim OS</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        {/* Auth form — Phase 2 */}
        <p className="text-center text-xs text-muted-foreground">
          Auth flow coming in Phase 2
        </p>
      </div>
    </div>
  )
}
