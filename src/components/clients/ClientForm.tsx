"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, ChevronUp } from "lucide-react"
import { clientFormSchema, type ClientFormValues, type ClientFormInput, type BusinessId } from "@/lib/validations/client"
import { useCreateClient, useUpdateClient } from "@/lib/hooks/useClients"
import type { Client } from "@/lib/queries/clients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BusinessMultiSelect } from "./BusinessMultiSelect"

interface Props {
  client?: Client
  onSuccess: () => void
  onCancel: () => void
}

export function ClientForm({ client, onSuccess, onCancel }: Props) {
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

  const hasAddress = !!(
    client?.address_line1 ||
    client?.city ||
    client?.state ||
    client?.postal_code
  )
  const [showAddress, setShowAddress] = useState(hasAddress)
  const [tagsInput, setTagsInput] = useState(
    client?.tags?.join(", ") ?? ""
  )

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client
      ? {
          name: client.name,
          status: client.status as "prospect" | "active" | "archived",
          email: client.email ?? "",
          phone: client.phone ?? "",
          company: client.company ?? "",
          address_line1: client.address_line1 ?? "",
          address_line2: client.address_line2 ?? "",
          city: client.city ?? "",
          state: client.state ?? "",
          postal_code: client.postal_code ?? "",
          country: client.country ?? "US",
          notes: client.notes ?? "",
          tags: client.tags ?? [],
          business_ids: (client.business_ids ?? []) as BusinessId[],
        }
      : {
          name: "",
          status: "prospect",
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
          business_ids: [],
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(rawValues: ClientFormInput) {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const payload = { ...rawValues, tags } as ClientFormValues

    if (client) {
      updateClient.mutate(
        { id: client.id, values: payload },
        { onSuccess }
      )
    } else {
      createClient.mutate(payload, { onSuccess })
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Client name"
                    autoFocus
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    autoComplete="email"
                    inputMode="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    autoComplete="tel"
                    inputMode="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Company */}
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Company name"
                    autoComplete="organization"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Businesses */}
          <FormField
            control={form.control}
            name="business_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Businesses</FormLabel>
                <FormControl>
                  <BusinessMultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Address (collapsible) */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAddress((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAddress ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
              {showAddress ? "Hide address" : "Add address"}
            </button>

            {showAddress && (
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="address_line1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address line 1</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main St"
                          autoComplete="address-line1"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_line2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address line 2</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Suite, apt, etc."
                          autoComplete="address-line2"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input autoComplete="address-level2" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input autoComplete="address-level1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal code</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="postal-code"
                            inputMode="numeric"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="country"
                            maxLength={2}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any notes about this client…"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags-input">Tags</Label>
            <Input
              id="tags-input"
              placeholder="vip, referral, wedding"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Separate with commas
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div
          className="flex gap-3 border-t border-border bg-popover px-4 py-4 shrink-0"
          style={{
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-11"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-11"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
