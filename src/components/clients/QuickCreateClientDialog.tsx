"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  clientFormSchema,
  BUSINESS_IDS,
  type ClientFormValues,
  type ClientFormInput,
} from "@/lib/validations/client"
import { useCreateClient } from "@/lib/hooks/useClients"
import type { Client } from "@/lib/queries/clients"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BusinessMultiSelect } from "./BusinessMultiSelect"

interface Props {
  open: boolean
  onClose: () => void
  defaultBusinessId?: string | null
  onCreated: (client: Client) => void
}

function buildDefaults(defaultBusinessId?: string | null): ClientFormInput {
  return {
    name: "",
    status: "active",
    email: "",
    phone: "",
    company: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
    notes: "",
    tags: [],
    business_ids: defaultBusinessId
      ? [defaultBusinessId as (typeof BUSINESS_IDS)[number]]
      : [],
  }
}

export function QuickCreateClientDialog({
  open,
  onClose,
  defaultBusinessId,
  onCreated,
}: Props) {
  const createClient = useCreateClient()

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: buildDefaults(defaultBusinessId),
  })

  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(defaultBusinessId))
    }
  }, [open, defaultBusinessId, form])

  function onSubmit(rawValues: ClientFormInput) {
    const values = rawValues as ClientFormValues
    const businessIds = values.business_ids ?? []
    const finalBusinessIds: (typeof BUSINESS_IDS)[number][] =
      defaultBusinessId &&
      !businessIds.includes(defaultBusinessId as (typeof BUSINESS_IDS)[number])
        ? [...businessIds, defaultBusinessId as (typeof BUSINESS_IDS)[number]]
        : businessIds

    createClient.mutate(
      { ...values, business_ids: finalBusinessIds },
      {
        onSuccess: (client) => {
          onCreated(client)
          onClose()
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Client name" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      placeholder="email@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="+1 555 000 0000"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="business_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked businesses</FormLabel>
                  <BusinessMultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createClient.isPending}>
                {createClient.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
