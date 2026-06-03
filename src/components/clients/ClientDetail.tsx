"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Mail,
  Phone,
  Building2,
  MapPin,
  Tag,
  ChevronDown,
  ChevronUp,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react"
import { useClient, useArchiveClient, useUnarchiveClient, useDeleteClient } from "@/lib/hooks/useClients"
import { getBusinessById } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { StatusBadge } from "./StatusBadge"
import { ClientFormSheet } from "./ClientFormSheet"

function DetailRow({
  icon: Icon,
  children,
  href,
}: {
  icon: React.ElementType
  children: React.ReactNode
  href?: string
}) {
  const inner = (
    <div className="flex items-start gap-3 py-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="text-sm">{children}</span>
    </div>
  )
  if (href) {
    return (
      <a href={href} className="block hover:text-primary transition-colors">
        {inner}
      </a>
    )
  }
  return inner
}

function DetailSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="ml-auto h-8 w-14 rounded" />
      </div>
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function ClientDetail({ id }: { id: string }) {
  const router = useRouter()
  const { data: client, isLoading, error } = useClient(id)
  const archive = useArchiveClient()
  const unarchive = useUnarchiveClient()
  const deleteClient = useDeleteClient()
  const [editOpen, setEditOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)

  if (isLoading) return <DetailSkeleton />

  if (error || !client) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-4 pt-20">
        <p className="text-muted-foreground">Client not found.</p>
        <Button variant="outline" asChild>
          <Link href="/clients">Back to clients</Link>
        </Button>
      </div>
    )
  }

  const linkedBusinesses = client.business_ids
    .map(getBusinessById)
    .filter(Boolean)

  const addressParts = [
    client.address_line1,
    client.address_line2,
    [client.city, client.state].filter(Boolean).join(", "),
    [client.postal_code, client.country !== "US" ? client.country : ""]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean)

  const mapsUrl = addressParts.length
    ? `https://maps.google.com/?q=${encodeURIComponent(addressParts.join(", "))}`
    : undefined

  return (
    <>
      <PageHeader
        title={client.name}
        backHref="/clients"
        right={
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        }
      />

      <div className="p-4 space-y-3 pb-8">
        {/* Status & Businesses */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <StatusBadge status={client.status} />
            {linkedBusinesses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {linkedBusinesses.map((biz) =>
                  biz ? (
                    <span
                      key={biz.id}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: biz.color,
                        color: biz.textColor,
                      }}
                    >
                      {biz.name}
                    </span>
                  ) : null
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        {(client.email || client.phone || client.company) && (
          <Card>
            <CardContent className="pt-4 divide-y divide-border">
              {client.email && (
                <DetailRow
                  icon={Mail}
                  href={`mailto:${client.email}`}
                >
                  {client.email}
                </DetailRow>
              )}
              {client.phone && (
                <DetailRow
                  icon={Phone}
                  href={`tel:${client.phone}`}
                >
                  {client.phone}
                </DetailRow>
              )}
              {client.company && (
                <DetailRow icon={Building2}>{client.company}</DetailRow>
              )}
            </CardContent>
          </Card>
        )}

        {/* Address */}
        {addressParts.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <DetailRow icon={MapPin} href={mapsUrl}>
                <span className="whitespace-pre-line">
                  {addressParts.join("\n")}
                </span>
              </DetailRow>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {client.notes && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Notes
              </p>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {client.tags?.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    <Tag size={10} className="mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        <Card>
          <CardContent className="pt-4">
            <button
              type="button"
              onClick={() => setDangerOpen((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Danger zone</span>
              {dangerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {dangerOpen && (
              <div className="mt-4 space-y-3">
                {client.status !== "archived" ? (
                  <Button
                    variant="outline"
                    className="w-full h-11 justify-start gap-2"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(client.id)}
                  >
                    <Archive size={16} />
                    Archive client
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-11 justify-start gap-2"
                    disabled={unarchive.isPending}
                    onClick={() => unarchive.mutate(client.id)}
                  >
                    <ArchiveRestore size={16} />
                    Unarchive client
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full h-11 justify-start gap-2"
                    >
                      <Trash2 size={16} />
                      Delete permanently
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this client and all
                        associated data. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() =>
                          deleteClient.mutate(client.id, {
                            onSuccess: () => router.push("/clients"),
                          })
                        }
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit sheet */}
      <ClientFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
      />
    </>
  )
}
