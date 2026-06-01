"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { allocationRuleFormSchema, type AllocationRuleFormValues } from "@/lib/finance/schemas"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { useCreateAllocationRule, useUpdateAllocationRule } from "@/lib/hooks/useAllocationRules"
import type { AllocationRuleWithAccount } from "@/lib/finance/types"
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

interface Props {
  rule?: AllocationRuleWithAccount
  currentTotal: number
  onSuccess: () => void
  onCancel: () => void
}

export function AllocationRuleForm({ rule, currentTotal, onSuccess, onCancel }: Props) {
  const { data: accounts = [] } = useAllAccounts()
  const createRule = useCreateAllocationRule()
  const updateRule = useUpdateAllocationRule()

  const form = useForm<AllocationRuleFormValues>({
    resolver: zodResolver(allocationRuleFormSchema),
    defaultValues: rule
      ? {
          label: rule.label,
          percentage: Number(rule.percentage),
          destination_account_id: rule.destination_account_id,
        }
      : {
          label: "",
          percentage: 0,
          destination_account_id: "",
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: AllocationRuleFormValues) {
    const existing = rule ? Number(rule.percentage) : 0
    const newTotal = currentTotal - existing + values.percentage
    if (newTotal > 100) {
      form.setError("percentage", {
        message: `Adding this would bring the total to ${newTotal.toFixed(2)}% (max 100%)`,
      })
      return
    }

    if (rule) {
      await updateRule.mutateAsync({ id: rule.id, values })
    } else {
      await createRule.mutateAsync(values)
    }
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-y-auto">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Label</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Tax" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Percentage</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      placeholder="0"
                      className="pr-8"
                      value={field.value === 0 ? "" : field.value}
                      onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="destination_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Account</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="shrink-0 border-t border-border px-4 py-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {rule ? "Save" : "Add Rule"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
