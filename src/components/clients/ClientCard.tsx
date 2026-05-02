"use client"

import Link from "next/link"
import { getBusinessById } from "@/lib/constants"
import { StatusBadge } from "./StatusBadge"
import type { Client } from "@/lib/queries/clients"

export function ClientCard({ client }: { client: Client }) {
  return (
    <Link href={`/clients/${client.id}`} className="block">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 min-h-[64px] active:bg-muted transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base leading-snug truncate">
            {client.name}
          </p>
          {client.company && (
            <p className="text-sm text-muted-foreground truncate">
              {client.company}
            </p>
          )}
          {client.business_ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {client.business_ids.map((bizId) => {
                const biz = getBusinessById(bizId)
                if (!biz) return null
                return (
                  <span
                    key={bizId}
                    title={biz.name}
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: biz.color }}
                  />
                )
              })}
            </div>
          )}
        </div>
        <StatusBadge status={client.status} className="shrink-0" />
      </div>
    </Link>
  )
}
