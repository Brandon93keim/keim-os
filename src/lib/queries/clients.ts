import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"
import type { ClientFormValues } from "@/lib/validations/client"

export type Client = Tables<"clients"> & { business_ids: string[] }

type RawClientRow = Tables<"clients"> & {
  client_businesses: Array<{ business_id: string }>
}

function toClient(row: RawClientRow): Client {
  const { client_businesses, ...rest } = row
  return {
    ...rest,
    business_ids: (client_businesses ?? []).map((cb) => cb.business_id),
  }
}

function nullify<T>(val: T | "" | undefined): T | null {
  if (val === "" || val === undefined) return null
  return val
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listClients(): Promise<Client[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("*, client_businesses(business_id)")
    .order("name")
  if (error) throw error
  return ((data ?? []) as unknown as RawClientRow[]).map(toClient)
}

export async function getClient(id: string): Promise<Client> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("*, client_businesses(business_id)")
    .eq("id", id)
    .single()
  if (error) throw error
  return toClient(data as unknown as RawClientRow)
}

export async function createClient_(values: ClientFormValues): Promise<Client> {
  const supabase = createClient()
  const userId = await getUserId()
  const { business_ids, tags, email, phone, company, address_line1, address_line2, city, state, postal_code, notes, ...rest } = values

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: rest.name,
      status: rest.status,
      country: rest.country,
      email: nullify(email),
      phone: nullify(phone),
      company: nullify(company),
      address_line1: nullify(address_line1),
      address_line2: nullify(address_line2),
      city: nullify(city),
      state: nullify(state),
      postal_code: nullify(postal_code),
      notes: nullify(notes),
      tags: tags ?? [],
    })
    .select()
    .single()

  if (error) throw error

  if (business_ids.length > 0) {
    const { error: bizError } = await supabase
      .from("client_businesses")
      .insert(
        business_ids.map((business_id) => ({
          client_id: data.id,
          business_id,
          user_id: userId,
        }))
      )
    if (bizError) {
      await supabase.from("clients").delete().eq("id", data.id)
      throw bizError
    }
  }

  return { ...data, business_ids }
}

export async function updateClient(id: string, values: ClientFormValues): Promise<Client> {
  const supabase = createClient()
  const userId = await getUserId()
  const { business_ids, tags, email, phone, company, address_line1, address_line2, city, state, postal_code, notes, ...rest } = values

  const { data, error } = await supabase
    .from("clients")
    .update({
      name: rest.name,
      status: rest.status,
      country: rest.country,
      email: nullify(email),
      phone: nullify(phone),
      company: nullify(company),
      address_line1: nullify(address_line1),
      address_line2: nullify(address_line2),
      city: nullify(city),
      state: nullify(state),
      postal_code: nullify(postal_code),
      notes: nullify(notes),
      tags: tags ?? [],
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  const { error: delError } = await supabase
    .from("client_businesses")
    .delete()
    .eq("client_id", id)
  if (delError) throw delError

  if (business_ids.length > 0) {
    const { error: bizError } = await supabase
      .from("client_businesses")
      .insert(
        business_ids.map((business_id) => ({
          client_id: id,
          business_id,
          user_id: userId,
        }))
      )
    if (bizError) throw bizError
  }

  return { ...data, business_ids }
}

export async function archiveClient(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("clients")
    .update({ status: "archived" })
    .eq("id", id)
  if (error) throw error
}

export async function unarchiveClient(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("clients")
    .update({ status: "prospect" })
    .eq("id", id)
  if (error) throw error
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("clients").delete().eq("id", id)
  if (error) throw error
}
