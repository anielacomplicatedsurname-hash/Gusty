
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_runs": {
                  Row: {
                    "cost_usd": number,"created_at": string,"error": string | null,"id": string,"input_tokens": number,"model": string,"output_tokens": number,"owner_id": string,"project_id": string | null,"prompt_version": string,"status": string,"task": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_usd"?: number,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number,"model": string,"output_tokens"?: number,"owner_id"?: string,"project_id"?: string | null,"prompt_version": string,"status": string,"task": string
                  }
                  Update: {
                    "cost_usd"?: number,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number,"model"?: string,"output_tokens"?: number,"owner_id"?: string,"project_id"?: string | null,"prompt_version"?: string,"status"?: string,"task"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_runs_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "confusing": string | null,"created_at": string,"id": string,"other": string | null,"owner_id": string | null,"page": string | null,"worked": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confusing"?: string | null,"created_at"?: string,"id"?: string,"other"?: string | null,"owner_id"?: string | null,"page"?: string | null,"worked"?: string | null
                  }
                  Update: {
                    "confusing"?: string | null,"created_at"?: string,"id"?: string,"other"?: string | null,"owner_id"?: string | null,"page"?: string | null,"worked"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"next_steps": {
                  Row: {
                    "created_at": string,"detail": string,"direction_id": string | null,"done_at": string | null,"explanation": string | null,"id": string,"minutes": number | null,"notes": string,"owner_id": string,"position": number,"project_id": string,"source": string,"starter": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: string,"direction_id"?: string | null,"done_at"?: string | null,"explanation"?: string | null,"id"?: string,"minutes"?: number | null,"notes"?: string,"owner_id"?: string,"position"?: number,"project_id": string,"source"?: string,"starter"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string,"direction_id"?: string | null,"done_at"?: string | null,"explanation"?: string | null,"id"?: string,"minutes"?: number | null,"notes"?: string,"owner_id"?: string,"position"?: number,"project_id"?: string,"source"?: string,"starter"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "next_steps_direction_id_fkey"
      columns: ["direction_id"]
isOneToOne: false
      referencedRelation: "project_directions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "next_steps_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"organisations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_directions": {
                  Row: {
                    "chosen": boolean,"created_at": string,"id": string,"label": string,"owner_id": string,"position": number,"project_id": string,"reason": string,"recommended": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "chosen"?: boolean,"created_at"?: string,"id"?: string,"label": string,"owner_id"?: string,"position"?: number,"project_id": string,"reason"?: string,"recommended"?: boolean
                  }
                  Update: {
                    "chosen"?: boolean,"created_at"?: string,"id"?: string,"label"?: string,"owner_id"?: string,"position"?: number,"project_id"?: string,"reason"?: string,"recommended"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_directions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_facts": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"owner_id": string,"position": number,"project_id": string,"source": string,"status": string,"updated_at": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"owner_id"?: string,"position"?: number,"project_id": string,"source": string,"status"?: string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"position"?: number,"project_id"?: string,"source"?: string,"status"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_facts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_transfers": {
                  Row: {
                    "created_at": string,"from_user": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_user": string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"from_user"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"id": string,"idea": string,"organisation_id": string,"owner_id": string,"title": string,"title_source": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"idea": string,"organisation_id"?: string,"owner_id"?: string,"title": string,"title_source"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"idea"?: string,"organisation_id"?: string,"owner_id"?: string,"title"?: string,"title_source"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    }
                  ]
                },"step_questions": {
                  Row: {
                    "answer": string,"created_at": string,"hint": string,"id": string,"owner_id": string,"position": number,"project_id": string,"question": string,"status": string,"step_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: string,"created_at"?: string,"hint"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"project_id": string,"question": string,"status"?: string,"step_id": string,"updated_at"?: string
                  }
                  Update: {
                    "answer"?: string,"created_at"?: string,"hint"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"project_id"?: string,"question"?: string,"status"?: string,"step_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "step_questions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "step_questions_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "next_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "experience_mode": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "experience_mode"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "experience_mode"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_feedback":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"claim_guest_projects":
{ Args: { "p_token_hash": string }; Returns: number
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"feedback_sent_today":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"start_project_transfer":
{ Args: { "p_token_hash": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
