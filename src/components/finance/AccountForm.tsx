"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/lib/utils"
import { accountFormSchema, type AccountFormValues } from "@/lib/finance/schemas"
import { getAccountTransactionCount } from "@/lib/queries/finance"
import { useCreateAccount, useUpdateAccount } from "@/lib/hooks/useAccounts"
import { BUSINESSES } from "@/lib/constants"
import type { AccountWithBalance } from "@/lib/finance/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const TYPE_OPTIONS = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const

function kindForType(type: string): "asset" | "liability" | null {
  if (type === "checking" || type === "savings" || type === "cash") return "asset"
  if (type === "credit_card") return "liability"
  return null
}

interface Props {
  account?: AccountWithBalance
  onSuccess: () => void
  onCancel: () => void
}

export function AccountForm({ account, onSuccess, onCancel }: Props) {
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const [hasTransactions, setHasTransactions] = useState(false)

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type,
          kind: account.kind,
          starting_balance: Math.abs(Number(account.starting_balance)),
          business_id: account.business_id,
          is_active: account.is_active,
        }
      : {
          name: "",
          type: "checking",
          kind: "asset",
          starting_balance: 0,
          business_id: null,
          is_active: true,
        },
  })

  const typeValue = form.watch("type")
  const kindValue = form.watch("kind")
  const currentBalance = form.watch("starting_balance")
  const isSubmitting = form.formState.isSubmitting

  // Auto-set kind when type changes (except "other")
  useEffect(() => {
    const autoKind = kindForType(typeValue)
    if (autoKind !== null) {
      form.setValue("kind", autoKind, { shouldValidate: false })
    }
  }, [typeValue, form])

  // Fetch transaction count in edit mode to gate the balance warning
  useEffect(() => {
    if (!account) return
    getAccountTransactionCount(account.id)
      .then((count) => setHasTransactions(count > 0))
      .catch(() => {})
  }, [account])

  const originalBalance = account ? Math.abs(Number(account.starting_balance)) : null
  const showBalanceWarning =
    !!account &&
    hasTransactions &&
    originalBalance !== null &&
    currentBalance !== originalBalance

  async function onSubmit(values: AccountFormValues) {
    if (account) {
      updateAccount.mutate({ id: account.id, values }, { onSuccess })
    } else {
      createAccount.mutate(values, { onSuccess })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 pb-6 space-y-5">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Chase Checking" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Kind — only visible when type=other */}
          {typeValue === "other" && (
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Starting Balance */}
          <FormField
            control={form.control}
            name="starting_balance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {kindValue === "liability" ? "Amount Owed" : "Starting Balance"}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      field.onChange(isNaN(v) ? 0 : v)
                    }}
                    value={field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Balance change warning (edit mode with existing transactions) */}
          {showBalanceWarning && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-3 space-y-2">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Changing starting balance shifts the running balance for all existing transactions.
                Save anyway?
              </p>
              <button
                type="button"
                onClick={() =>
                  form.setValue("starting_balance", originalBalance!, { shouldValidate: true })
                }
                className="text-xs font-medium text-amber-700 dark:text-amber-300 underline underline-offset-2"
              >
                Revert to original
              </button>
            </div>
          )}

          {/* Business */}
          <FormField
            control={form.control}
            name="business_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__personal__" ? null : v)}
                  value={field.value ?? "__personal__"}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__personal__">Personal / Shared</SelectItem>
                    {BUSINESSES.map((biz) => (
                      <SelectItem key={biz.id} value={biz.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: biz.color }}
                          />
                          {biz.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Active toggle — edit mode only */}
          {account && (
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel className="mb-0">Active</FormLabel>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      field.value ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        field.value ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="flex gap-3 border-t border-border bg-popover px-4 py-4 shrink-0"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-11">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1 h-11">
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
