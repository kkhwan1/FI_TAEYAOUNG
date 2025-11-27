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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          audit_id: number
          created_at: string
          error_message: string | null
          execution_time: number | null
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: number | null
          status: string
          table_name: string
          user_agent: string | null
          user_id: number | null
        }
        Insert: {
          audit_id?: number
          created_at?: string
          error_message?: string | null
          execution_time?: number | null
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: number | null
          status?: string
          table_name: string
          user_agent?: string | null
          user_id?: number | null
        }
        Update: {
          audit_id?: number
          created_at?: string
          error_message?: string | null
          execution_time?: number | null
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: number | null
          status?: string
          table_name?: string
          user_agent?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bom: {
        Row: {
          bom_id: number
          child_item_id: number
          child_supplier_id: number | null
          created_at: string
          customer_id: number | null
          is_active: boolean
          labor_cost: number | null
          level_no: number
          machine_time: number | null
          notes: string | null
          parent_item_id: number
          quantity_required: number
          setup_time: number | null
          updated_at: string
        }
        Insert: {
          bom_id?: number
          child_item_id: number
          child_supplier_id?: number | null
          created_at?: string
          customer_id?: number | null
          is_active?: boolean
          labor_cost?: number | null
          level_no?: number
          machine_time?: number | null
          notes?: string | null
          parent_item_id: number
          quantity_required?: number
          setup_time?: number | null
          updated_at?: string
        }
        Update: {
          bom_id?: number
          child_item_id?: number
          child_supplier_id?: number | null
          created_at?: string
          customer_id?: number | null
          is_active?: boolean
          labor_cost?: number | null
          level_no?: number
          machine_time?: number | null
          notes?: string | null
          parent_item_id?: number
          quantity_required?: number
          setup_time?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_child_supplier_id_fkey"
            columns: ["child_supplier_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bom_child_supplier_id_fkey"
            columns: ["child_supplier_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bom_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bom_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      bom_deduction_log: {
        Row: {
          bom_level: number
          child_item_id: number
          created_at: string
          deducted_quantity: number
          log_id: number
          parent_item_id: number
          parent_quantity: number
          quantity_required: number
          stock_after: number
          stock_before: number
          transaction_id: number
          usage_rate: number
        }
        Insert: {
          bom_level: number
          child_item_id: number
          created_at?: string
          deducted_quantity: number
          log_id?: number
          parent_item_id: number
          parent_quantity: number
          quantity_required: number
          stock_after: number
          stock_before: number
          transaction_id: number
          usage_rate: number
        }
        Update: {
          bom_level?: number
          child_item_id?: number
          created_at?: string
          deducted_quantity?: number
          log_id?: number
          parent_item_id?: number
          parent_quantity?: number
          quantity_required?: number
          stock_after?: number
          stock_before?: number
          transaction_id?: number
          usage_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_deduction_log_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_deduction_log_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_deduction_log_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_deduction_log_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_deduction_log_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_deduction_log_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_deduction_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      coil_process_history: {
        Row: {
          created_at: string
          input_quantity: number
          notes: string | null
          operator_id: number | null
          output_quantity: number
          process_date: string
          process_id: number
          process_type: string
          source_item_id: number
          status: string
          target_item_id: number
          updated_at: string
          yield_rate: number | null
        }
        Insert: {
          created_at?: string
          input_quantity: number
          notes?: string | null
          operator_id?: number | null
          output_quantity: number
          process_date?: string
          process_id?: number
          process_type: string
          source_item_id: number
          status?: string
          target_item_id: number
          updated_at?: string
          yield_rate?: number | null
        }
        Update: {
          created_at?: string
          input_quantity?: number
          notes?: string | null
          operator_id?: number | null
          output_quantity?: number
          process_date?: string
          process_id?: number
          process_type?: string
          source_item_id?: number
          status?: string
          target_item_id?: number
          updated_at?: string
          yield_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coil_process_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coil_process_history_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_process_history_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_process_history_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_process_history_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_process_history_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_process_history_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      coil_specs: {
        Row: {
          created_at: string
          density: number
          item_id: number
          kg_unit_price: number | null
          length: number
          material_grade: string
          piece_unit_price: number | null
          sep_factor: number
          thickness: number
          updated_at: string
          weight_per_piece: number | null
          width: number
        }
        Insert: {
          created_at?: string
          density?: number
          item_id: number
          kg_unit_price?: number | null
          length: number
          material_grade: string
          piece_unit_price?: number | null
          sep_factor?: number
          thickness: number
          updated_at?: string
          weight_per_piece?: number | null
          width: number
        }
        Update: {
          created_at?: string
          density?: number
          item_id?: number
          kg_unit_price?: number | null
          length?: number
          material_grade?: string
          piece_unit_price?: number | null
          sep_factor?: number
          thickness?: number
          updated_at?: string
          weight_per_piece?: number | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "coil_specs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_specs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "coil_specs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      collection_transactions: {
        Row: {
          account_number: string | null
          amount: number
          bank_name: string | null
          collection_date: string
          collection_id: number
          collection_no: string
          created_at: string | null
          created_by: string | null
          customer_id: number
          customer_name: string
          is_active: boolean | null
          notes: string | null
          payment_method: string | null
          sales_transaction_id: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          collection_date: string
          collection_id?: number
          collection_no: string
          created_at?: string | null
          created_by?: string | null
          customer_id: number
          customer_name: string
          is_active?: boolean | null
          notes?: string | null
          payment_method?: string | null
          sales_transaction_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          collection_date?: string
          collection_id?: number
          collection_no?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: number
          customer_name?: string
          is_active?: boolean | null
          notes?: string | null
          payment_method?: string | null
          sales_transaction_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collection_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collection_transactions_sales_transaction_id_fkey"
            columns: ["sales_transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      collections: {
        Row: {
          account_number: string | null
          bank_name: string | null
          bill_date: string | null
          bill_drawer: string | null
          bill_number: string | null
          card_number: string | null
          check_number: string | null
          collected_amount: number
          collection_date: string
          collection_id: number
          collection_no: string
          created_at: string
          customer_id: number
          is_active: boolean
          notes: string | null
          payment_method: string
          sales_transaction_id: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          bill_date?: string | null
          bill_drawer?: string | null
          bill_number?: string | null
          card_number?: string | null
          check_number?: string | null
          collected_amount: number
          collection_date: string
          collection_id?: number
          collection_no: string
          created_at?: string
          customer_id: number
          is_active?: boolean
          notes?: string | null
          payment_method: string
          sales_transaction_id: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          bill_date?: string | null
          bill_drawer?: string | null
          bill_number?: string | null
          card_number?: string | null
          check_number?: string | null
          collected_amount?: number
          collection_date?: string
          collection_id?: number
          collection_no?: string
          created_at?: string
          customer_id?: number
          is_active?: boolean
          notes?: string | null
          payment_method?: string
          sales_transaction_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collections_sales_transaction_id_fkey"
            columns: ["sales_transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          business_info: Json | null
          business_number: string | null
          company_category: string | null
          company_code: string
          company_id: number
          company_name: string
          company_type: Database["public"]["Enums"]["company_type"]
          created_at: string | null
          created_by: number | null
          description: string | null
          email: string | null
          fax: string | null
          is_active: boolean | null
          payment_terms: number | null
          phone: string | null
          representative: string | null
          updated_at: string | null
          updated_by: number | null
        }
        Insert: {
          address?: string | null
          business_info?: Json | null
          business_number?: string | null
          company_category?: string | null
          company_code: string
          company_id?: number
          company_name: string
          company_type: Database["public"]["Enums"]["company_type"]
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          email?: string | null
          fax?: string | null
          is_active?: boolean | null
          payment_terms?: number | null
          phone?: string | null
          representative?: string | null
          updated_at?: string | null
          updated_by?: number | null
        }
        Update: {
          address?: string | null
          business_info?: Json | null
          business_number?: string | null
          company_category?: string | null
          company_code?: string
          company_id?: number
          company_name?: string
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          email?: string | null
          fax?: string | null
          is_active?: boolean | null
          payment_terms?: number | null
          phone?: string | null
          representative?: string | null
          updated_at?: string | null
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "companies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: number
          document_id: number
          document_type: string
          document_url: string
          file_name: string | null
          file_path: string | null
          file_size: number
          is_active: boolean | null
          mime_type: string | null
          original_filename: string
          page_count: number | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: number | null
          version: number | null
        }
        Insert: {
          contract_id: number
          document_id?: number
          document_type: string
          document_url: string
          file_name?: string | null
          file_path?: string | null
          file_size: number
          is_active?: boolean | null
          mime_type?: string | null
          original_filename: string
          page_count?: number | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: number | null
          version?: number | null
        }
        Update: {
          contract_id?: number
          document_id?: number
          document_type?: string
          document_url?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number
          is_active?: boolean | null
          mime_type?: string | null
          original_filename?: string
          page_count?: number | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contracts: {
        Row: {
          company_id: number
          contract_date: string | null
          contract_id: number
          contract_name: string | null
          contract_no: string
          contract_type: string | null
          created_at: string | null
          created_by: number | null
          end_date: string
          is_active: boolean | null
          notes: string | null
          searchable_text: string | null
          start_date: string
          status: string
          terms: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          company_id: number
          contract_date?: string | null
          contract_id?: number
          contract_name?: string | null
          contract_no: string
          contract_type?: string | null
          created_at?: string | null
          created_by?: number | null
          end_date: string
          is_active?: boolean | null
          notes?: string | null
          searchable_text?: string | null
          start_date: string
          status: string
          terms?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          company_id?: number
          contract_date?: string | null
          contract_id?: number
          contract_name?: string | null
          contract_no?: string
          contract_type?: string | null
          created_at?: string | null
          created_by?: number | null
          end_date?: string
          is_active?: boolean | null
          notes?: string | null
          searchable_text?: string | null
          start_date?: string
          status?: string
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customer_bom_templates: {
        Row: {
          bom_id: number
          created_at: string | null
          customer_id: number
          is_default: boolean | null
          template_id: number
          updated_at: string | null
        }
        Insert: {
          bom_id: number
          created_at?: string | null
          customer_id: number
          is_default?: boolean | null
          template_id?: number
          updated_at?: string | null
        }
        Update: {
          bom_id?: number
          created_at?: string | null
          customer_id?: number
          is_default?: boolean | null
          template_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_bom_templates_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom"
            referencedColumns: ["bom_id"]
          },
          {
            foreignKeyName: "customer_bom_templates_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "v_bom_details"
            referencedColumns: ["bom_id"]
          },
          {
            foreignKeyName: "customer_bom_templates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customer_bom_templates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          arrival_date: string | null
          company_id: number | null
          created_at: string | null
          created_by: number | null
          delivery_date: string | null
          description: string | null
          document_number: string | null
          expiry_date: string | null
          grand_total: number | null
          item_id: number
          location: string | null
          lot_number: string | null
          notes: string | null
          quantity: number
          reference_number: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          tax_amount: number | null
          total_amount: number | null
          transaction_date: string
          transaction_id: number
          transaction_number: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number | null
          updated_at: string | null
          updated_by: number | null
          warehouse_id: number | null
        }
        Insert: {
          arrival_date?: string | null
          company_id?: number | null
          created_at?: string | null
          created_by?: number | null
          delivery_date?: string | null
          description?: string | null
          document_number?: string | null
          expiry_date?: string | null
          grand_total?: number | null
          item_id: number
          location?: string | null
          lot_number?: string | null
          notes?: string | null
          quantity: number
          reference_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          tax_amount?: number | null
          total_amount?: number | null
          transaction_date: string
          transaction_id?: number
          transaction_number?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number | null
          updated_at?: string | null
          updated_by?: number | null
          warehouse_id?: number | null
        }
        Update: {
          arrival_date?: string | null
          company_id?: number | null
          created_at?: string | null
          created_by?: number | null
          delivery_date?: string | null
          description?: string | null
          document_number?: string | null
          expiry_date?: string | null
          grand_total?: number | null
          item_id?: number
          location?: string | null
          lot_number?: string | null
          notes?: string | null
          quantity?: number
          reference_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          tax_amount?: number | null
          total_amount?: number | null
          transaction_date?: string
          transaction_id?: number
          transaction_number?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number | null
          updated_at?: string | null
          updated_by?: number | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          invoice_item_id: number
          item_id: number
          line_no: number
          notes: string | null
          quantity: number
          total_amount: number
          transaction_id: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          invoice_item_id?: number
          item_id: number
          line_no?: number
          notes?: string | null
          quantity?: number
          total_amount?: number
          transaction_id: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          invoice_item_id?: number
          item_id?: number
          line_no?: number
          notes?: string | null
          quantity?: number
          total_amount?: number
          transaction_id?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_invoice_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_invoice_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_invoice_items_sales_transactions"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "fk_invoice_items_transaction_id"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      item_images: {
        Row: {
          compression_ratio: number | null
          display_order: number | null
          file_name: string | null
          file_size: number | null
          full_url: string | null
          image_id: number
          image_url: string
          is_primary: boolean | null
          item_id: number | null
          medium_url: string | null
          mime_type: string | null
          thumbnail_url: string | null
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          compression_ratio?: number | null
          display_order?: number | null
          file_name?: string | null
          file_size?: number | null
          full_url?: string | null
          image_id?: number
          image_url: string
          is_primary?: boolean | null
          item_id?: number | null
          medium_url?: string | null
          mime_type?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          compression_ratio?: number | null
          display_order?: number | null
          file_name?: string | null
          file_size?: number | null
          full_url?: string | null
          image_id?: number
          image_url?: string
          is_primary?: boolean | null
          item_id?: number | null
          medium_url?: string | null
          mime_type?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      item_price_changes: {
        Row: {
          change_id: number
          change_type: string
          changed_at: string | null
          excel_supplier: string | null
          item_code: string
          new_price: number
          old_price: number | null
          price_diff: number | null
        }
        Insert: {
          change_id?: number
          change_type: string
          changed_at?: string | null
          excel_supplier?: string | null
          item_code: string
          new_price: number
          old_price?: number | null
          price_diff?: number | null
        }
        Update: {
          change_id?: number
          change_type?: string
          changed_at?: string | null
          excel_supplier?: string | null
          item_code?: string
          new_price?: number
          old_price?: number | null
          price_diff?: number | null
        }
        Relationships: []
      }
      item_price_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          item_id: number
          note: string | null
          price_history_id: number
          price_month: string
          price_per_kg: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          item_id: number
          note?: string | null
          price_history_id?: number
          price_month: string
          price_per_kg?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          item_id?: number
          note?: string | null
          price_history_id?: number
          price_month?: string
          price_per_kg?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      item_specifications: {
        Row: {
          created_at: string | null
          data_source: string | null
          height: number | null
          item_code: string
          item_name: string
          material: string | null
          mm_weight: number | null
          source_sheet: string | null
          thickness: number | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          data_source?: string | null
          height?: number | null
          item_code: string
          item_name: string
          material?: string | null
          mm_weight?: number | null
          source_sheet?: string | null
          thickness?: number | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          data_source?: string | null
          height?: number | null
          item_code?: string
          item_name?: string
          material?: string | null
          mm_weight?: number | null
          source_sheet?: string | null
          thickness?: number | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: []
      }
      items: {
        Row: {
          actual_quantity: number | null
          blank_size: number | null
          category: Database["public"]["Enums"]["item_category"]
          coating_status: string | null
          created_at: string | null
          created_by: number | null
          current_stock: number | null
          daily_requirement: number | null
          description: string | null
          height: number | null
          inventory_type: string
          is_active: boolean | null
          item_code: string
          item_id: number
          item_name: string
          item_type: string | null
          kg_unit_price: number | null
          location: string | null
          material: string | null
          material_type: string | null
          material_type_code: string | null
          mm_weight: number | null
          overhead_rate: number | null
          price: number | null
          product_type: string | null
          quality_status: string | null
          safety_stock: number | null
          scrap_amount: number | null
          scrap_rate: number | null
          scrap_unit_price: number | null
          scrap_weight: number | null
          sep: number | null
          spec: string | null
          specific_gravity: number | null
          supplier_id: number | null
          thickness: number | null
          unit: string
          updated_at: string | null
          updated_by: number | null
          vehicle_model: string | null
          warehouse_zone: string | null
          width: number | null
          yield_rate: number | null
        }
        Insert: {
          actual_quantity?: number | null
          blank_size?: number | null
          category: Database["public"]["Enums"]["item_category"]
          coating_status?: string | null
          created_at?: string | null
          created_by?: number | null
          current_stock?: number | null
          daily_requirement?: number | null
          description?: string | null
          height?: number | null
          inventory_type: string
          is_active?: boolean | null
          item_code: string
          item_id?: number
          item_name: string
          item_type?: string | null
          kg_unit_price?: number | null
          location?: string | null
          material?: string | null
          material_type?: string | null
          material_type_code?: string | null
          mm_weight?: number | null
          overhead_rate?: number | null
          price?: number | null
          product_type?: string | null
          quality_status?: string | null
          safety_stock?: number | null
          scrap_amount?: number | null
          scrap_rate?: number | null
          scrap_unit_price?: number | null
          scrap_weight?: number | null
          sep?: number | null
          spec?: string | null
          specific_gravity?: number | null
          supplier_id?: number | null
          thickness?: number | null
          unit?: string
          updated_at?: string | null
          updated_by?: number | null
          vehicle_model?: string | null
          warehouse_zone?: string | null
          width?: number | null
          yield_rate?: number | null
        }
        Update: {
          actual_quantity?: number | null
          blank_size?: number | null
          category?: Database["public"]["Enums"]["item_category"]
          coating_status?: string | null
          created_at?: string | null
          created_by?: number | null
          current_stock?: number | null
          daily_requirement?: number | null
          description?: string | null
          height?: number | null
          inventory_type?: string
          is_active?: boolean | null
          item_code?: string
          item_id?: number
          item_name?: string
          item_type?: string | null
          kg_unit_price?: number | null
          location?: string | null
          material?: string | null
          material_type?: string | null
          material_type_code?: string | null
          mm_weight?: number | null
          overhead_rate?: number | null
          price?: number | null
          product_type?: string | null
          quality_status?: string | null
          safety_stock?: number | null
          scrap_amount?: number | null
          scrap_rate?: number | null
          scrap_unit_price?: number | null
          scrap_weight?: number | null
          sep?: number | null
          spec?: string | null
          specific_gravity?: number | null
          supplier_id?: number | null
          thickness?: number | null
          unit?: string
          updated_at?: string | null
          updated_by?: number | null
          vehicle_model?: string | null
          warehouse_zone?: string | null
          width?: number | null
          yield_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_items_material_type"
            columns: ["material_type_code"]
            isOneToOne: false
            referencedRelation: "material_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      material_types: {
        Row: {
          code: string
          created_at: string
          default_thickness: number | null
          default_unit: string | null
          density: number | null
          description: string | null
          is_active: boolean | null
          material_type_id: number
          name_en: string
          name_ko: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_thickness?: number | null
          default_unit?: string | null
          density?: number | null
          description?: string | null
          is_active?: boolean | null
          material_type_id?: number
          name_en: string
          name_ko: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_thickness?: number | null
          default_unit?: string | null
          density?: number | null
          description?: string | null
          is_active?: boolean | null
          material_type_id?: number
          name_en?: string
          name_ko?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          categories: Json | null
          created_at: string | null
          email_enabled: boolean | null
          preference_id: number
          price_threshold: number | null
          push_enabled: boolean | null
          updated_at: string | null
          user_id: number
        }
        Insert: {
          categories?: Json | null
          created_at?: string | null
          email_enabled?: boolean | null
          preference_id?: number
          price_threshold?: number | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id: number
        }
        Update: {
          categories?: Json | null
          created_at?: string | null
          email_enabled?: boolean | null
          preference_id?: number
          price_threshold?: number | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          is_read: boolean | null
          item_id: number | null
          message: string
          notification_id: number
          title: string
          type: string
          updated_at: string
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          is_read?: boolean | null
          item_id?: number | null
          message: string
          notification_id?: number
          title: string
          type: string
          updated_at?: string
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          is_read?: boolean | null
          item_id?: number | null
          message?: string
          notification_id?: number
          title?: string
          type?: string
          updated_at?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "notifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "notifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          account_number: string | null
          amount: number
          bank_name: string | null
          bill_date: string | null
          bill_drawer: string | null
          bill_number: string | null
          check_bank: string | null
          check_number: string | null
          created_at: string | null
          notes: string | null
          payment_method: string
          payment_split_id: number
          transaction_id: number
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          bill_date?: string | null
          bill_drawer?: string | null
          bill_number?: string | null
          check_bank?: string | null
          check_number?: string | null
          created_at?: string | null
          notes?: string | null
          payment_method: string
          payment_split_id?: number
          transaction_id: number
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          bill_date?: string | null
          bill_drawer?: string | null
          bill_number?: string | null
          check_bank?: string | null
          check_number?: string | null
          created_at?: string | null
          notes?: string | null
          payment_method?: string
          payment_split_id?: number
          transaction_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_splits_transaction_id"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "payment_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          account_number: string | null
          amount: number
          bank_name: string | null
          created_at: string | null
          created_by: string | null
          is_active: boolean | null
          notes: string | null
          payment_date: string
          payment_id: number
          payment_method: string | null
          payment_no: string
          purchase_transaction_id: number | null
          supplier_id: number
          supplier_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          is_active?: boolean | null
          notes?: string | null
          payment_date: string
          payment_id?: number
          payment_method?: string | null
          payment_no: string
          purchase_transaction_id?: number | null
          supplier_id: number
          supplier_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          created_by?: string | null
          is_active?: boolean | null
          notes?: string | null
          payment_date?: string
          payment_id?: number
          payment_method?: string | null
          payment_no?: string
          purchase_transaction_id?: number | null
          supplier_id?: number
          supplier_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payment_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
        ]
      }
      payments: {
        Row: {
          account_number: string | null
          bank_name: string | null
          bill_date: string | null
          bill_drawer: string | null
          bill_number: string | null
          card_number: string | null
          check_number: string | null
          created_at: string
          is_active: boolean
          notes: string | null
          paid_amount: number
          payment_date: string
          payment_id: number
          payment_method: string
          payment_no: string
          purchase_transaction_id: number
          supplier_id: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          bill_date?: string | null
          bill_drawer?: string | null
          bill_number?: string | null
          card_number?: string | null
          check_number?: string | null
          created_at?: string
          is_active?: boolean
          notes?: string | null
          paid_amount: number
          payment_date: string
          payment_id?: number
          payment_method: string
          payment_no: string
          purchase_transaction_id: number
          supplier_id: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          bill_date?: string | null
          bill_drawer?: string | null
          bill_number?: string | null
          card_number?: string | null
          check_number?: string | null
          created_at?: string
          is_active?: boolean
          notes?: string | null
          paid_amount?: number
          payment_date?: string
          payment_id?: number
          payment_method?: string
          payment_no?: string
          purchase_transaction_id?: number
          supplier_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_purchase_transaction_id_fkey"
            columns: ["purchase_transaction_id"]
            isOneToOne: false
            referencedRelation: "purchase_transactions"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
        ]
      }
      portal_access_logs: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          ip_address: string | null
          log_id: number
          portal_user_id: number | null
          resource: string | null
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          ip_address?: string | null
          log_id?: number
          portal_user_id?: number | null
          resource?: string | null
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          ip_address?: string | null
          log_id?: number
          portal_user_id?: number | null
          resource?: string | null
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_logs_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["portal_user_id"]
          },
        ]
      }
      portal_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          ip_address: string | null
          portal_user_id: number
          session_id: number
          session_token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          ip_address?: string | null
          portal_user_id: number
          session_id?: number
          session_token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          ip_address?: string | null
          portal_user_id?: number
          session_id?: number
          session_token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessions_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["portal_user_id"]
          },
        ]
      }
      portal_users: {
        Row: {
          company_id: number
          created_at: string | null
          email: string | null
          is_active: boolean | null
          last_login_at: string | null
          password_hash: string
          portal_user_id: number
          role: string
          updated_at: string | null
          username: string
        }
        Insert: {
          company_id: number
          created_at?: string | null
          email?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash: string
          portal_user_id?: number
          role: string
          updated_at?: string | null
          username: string
        }
        Update: {
          company_id?: number
          created_at?: string | null
          email?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash?: string
          portal_user_id?: number
          role?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "portal_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
        ]
      }
      price_master: {
        Row: {
          created_at: string
          effective_date: string
          is_current: boolean
          item_id: number
          notes: string | null
          price_id: number
          price_type: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          is_current?: boolean
          item_id: number
          notes?: string | null
          price_id?: number
          price_type?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          is_current?: boolean
          item_id?: number
          notes?: string | null
          price_id?: number
          price_type?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_master_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "price_master_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "price_master_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      process_chain_definitions: {
        Row: {
          category: string | null
          chain_code: string
          chain_definition_id: string
          created_at: string
          created_by: number | null
          default_lot_prefix: string | null
          description: string | null
          estimated_duration: number | null
          is_active: boolean | null
          name_en: string
          name_ko: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          chain_code: string
          chain_definition_id?: string
          created_at?: string
          created_by?: number | null
          default_lot_prefix?: string | null
          description?: string | null
          estimated_duration?: number | null
          is_active?: boolean | null
          name_en: string
          name_ko: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          chain_code?: string
          chain_definition_id?: string
          created_at?: string
          created_by?: number | null
          default_lot_prefix?: string | null
          description?: string | null
          estimated_duration?: number | null
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_chain_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      process_chain_steps: {
        Row: {
          auto_next: boolean | null
          chain_definition_id: string
          created_at: string
          expected_duration: number | null
          expected_yield: number | null
          input_item_id: number | null
          is_active: boolean | null
          operation_type: string
          output_item_id: number | null
          quality_check_required: boolean | null
          sequence: number
          step_id: number
          step_name: string | null
          step_settings: Json | null
          updated_at: string
        }
        Insert: {
          auto_next?: boolean | null
          chain_definition_id: string
          created_at?: string
          expected_duration?: number | null
          expected_yield?: number | null
          input_item_id?: number | null
          is_active?: boolean | null
          operation_type: string
          output_item_id?: number | null
          quality_check_required?: boolean | null
          sequence: number
          step_id?: number
          step_name?: string | null
          step_settings?: Json | null
          updated_at?: string
        }
        Update: {
          auto_next?: boolean | null
          chain_definition_id?: string
          created_at?: string
          expected_duration?: number | null
          expected_yield?: number | null
          input_item_id?: number | null
          is_active?: boolean | null
          operation_type?: string
          output_item_id?: number | null
          quality_check_required?: boolean | null
          sequence?: number
          step_id?: number
          step_name?: string | null
          step_settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_chain_steps_chain_definition_id_fkey"
            columns: ["chain_definition_id"]
            isOneToOne: false
            referencedRelation: "process_chain_definitions"
            referencedColumns: ["chain_definition_id"]
          },
          {
            foreignKeyName: "process_chain_steps_chain_definition_id_fkey"
            columns: ["chain_definition_id"]
            isOneToOne: false
            referencedRelation: "v_process_chain_overview"
            referencedColumns: ["chain_definition_id"]
          },
          {
            foreignKeyName: "process_chain_steps_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_chain_steps_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_chain_steps_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_chain_steps_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_chain_steps_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_chain_steps_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      process_flow: {
        Row: {
          created_at: string | null
          flow_date: string | null
          flow_id: number
          flow_type: string
          notes: string | null
          source_batch_id: number | null
          target_batch_id: number | null
        }
        Insert: {
          created_at?: string | null
          flow_date?: string | null
          flow_id?: number
          flow_type: string
          notes?: string | null
          source_batch_id?: number | null
          target_batch_id?: number | null
        }
        Update: {
          created_at?: string | null
          flow_date?: string | null
          flow_id?: number
          flow_type?: string
          notes?: string | null
          source_batch_id?: number | null
          target_batch_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "process_flow_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "process_flow_target_batch_id_fkey"
            columns: ["target_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      process_operations: {
        Row: {
          auto_next_operation: boolean | null
          chain_id: string | null
          chain_sequence: number | null
          child_lot_number: string | null
          coil_process_id: number | null
          completed_at: string | null
          created_at: string
          efficiency: number | null
          input_item_id: number
          input_quantity: number
          lot_number: string | null
          next_operation_type: string | null
          notes: string | null
          operation_id: number
          operation_type: string
          operator_id: number | null
          output_item_id: number
          output_quantity: number
          parent_lot_number: string | null
          parent_operation_id: number | null
          quality_status: string | null
          scheduled_date: string | null
          scrap_quantity: number | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auto_next_operation?: boolean | null
          chain_id?: string | null
          chain_sequence?: number | null
          child_lot_number?: string | null
          coil_process_id?: number | null
          completed_at?: string | null
          created_at?: string
          efficiency?: number | null
          input_item_id: number
          input_quantity: number
          lot_number?: string | null
          next_operation_type?: string | null
          notes?: string | null
          operation_id?: number
          operation_type: string
          operator_id?: number | null
          output_item_id: number
          output_quantity: number
          parent_lot_number?: string | null
          parent_operation_id?: number | null
          quality_status?: string | null
          scheduled_date?: string | null
          scrap_quantity?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto_next_operation?: boolean | null
          chain_id?: string | null
          chain_sequence?: number | null
          child_lot_number?: string | null
          coil_process_id?: number | null
          completed_at?: string | null
          created_at?: string
          efficiency?: number | null
          input_item_id?: number
          input_quantity?: number
          lot_number?: string | null
          next_operation_type?: string | null
          notes?: string | null
          operation_id?: number
          operation_type?: string
          operator_id?: number | null
          output_item_id?: number
          output_quantity?: number
          parent_lot_number?: string | null
          parent_operation_id?: number | null
          quality_status?: string | null
          scheduled_date?: string | null
          scrap_quantity?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_process_operations_coil_process"
            columns: ["coil_process_id"]
            isOneToOne: false
            referencedRelation: "coil_process_history"
            referencedColumns: ["process_id"]
          },
          {
            foreignKeyName: "process_operations_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_operations_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_operations_input_item_id_fkey"
            columns: ["input_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_operations_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_operations_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_operations_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "process_operations_parent_operation_id_fkey"
            columns: ["parent_operation_id"]
            isOneToOne: false
            referencedRelation: "process_operations"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      production_batch: {
        Row: {
          batch_date: string
          batch_id: number
          batch_number: string
          created_at: string | null
          created_by: number | null
          is_active: boolean | null
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          batch_date?: string
          batch_id?: number
          batch_number: string
          created_at?: string | null
          created_by?: number | null
          is_active?: boolean | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_date?: string
          batch_id?: number
          batch_number?: string
          created_at?: string | null
          created_by?: number | null
          is_active?: boolean | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      production_batch_items: {
        Row: {
          batch_id: number
          batch_item_id: number
          created_at: string | null
          defect_quantity: number | null
          item_id: number
          item_type: string
          notes: string | null
          quantity: number
          total_amount: number | null
          unit_price: number | null
        }
        Insert: {
          batch_id: number
          batch_item_id?: number
          created_at?: string | null
          defect_quantity?: number | null
          item_id: number
          item_type: string
          notes?: string | null
          quantity: number
          total_amount?: number | null
          unit_price?: number | null
        }
        Update: {
          batch_id?: number
          batch_item_id?: number
          created_at?: string | null
          defect_quantity?: number | null
          item_id?: number
          item_type?: string
          notes?: string | null
          quantity?: number
          total_amount?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_batch_items_batch_id"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fk_production_batch_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_production_batch_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_production_batch_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "production_batch_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_batch_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_batch_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      purchase_transactions: {
        Row: {
          created_at: string
          created_by: number | null
          is_active: boolean
          item_id: number
          item_name: string | null
          material_type: string | null
          notes: string | null
          paid_amount: number | null
          payment_due_date: string | null
          payment_status: string | null
          quantity: number
          receiving_date: string | null
          spec: string | null
          supplier_id: number
          supplier_name: string | null
          supply_amount: number
          tax_amount: number | null
          tax_invoice_id: number | null
          tax_invoice_received: boolean | null
          total_amount: number
          transaction_date: string
          transaction_id: number
          transaction_no: string
          unit: string | null
          unit_price: number
          updated_at: string
          updated_by: number | null
          vehicle_model: string | null
          warehouse_location: string | null
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          is_active?: boolean
          item_id: number
          item_name?: string | null
          material_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          payment_status?: string | null
          quantity: number
          receiving_date?: string | null
          spec?: string | null
          supplier_id: number
          supplier_name?: string | null
          supply_amount: number
          tax_amount?: number | null
          tax_invoice_id?: number | null
          tax_invoice_received?: boolean | null
          total_amount: number
          transaction_date: string
          transaction_id?: number
          transaction_no: string
          unit?: string | null
          unit_price: number
          updated_at?: string
          updated_by?: number | null
          vehicle_model?: string | null
          warehouse_location?: string | null
        }
        Update: {
          created_at?: string
          created_by?: number | null
          is_active?: boolean
          item_id?: number
          item_name?: string | null
          material_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          payment_status?: string | null
          quantity?: number
          receiving_date?: string | null
          spec?: string | null
          supplier_id?: number
          supplier_name?: string | null
          supply_amount?: number
          tax_amount?: number | null
          tax_invoice_id?: number | null
          tax_invoice_received?: boolean | null
          total_amount?: number
          transaction_date?: string
          transaction_id?: number
          transaction_no?: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
          updated_by?: number | null
          vehicle_model?: string | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "purchase_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
        ]
      }
      sales_transactions: {
        Row: {
          created_at: string
          created_by: number | null
          customer_id: number
          customer_name: string | null
          delivery_address: string | null
          delivery_date: string | null
          is_active: boolean
          item_id: number | null
          item_name: string | null
          material_type: string | null
          notes: string | null
          paid_amount: number | null
          payment_due_date: string | null
          payment_status: string | null
          quantity: number | null
          spec: string | null
          supply_amount: number
          tax_amount: number | null
          tax_invoice_id: number | null
          tax_invoice_issued: boolean | null
          total_amount: number
          transaction_date: string
          transaction_id: number
          transaction_no: string
          unit: string | null
          unit_price: number | null
          updated_at: string
          updated_by: number | null
          vehicle_model: string | null
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          customer_id: number
          customer_name?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          is_active?: boolean
          item_id?: number | null
          item_name?: string | null
          material_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          payment_status?: string | null
          quantity?: number | null
          spec?: string | null
          supply_amount: number
          tax_amount?: number | null
          tax_invoice_id?: number | null
          tax_invoice_issued?: boolean | null
          total_amount: number
          transaction_date: string
          transaction_id?: number
          transaction_no: string
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          updated_by?: number | null
          vehicle_model?: string | null
        }
        Update: {
          created_at?: string
          created_by?: number | null
          customer_id?: number
          customer_name?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          is_active?: boolean
          item_id?: number | null
          item_name?: string | null
          material_type?: string | null
          notes?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          payment_status?: string | null
          quantity?: number | null
          spec?: string | null
          supply_amount?: number
          tax_amount?: number | null
          tax_invoice_id?: number | null
          tax_invoice_issued?: boolean | null
          total_amount?: number
          transaction_date?: string
          transaction_id?: number
          transaction_no?: string
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          updated_by?: number | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sales_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      scrap_tracking: {
        Row: {
          created_at: string
          is_active: boolean
          item_id: number
          notes: string | null
          production_quantity: number
          scrap_id: number
          scrap_revenue: number | null
          scrap_unit_price: number
          scrap_weight: number
          tracking_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          item_id: number
          notes?: string | null
          production_quantity: number
          scrap_id?: number
          scrap_revenue?: number | null
          scrap_unit_price: number
          scrap_weight: number
          tracking_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          item_id?: number
          notes?: string | null
          production_quantity?: number
          scrap_id?: number
          scrap_revenue?: number | null
          scrap_unit_price?: number
          scrap_weight?: number
          tracking_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrap_tracking_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "scrap_tracking_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "scrap_tracking_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      serials: {
        Row: {
          created_at: string | null
          current_number: number
          prefix: string
          serial_id: number
          updated_at: string | null
          year_month: string
        }
        Insert: {
          created_at?: string | null
          current_number?: number
          prefix: string
          serial_id?: number
          updated_at?: string | null
          year_month: string
        }
        Update: {
          created_at?: string | null
          current_number?: number
          prefix?: string
          serial_id?: number
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      sheet_process_history: {
        Row: {
          created_at: string
          input_quantity: number
          notes: string | null
          operator_id: number | null
          output_quantity: number
          process_date: string
          process_id: number
          process_type: string
          source_item_id: number
          status: string
          target_item_id: number
          updated_at: string
          yield_rate: number | null
        }
        Insert: {
          created_at?: string
          input_quantity: number
          notes?: string | null
          operator_id?: number | null
          output_quantity: number
          process_date?: string
          process_id?: number
          process_type: string
          source_item_id: number
          status?: string
          target_item_id: number
          updated_at?: string
          yield_rate?: number | null
        }
        Update: {
          created_at?: string
          input_quantity?: number
          notes?: string | null
          operator_id?: number | null
          output_quantity?: number
          process_date?: string
          process_id?: number
          process_type?: string
          source_item_id?: number
          status?: string
          target_item_id?: number
          updated_at?: string
          yield_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sheet_process_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sheet_process_history_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sheet_process_history_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sheet_process_history_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sheet_process_history_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sheet_process_history_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sheet_process_history_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_id: number
          adjustment_number: string
          adjustment_quantity: number | null
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          approval_date: string | null
          approved_by: number | null
          created_at: string | null
          created_by: number
          item_id: number
          quantity_after: number
          quantity_before: number
          reason: string
          status: string | null
          total_cost_impact: number | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_id: number
        }
        Insert: {
          adjustment_date?: string
          adjustment_id?: number
          adjustment_number: string
          adjustment_quantity?: number | null
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          approval_date?: string | null
          approved_by?: number | null
          created_at?: string | null
          created_by: number
          item_id: number
          quantity_after: number
          quantity_before: number
          reason: string
          status?: string | null
          total_cost_impact?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_id: number
        }
        Update: {
          adjustment_date?: string
          adjustment_id?: number
          adjustment_number?: string
          adjustment_quantity?: number | null
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          approval_date?: string | null
          approved_by?: number | null
          created_at?: string | null
          created_by?: number
          item_id?: number
          quantity_after?: number
          quantity_before?: number
          reason?: string
          status?: string | null
          total_cost_impact?: number | null
          unit_cost?: number | null
          updated_at?: string | null
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["warehouse_id"]
          },
        ]
      }
      stock_history: {
        Row: {
          change_type: string
          company_id: number | null
          created_at: string
          created_by: number | null
          history_id: number
          item_id: number
          lot_number: string | null
          notes: string | null
          quantity_change: number
          reference_id: number | null
          reference_type: string
          stock_after: number
          stock_before: number
        }
        Insert: {
          change_type: string
          company_id?: number | null
          created_at?: string
          created_by?: number | null
          history_id?: number
          item_id: number
          lot_number?: string | null
          notes?: string | null
          quantity_change: number
          reference_id?: number | null
          reference_type: string
          stock_after: number
          stock_before: number
        }
        Update: {
          change_type?: string
          company_id?: number | null
          created_at?: string
          created_by?: number | null
          history_id?: number
          item_id?: number
          lot_number?: string | null
          notes?: string | null
          quantity_change?: number
          reference_id?: number | null
          reference_type?: string
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "stock_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_monthly_accounting"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "stock_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          is_active: boolean | null
          name: string
          password: string
          phone: string | null
          role: string
          updated_at: string | null
          user_id: number
          username: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          is_active?: boolean | null
          name: string
          password: string
          phone?: string | null
          role?: string
          updated_at?: string | null
          user_id?: number
          username: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          is_active?: boolean | null
          name?: string
          password?: string
          phone?: string | null
          role?: string
          updated_at?: string | null
          user_id?: number
          username?: string
        }
        Relationships: []
      }
      warehouse_stock: {
        Row: {
          available_quantity: number | null
          created_at: string | null
          current_quantity: number | null
          item_id: number
          last_in_date: string | null
          last_out_date: string | null
          location_code: string | null
          max_stock: number | null
          min_stock: number | null
          reserved_quantity: number | null
          updated_at: string | null
          warehouse_id: number
          warehouse_stock_id: number
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string | null
          current_quantity?: number | null
          item_id: number
          last_in_date?: string | null
          last_out_date?: string | null
          location_code?: string | null
          max_stock?: number | null
          min_stock?: number | null
          reserved_quantity?: number | null
          updated_at?: string | null
          warehouse_id: number
          warehouse_stock_id?: number
        }
        Update: {
          available_quantity?: number | null
          created_at?: string | null
          current_quantity?: number | null
          item_id?: number
          last_in_date?: string | null
          last_out_date?: string | null
          location_code?: string | null
          max_stock?: number | null
          min_stock?: number | null
          reserved_quantity?: number | null
          updated_at?: string | null
          warehouse_id?: number
          warehouse_stock_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "warehouse_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "warehouse_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["warehouse_id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: number | null
          current_usage: number | null
          is_active: boolean | null
          manager_name: string | null
          manager_phone: string | null
          max_capacity: number | null
          temperature_controlled: boolean | null
          updated_at: string | null
          warehouse_code: string
          warehouse_id: number
          warehouse_name: string
          warehouse_type: Database["public"]["Enums"]["warehouse_type"]
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: number | null
          current_usage?: number | null
          is_active?: boolean | null
          manager_name?: string | null
          manager_phone?: string | null
          max_capacity?: number | null
          temperature_controlled?: boolean | null
          updated_at?: string | null
          warehouse_code: string
          warehouse_id?: number
          warehouse_name: string
          warehouse_type: Database["public"]["Enums"]["warehouse_type"]
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: number | null
          current_usage?: number | null
          is_active?: boolean | null
          manager_name?: string | null
          manager_phone?: string | null
          max_capacity?: number | null
          temperature_controlled?: boolean | null
          updated_at?: string | null
          warehouse_code?: string
          warehouse_id?: number
          warehouse_name?: string
          warehouse_type?: Database["public"]["Enums"]["warehouse_type"]
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      current_stock_view: {
        Row: {
          category: Database["public"]["Enums"]["item_category"] | null
          current_stock: number | null
          is_active: boolean | null
          item_code: string | null
          item_id: number | null
          item_name: string | null
          location: string | null
          safety_stock: number | null
          spec: string | null
          stock_status: string | null
          unit: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"] | null
          current_stock?: number | null
          is_active?: boolean | null
          item_code?: string | null
          item_id?: number | null
          item_name?: string | null
          location?: string | null
          safety_stock?: number | null
          spec?: string | null
          stock_status?: never
          unit?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"] | null
          current_stock?: number | null
          is_active?: boolean | null
          item_code?: string | null
          item_id?: number | null
          item_name?: string | null
          location?: string | null
          safety_stock?: number | null
          spec?: string | null
          stock_status?: never
          unit?: string | null
        }
        Relationships: []
      }
      mv_daily_stock_calendar: {
        Row: {
          adjustment_qty: number | null
          calendar_date: string | null
          closing_stock: number | null
          item_code: string | null
          item_id: number | null
          item_name: string | null
          opening_stock: number | null
          receiving_qty: number | null
          shipping_qty: number | null
          stock_value: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_balance_sheet: {
        Row: {
          accounts_payable: number | null
          accounts_receivable: number | null
          cash_from_sales: number | null
          cash_to_suppliers: number | null
          net_payable: number | null
          net_receivable: number | null
          net_working_capital: number | null
          period: string | null
        }
        Relationships: []
      }
      v_bom_cost_summary: {
        Row: {
          max_level: number | null
          min_level: number | null
          net_cost_per_unit: number | null
          parent_code: string | null
          parent_item_id: number | null
          parent_name: string | null
          total_components: number | null
          total_material_cost: number | null
          total_scrap_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      v_bom_details: {
        Row: {
          bom_id: number | null
          child_code: string | null
          child_item_id: number | null
          child_name: string | null
          component_cost: number | null
          created_at: string | null
          effective_unit_price: number | null
          item_type: string | null
          level_no: number | null
          net_cost: number | null
          parent_code: string | null
          parent_item_id: number | null
          parent_name: string | null
          production_unit_price: number | null
          purchase_unit_price: number | null
          quantity_required: number | null
          scrap_revenue_per_piece: number | null
          updated_at: string | null
          weight_per_piece: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "current_stock_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_stock_calendar"
            referencedColumns: ["item_id"]
          },
        ]
      }
      v_cash_flow: {
        Row: {
          cash_inflow_operations: number | null
          cash_outflow_operations: number | null
          cumulative_cash_flow: number | null
          net_cash_flow: number | null
          net_operating_cash: number | null
          period: string | null
        }
        Relationships: []
      }
      v_category_monthly_summary: {
        Row: {
          avg_purchase_per_company: number | null
          avg_sales_per_company: number | null
          company_category: string | null
          company_count: number | null
          month: string | null
          net_amount: number | null
          purchase_percentage: number | null
          sales_percentage: number | null
          total_purchase_transactions: number | null
          total_purchases: number | null
          total_sales: number | null
          total_sales_transactions: number | null
        }
        Relationships: []
      }
      v_index_usage_stats: {
        Row: {
          index_scans: number | null
          index_size: string | null
          indexname: unknown
          schemaname: unknown
          tablename: unknown
          tuples_fetched: number | null
          tuples_read: number | null
          usage_category: string | null
        }
        Relationships: []
      }
      v_monthly_accounting: {
        Row: {
          business_info: Json | null
          business_number: string | null
          company_category: string | null
          company_code: string | null
          company_id: number | null
          company_name: string | null
          month: string | null
          net_amount: number | null
          purchase_amount: number | null
          purchase_count: number | null
          representative: string | null
          sales_amount: number | null
          sales_count: number | null
        }
        Relationships: []
      }
      v_process_chain_overview: {
        Row: {
          avg_expected_yield: number | null
          category: string | null
          chain_code: string | null
          chain_definition_id: string | null
          created_at: string | null
          default_lot_prefix: string | null
          description: string | null
          estimated_duration: number | null
          is_active: boolean | null
          name_en: string | null
          name_ko: string | null
          operation_sequence: string[] | null
          total_expected_duration: number | null
          total_steps: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      analyze_index_performance: {
        Args: never
        Returns: {
          index_name: string
          index_scans: number
          recommendation: string
          size_mb: number
          table_name: string
        }[]
      }
      create_receiving_transaction:
        | {
            Args: {
              p_company_id?: number
              p_item_id: number
              p_notes?: string
              p_quantity: number
              p_reference_number?: string
              p_total_amount: number
              p_transaction_date?: string
              p_unit_price: number
            }
            Returns: {
              current_stock: number
              item_id: number
              quantity: number
              total_amount: number
              transaction_id: number
              unit_price: number
            }[]
          }
        | {
            Args: {
              p_arrival_date?: string
              p_company_id?: number
              p_item_id: number
              p_notes?: string
              p_quantity: number
              p_reference_number?: string
              p_total_amount: number
              p_transaction_date?: string
              p_unit_price: number
            }
            Returns: {
              current_stock: number
              item_id: number
              quantity: number
              total_amount: number
              transaction_id: number
              unit_price: number
            }[]
          }
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      execute_sql: {
        Args: { params?: Json; query_text: string }
        Returns: Json
      }
      execute_transaction: { Args: { queries: Json }; Returns: Json }
      generate_collection_no: { Args: never; Returns: string }
      generate_contract_no: {
        Args: { p_contract_type: string }
        Returns: string
      }
      generate_lot_number: {
        Args: { p_item_id: number; p_operation_type: string }
        Returns: string
      }
      generate_payment_no: { Args: never; Returns: string }
      generate_purchase_no: { Args: never; Returns: string }
      generate_purchase_transaction_no: { Args: never; Returns: string }
      generate_sales_no: { Args: never; Returns: string }
      generate_sales_transaction_no: { Args: never; Returns: string }
      get_business_info_field: {
        Args: { p_business_info: Json; p_field: string }
        Returns: string
      }
      get_next_serial: { Args: { prefix_param: string }; Returns: string }
      get_portal_user_context: { Args: never; Returns: number }
      get_portal_user_role: { Args: { user_id: number }; Returns: string }
      set_portal_user_context: { Args: { user_id: number }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      adjustment_type: "증가" | "감소" | "정정" | "손실" | "발견" | "기타"
      company_type: "고객사" | "공급사" | "협력사" | "기타"
      item_category: "원자재" | "부자재" | "반제품" | "제품" | "상품"
      transaction_status: "대기" | "진행중" | "완료" | "취소"
      transaction_type:
        | "입고"
        | "출고"
        | "생산입고"
        | "생산출고"
        | "이동"
        | "조정"
        | "폐기"
        | "재고조정"
        | "생산투입"
        | "생산산출"
        | "생산불량"
      warehouse_type: "원자재" | "반제품" | "제품" | "기타"
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
  public: {
    Enums: {
      adjustment_type: ["증가", "감소", "정정", "손실", "발견", "기타"],
      company_type: ["고객사", "공급사", "협력사", "기타"],
      item_category: ["원자재", "부자재", "반제품", "제품", "상품"],
      transaction_status: ["대기", "진행중", "완료", "취소"],
      transaction_type: [
        "입고",
        "출고",
        "생산입고",
        "생산출고",
        "이동",
        "조정",
        "폐기",
        "재고조정",
        "생산투입",
        "생산산출",
        "생산불량",
      ],
      warehouse_type: ["원자재", "반제품", "제품", "기타"],
    },
  },
} as const
