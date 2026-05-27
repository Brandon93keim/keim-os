export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      client_businesses: {
        Row: {
          business_id: string
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          business_id: string
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          business_id?: string
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_businesses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          status: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_exceptions: {
        Row: {
          action: string
          created_at: string
          event_id: string
          id: string
          modified_event_id: string | null
          original_occurrence_date: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          id?: string
          modified_event_id?: string | null
          original_occurrence_date: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          id?: string
          modified_event_id?: string | null
          original_occurrence_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_exceptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_exceptions_modified_event_id_fkey"
            columns: ["modified_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          business_id: string | null
          client_id: string | null
          color_override: string | null
          created_at: string
          description: string | null
          end_time: string
          golf_purpose: string | null
          id: string
          job_id: string | null
          location: string | null
          meeting_purpose: string | null
          original_occurrence_date: string | null
          parent_event_id: string | null
          recurrence_end_date: string | null
          reminder_for_client_id: string | null
          rrule: string | null
          start_time: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          business_id?: string | null
          client_id?: string | null
          color_override?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          golf_purpose?: string | null
          id?: string
          job_id?: string | null
          location?: string | null
          meeting_purpose?: string | null
          original_occurrence_date?: string | null
          parent_event_id?: string | null
          recurrence_end_date?: string | null
          reminder_for_client_id?: string | null
          rrule?: string | null
          start_time: string
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          business_id?: string | null
          client_id?: string | null
          color_override?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          golf_purpose?: string | null
          id?: string
          job_id?: string | null
          location?: string | null
          meeting_purpose?: string | null
          original_occurrence_date?: string | null
          parent_event_id?: string | null
          recurrence_end_date?: string | null
          reminder_for_client_id?: string | null
          rrule?: string | null
          start_time?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reminder_for_client_id_fkey"
            columns: ["reminder_for_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          business_id: string
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          job_number: string
          status: string
          title: string
          total_estimate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          job_number: string
          status?: string
          title: string
          total_estimate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          job_number?: string
          status?: string
          title?: string
          total_estimate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          business_id: string
          created_at: string
          id: string
          last_number: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          last_number?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          last_number?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          event_id: string | null
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_price: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          event_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          event_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          business_id: string
          client_id: string
          created_at: string
          discount_amount: number
          due_date: string
          email_address: string | null
          id: string
          invoice_number: string | null
          issue_date: string
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          business_id: string
          client_id: string
          created_at?: string
          discount_amount?: number
          due_date: string
          email_address?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          business_id?: string
          client_id?: string
          created_at?: string
          discount_amount?: number
          due_date?: string
          email_address?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_counters: {
        Row: {
          business_id: string
          created_at: string
          id: string
          last_number: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          last_number?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          last_number?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          payment_date: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          kind: string
          starting_balance: number
          business_id: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          kind: string
          starting_balance?: number
          business_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          kind?: string
          starting_balance?: number
          business_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          kind: string
          parent_id: string | null
          color: string | null
          icon: string | null
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          kind: string
          parent_id?: string | null
          color?: string | null
          icon?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          kind?: string
          parent_id?: string | null
          color?: string | null
          icon?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          transfer_to_account_id: string | null
          type: string
          amount: number
          occurred_on: string
          description: string
          business_id: string | null
          category_id: string | null
          invoice_id: string | null
          payment_id: string | null
          bill_payment_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          transfer_to_account_id?: string | null
          type: string
          amount: number
          occurred_on: string
          description: string
          business_id?: string | null
          category_id?: string | null
          invoice_id?: string | null
          payment_id?: string | null
          bill_payment_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          transfer_to_account_id?: string | null
          type?: string
          amount?: number
          occurred_on?: string
          description?: string
          business_id?: string | null
          category_id?: string | null
          invoice_id?: string | null
          payment_id?: string | null
          bill_payment_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          id: string
          user_id: string
          name: string
          business_id: string | null
          default_account_id: string
          transaction_type: string
          pays_down_account_id: string | null
          default_amount: number | null
          category_id: string | null
          frequency_unit: string
          frequency_interval: number
          anchor_date: string
          end_date: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          business_id?: string | null
          default_account_id: string
          transaction_type: string
          pays_down_account_id?: string | null
          default_amount?: number | null
          category_id?: string | null
          frequency_unit: string
          frequency_interval: number
          anchor_date: string
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          business_id?: string | null
          default_account_id?: string
          transaction_type?: string
          pays_down_account_id?: string | null
          default_amount?: number | null
          category_id?: string | null
          frequency_unit?: string
          frequency_interval?: number
          anchor_date?: string
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_pays_down_account_id_fkey"
            columns: ["pays_down_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payments: {
        Row: {
          id: string
          user_id: string
          bill_id: string
          amount: number
          paid_on: string
          period_start: string
          account_id: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bill_id: string
          amount: number
          paid_on: string
          period_start: string
          account_id: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bill_id?: string
          amount?: number
          paid_on?: string
          period_start?: string
          account_id?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      accounts_with_balance: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          kind: string
          starting_balance: number
          business_id: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
          current_balance: number
        }
        Relationships: []
      }
      bills_with_next_due: {
        Row: {
          id: string
          user_id: string
          name: string
          business_id: string | null
          default_account_id: string
          transaction_type: string
          pays_down_account_id: string | null
          default_amount: number | null
          category_id: string | null
          frequency_unit: string
          frequency_interval: number
          anchor_date: string
          end_date: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
          next_due_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_current_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      create_job: {
        Args: {
          p_business_id: string
          p_client_id: string | null
          p_title: string
          p_description?: string | null
          p_total_estimate?: number | null
        }
        Returns: {
          id: string
          user_id: string
          business_id: string
          client_id: string | null
          job_number: string
          title: string
          description: string | null
          status: string
          total_estimate: number | null
          created_at: string
          updated_at: string
        }
      }
      generate_invoice_number: {
        Args: { p_business_id: string }
        Returns: string
      }
      generate_job_number: { Args: { p_business_id: string }; Returns: string }
      recalculate_invoice_state: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      bill_next_due_date: {
        Args: { p_bill_id: string }
        Returns: string | null
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
