"use client"

import { useState } from "react"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { get, set, del } from "idb-keyval"
import { ThemeProvider } from "next-themes"

const DB_KEY = "keim-os-query-cache"

const idbStorage = {
  getItem: (key: string) => get<string>(key).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
}

const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: DB_KEY,
})

const FOURTEEN_DAYS = 1000 * 60 * 60 * 24 * 14
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            gcTime: FOURTEEN_DAYS,
          },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: SEVEN_DAYS,
          buster: "v1",
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              const key = query.queryKey[0]
              if (typeof key === "string" && key.startsWith("auth")) return false
              return query.state.status === "success"
            },
          },
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </ThemeProvider>
  )
}
