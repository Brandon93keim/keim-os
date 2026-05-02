"use client"

import { useState } from "react"
import { Plus, Search, Users } from "lucide-react"
import { useClients } from "@/lib/hooks/useClients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientCard } from "./ClientCard"
import { ClientFormSheet } from "./ClientFormSheet"
import type { Client } from "@/lib/queries/clients"

type StatusFilter = "all" | "prospect" | "active" | "archived"

function ListSkeleton() {
  return (
    <div className="space-y-2 px-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function EmptyState({
  onNew,
  filtered,
}: {
  onNew: () => void
  filtered: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 pt-20 text-center">
      <div className="rounded-full bg-muted p-4">
        <Users size={28} className="text-muted-foreground" />
      </div>
      {filtered ? (
        <>
          <p className="font-medium">No clients match</p>
          <p className="text-sm text-muted-foreground">
            Try a different search or filter.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">No clients yet</p>
          <p className="text-sm text-muted-foreground">
            Add your first client to get started.
          </p>
          <Button onClick={onNew} className="gap-2">
            <Plus size={16} />
            Add your first client
          </Button>
        </>
      )}
    </div>
  )
}

function filterClients(
  clients: Client[],
  search: string,
  status: StatusFilter
): Client[] {
  let result = clients

  if (status !== "all") {
    result = result.filter((c) => c.status === status)
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }

  return result
}

export function ClientList() {
  const { data: clients, isLoading, error } = useClients()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = filterClients(clients ?? [], search, statusFilter)
  const isFiltered = search.trim().length > 0 || statusFilter !== "all"

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h1 className="text-2xl font-semibold">Clients</h1>
          <Button
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder="Search name, company, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="px-4 pb-3">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="prospect" className="flex-1">
                Prospects
              </TabsTrigger>
              <TabsTrigger value="active" className="flex-1">
                Active
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex-1">
                Archived
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Body */}
      <div className="py-3">
        {isLoading && <ListSkeleton />}

        {error && (
          <div className="px-4 py-8 text-center text-sm text-destructive">
            Failed to load clients. Pull to refresh.
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <EmptyState
            onNew={() => setCreateOpen(true)}
            filtered={isFiltered && (clients?.length ?? 0) > 0}
          />
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="space-y-2 px-4">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>

      {/* Create sheet */}
      <ClientFormSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  )
}
