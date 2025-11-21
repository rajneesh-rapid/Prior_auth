export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      claims: {
        Row: {
          id: string
          claim_id: string
          patient_name: string
          date_of_service: string
          total_amt: number
          accepted_amt: number
          denied_amt: number
          approval_status: string | null
          approval_reason: string | null
          query_reason: string | null
          status_history: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          claim_id: string
          patient_name: string
          date_of_service: string
          total_amt: number
          accepted_amt: number
          denied_amt: number
          approval_status?: string | null
          approval_reason?: string | null
          query_reason?: string | null
          status_history: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          claim_id?: string
          patient_name?: string
          date_of_service?: string
          total_amt?: number
          accepted_amt?: number
          denied_amt?: number
          approval_status?: string | null
          approval_reason?: string | null
          query_reason?: string | null
          status_history?: Json
          created_at?: string
          updated_at?: string
        }
      }
      claim_items: {
        Row: {
          id: string
          claim_id: string
          item_code: string
          procedure: string
          amount: number
          approved_amt: number | null
          qty: number
          status: string | null
          approval_status: string | null
          query_reason: string | null
          reason: string | null
          status_history: Json
          reason_history: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          claim_id: string
          item_code: string
          procedure: string
          amount: number
          approved_amt?: number | null
          qty: number
          status?: string | null
          approval_status?: string | null
          query_reason?: string | null
          reason?: string | null
          status_history: Json
          reason_history?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          claim_id?: string
          item_code?: string
          procedure?: string
          amount?: number
          approved_amt?: number | null
          qty?: number
          status?: string | null
          approval_status?: string | null
          query_reason?: string | null
          reason?: string | null
          status_history?: Json
          reason_history?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      claim_documents: {
        Row: {
          id: string
          claim_id: string
          document_id: string
          name: string
          size: number
          upload_date: string
          url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          claim_id: string
          document_id: string
          name: string
          size: number
          upload_date: string
          url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          claim_id?: string
          document_id?: string
          name?: string
          size?: number
          upload_date?: string
          url?: string | null
          created_at?: string
        }
      }
      chart_configurations: {
        Row: {
          id: string
          chart_type: string
          config: Json
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chart_type: string
          config: Json
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chart_type?: string
          config?: Json
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

