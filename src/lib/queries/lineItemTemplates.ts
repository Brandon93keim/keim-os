import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

export type LineItemTemplate = Tables<"line_item_templates">
export type LineItemTemplateInsert = TablesInsert<"line_item_templates">
export type LineItemTemplateUpdate = TablesUpdate<"line_item_templates">

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listLineItemTemplates(businessId: string | null): Promise<LineItemTemplate[]> {
  const supabase = createClient()
  const userId = await getUserId()

  let query = supabase
    .from("line_item_templates")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("description", { ascending: true })

  if (businessId !== null) {
    query = query.or(`business_id.eq.${businessId},business_id.is.null`)
  } else {
    query = query.is("business_id", null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LineItemTemplate[]
}

export async function createLineItemTemplate(
  values: Omit<LineItemTemplateInsert, "user_id">
): Promise<LineItemTemplate> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("line_item_templates")
    .insert({ ...values, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data as LineItemTemplate
}

export async function updateLineItemTemplate(
  id: string,
  values: LineItemTemplateUpdate
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("line_item_templates")
    .update(values)
    .eq("id", id)
  if (error) throw error
}

export async function deleteLineItemTemplate(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("line_item_templates")
    .delete()
    .eq("id", id)
  if (error) throw error
}
