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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          director_id: string
          entered_at: string
          id: string
          operator_name: string
          session_id: string
          ticket_id: string
        }
        Insert: {
          director_id: string
          entered_at?: string
          id?: string
          operator_name?: string
          session_id: string
          ticket_id: string
        }
        Update: {
          director_id?: string
          entered_at?: string
          id?: string
          operator_name?: string
          session_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "show_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_objects: {
        Row: {
          hall_id: string
          height: number
          id: string
          is_active: boolean
          kind: string
          label: string
          width: number
          x: number
          y: number
        }
        Insert: {
          hall_id: string
          height?: number
          id?: string
          is_active?: boolean
          kind: string
          label?: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          hall_id?: string
          height?: number
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "hall_objects_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_rows: {
        Row: {
          hall_id: string
          id: string
          is_active: boolean
          label: string
          order_index: number
          price: number | null
          section_id: string | null
          x: number
          y: number
        }
        Insert: {
          hall_id: string
          id?: string
          is_active?: boolean
          label: string
          order_index?: number
          price?: number | null
          section_id?: string | null
          x?: number
          y?: number
        }
        Update: {
          hall_id?: string
          id?: string
          is_active?: boolean
          label?: string
          order_index?: number
          price?: number | null
          section_id?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "hall_rows_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_rows_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      halls: {
        Row: {
          created_at: string
          deleted_at: string | null
          director_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          director_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          director_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "halls_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_access: {
        Row: {
          created_at: string
          device_id: string
          device_label: string
          director_id: string
          id: string
          is_enabled: boolean
          kind: Database["public"]["Enums"]["access_kind"]
          last_seen_at: string
          operator_name: string
          print_size: string
          session_token: string
          status: Database["public"]["Enums"]["access_status"]
        }
        Insert: {
          created_at?: string
          device_id: string
          device_label?: string
          director_id: string
          id?: string
          is_enabled?: boolean
          kind: Database["public"]["Enums"]["access_kind"]
          last_seen_at?: string
          operator_name: string
          print_size?: string
          session_token?: string
          status?: Database["public"]["Enums"]["access_status"]
        }
        Update: {
          created_at?: string
          device_id?: string
          device_label?: string
          director_id?: string
          id?: string
          is_enabled?: boolean
          kind?: Database["public"]["Enums"]["access_kind"]
          last_seen_at?: string
          operator_name?: string
          print_size?: string
          session_token?: string
          status?: Database["public"]["Enums"]["access_status"]
        }
        Relationships: [
          {
            foreignKeyName: "operator_access_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          booth_token: string
          created_at: string
          email: string
          entry_token: string
          full_name: string
          id: string
          is_active: boolean
          max_booth_operators: number
          max_entry_operators: number
          mobile: string
          session_switch_minutes: number
          status: Database["public"]["Enums"]["account_status"]
          username: string
        }
        Insert: {
          booth_token?: string
          created_at?: string
          email?: string
          entry_token?: string
          full_name?: string
          id: string
          is_active?: boolean
          max_booth_operators?: number
          max_entry_operators?: number
          mobile?: string
          session_switch_minutes?: number
          status?: Database["public"]["Enums"]["account_status"]
          username: string
        }
        Update: {
          booth_token?: string
          created_at?: string
          email?: string
          entry_token?: string
          full_name?: string
          id?: string
          is_active?: boolean
          max_booth_operators?: number
          max_entry_operators?: number
          mobile?: string
          session_switch_minutes?: number
          status?: Database["public"]["Enums"]["account_status"]
          username?: string
        }
        Relationships: []
      }
      seats: {
        Row: {
          hall_id: string
          id: string
          is_active: boolean
          number: number
          row_id: string
          section_id: string | null
          x: number
          y: number
        }
        Insert: {
          hall_id: string
          id?: string
          is_active?: boolean
          number: number
          row_id: string
          section_id?: string | null
          x?: number
          y?: number
        }
        Update: {
          hall_id?: string
          id?: string
          is_active?: boolean
          number?: number
          row_id?: string
          section_id?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "seats_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "hall_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          color: string
          hall_id: string
          height: number
          id: string
          is_active: boolean
          name: string
          width: number
          x: number
          y: number
        }
        Insert: {
          color?: string
          hall_id: string
          height?: number
          id?: string
          is_active?: boolean
          name: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          color?: string
          hall_id?: string
          height?: number
          id?: string
          is_active?: boolean
          name?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "sections_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
        ]
      }
      show_sessions: {
        Row: {
          director_id: string
          hall_id: string
          id: string
          is_active: boolean
          show_id: string
          starts_at: string
        }
        Insert: {
          director_id: string
          hall_id: string
          id?: string
          is_active?: boolean
          show_id: string
          starts_at: string
        }
        Update: {
          director_id?: string
          hall_id?: string
          id?: string
          is_active?: boolean
          show_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_sessions_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_sessions_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_sessions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string
          director_id: string
          end_date: string
          hall_id: string
          id: string
          is_active: boolean
          poster_url: string | null
          price: number
          start_date: string
          title: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          director_id: string
          end_date: string
          hall_id: string
          id?: string
          is_active?: boolean
          poster_url?: string | null
          price?: number
          start_date: string
          title: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          director_id?: string
          end_date?: string
          hall_id?: string
          id?: string
          is_active?: boolean
          poster_url?: string | null
          price?: number
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          code: string
          created_at: string
          director_id: string
          hall_name: string
          id: string
          price: number
          qr_token: string
          row_label: string
          seat_id: string
          seat_number: number
          section_name: string
          serial: number
          session_id: string
          show_title: string
          starts_at: string
          status: string
          transaction_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          director_id: string
          hall_name: string
          id?: string
          price?: number
          qr_token?: string
          row_label: string
          seat_id: string
          seat_number: number
          section_name?: string
          serial?: number
          session_id: string
          show_title: string
          starts_at: string
          status?: string
          transaction_id: string
        }
        Update: {
          code?: string
          created_at?: string
          director_id?: string
          hall_name?: string
          id?: string
          price?: number
          qr_token?: string
          row_label?: string
          seat_id?: string
          seat_number?: number
          section_name?: string
          serial?: number
          session_id?: string
          show_title?: string
          starts_at?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "show_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          customer_mobile: string
          customer_name: string
          director_id: string
          id: string
          operator_access_id: string | null
          operator_name: string
          serial: number
          session_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_mobile?: string
          customer_name?: string
          director_id: string
          id?: string
          operator_access_id?: string | null
          operator_name?: string
          serial?: number
          session_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          customer_mobile?: string
          customer_name?: string
          director_id?: string
          id?: string
          operator_access_id?: string | null
          operator_name?: string
          serial?: number
          session_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_operator_access_id_fkey"
            columns: ["operator_access_id"]
            isOneToOne: false
            referencedRelation: "operator_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "show_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      booth_sell: {
        Args: {
          _access: string
          _director: string
          _operator: string
          _seats: string[]
          _session: string
        }
        Returns: string
      }
      delete_hall: { Args: { _hall: string }; Returns: string }
      delete_show: { Args: { _show: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_hall: { Args: { _hall: string }; Returns: boolean }
    }
    Enums: {
      access_kind: "booth" | "entry"
      access_status: "pending" | "approved" | "revoked"
      account_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "director"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_kind: ["booth", "entry"],
      access_status: ["pending", "approved", "revoked"],
      account_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "director"],
    },
  },
} as const
