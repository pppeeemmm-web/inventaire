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
  public: {
    Tables: {
      ai_agent: {
        Row: {
          id: string
          models: Json
          seen_at: string
          version: string | null
        }
        Insert: {
          id: string
          models?: Json
          seen_at?: string
          version?: string | null
        }
        Update: {
          id?: string
          models?: Json
          seen_at?: string
          version?: string | null
        }
        Relationships: []
      }
      ai_job: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          done_at: string | null
          error: string | null
          id: number
          kind: string
          payload: Json
          requested_by: string | null
          result: Json | null
          started_at: string | null
          status: string
          target_id: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          done_at?: string | null
          error?: string | null
          id?: never
          kind: string
          payload?: Json
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          target_id?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          done_at?: string | null
          error?: string | null
          id?: never
          kind?: string
          payload?: Json
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          target_id?: string | null
        }
        Relationships: []
      }
      broadcast_events: {
        Row: {
          created_at: string
          event_type: string
          external_url: string | null
          id: string
          oeuvre_id: number | null
          payload: Json | null
          platform: string
          priority: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          external_url?: string | null
          id?: string
          oeuvre_id?: number | null
          payload?: Json | null
          platform: string
          priority?: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          external_url?: string | null
          id?: string
          oeuvre_id?: number | null
          payload?: Json | null
          platform?: string
          priority?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_events_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "broadcast_events_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      calendar_account: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          primary_calendar_id: string | null
          provider: string
          refresh_token_encrypted: string
          scopes: string | null
          tenant_id: string | null
          token_salt: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          primary_calendar_id?: string | null
          provider: string
          refresh_token_encrypted: string
          scopes?: string | null
          tenant_id?: string | null
          token_salt?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          primary_calendar_id?: string | null
          provider?: string
          refresh_token_encrypted?: string
          scopes?: string | null
          tenant_id?: string | null
          token_salt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      calendar_event_link: {
        Row: {
          auth_user_id: string
          calendar_account_id: string
          date_key: string | null
          external_event_id: string
          id: string
          provider: string
          suivi_etape_id: string | null
          suivi_process_id: string | null
          sync_etag: string | null
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          auth_user_id: string
          calendar_account_id: string
          date_key?: string | null
          external_event_id: string
          id?: string
          provider: string
          suivi_etape_id?: string | null
          suivi_process_id?: string | null
          sync_etag?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          auth_user_id?: string
          calendar_account_id?: string
          date_key?: string | null
          external_event_id?: string
          id?: string
          provider?: string
          suivi_etape_id?: string | null
          suivi_process_id?: string | null
          sync_etag?: string | null
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_link_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_link_suivi_etape_id_fkey"
            columns: ["suivi_etape_id"]
            isOneToOne: false
            referencedRelation: "suivi_etape"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_link_suivi_process_id_fkey"
            columns: ["suivi_process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_link_suivi_process_id_fkey"
            columns: ["suivi_process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_link_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      concept: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          discussion_closed_at: string | null
          energie: number | null
          id: string
          image_note: string | null
          maturity: string
          medium: string | null
          notes: string | null
          oeuvre_id: number | null
          parent_id: string | null
          statut: string
          themes: string[] | null
          titre: string
          updated_at: string
          weight: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discussion_closed_at?: string | null
          energie?: number | null
          id?: string
          image_note?: string | null
          maturity?: string
          medium?: string | null
          notes?: string | null
          oeuvre_id?: number | null
          parent_id?: string | null
          statut?: string
          themes?: string[] | null
          titre?: string
          updated_at?: string
          weight?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discussion_closed_at?: string | null
          energie?: number | null
          id?: string
          image_note?: string | null
          maturity?: string
          medium?: string | null
          notes?: string | null
          oeuvre_id?: number | null
          parent_id?: string | null
          statut?: string
          themes?: string[] | null
          titre?: string
          updated_at?: string
          weight?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "concept_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "concept_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_change: {
        Row: {
          changed_at: string
          changed_by: string | null
          concept_id: string
          from_value: string | null
          id: number
          to_value: string | null
          what: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          concept_id: string
          from_value?: string | null
          id?: never
          to_value?: string | null
          what: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          concept_id?: string
          from_value?: string | null
          id?: never
          to_value?: string | null
          what?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_change_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_issue: {
        Row: {
          author_id: string | null
          created_at: string
          description: string
          id: number
          location: string | null
          photo_key: string | null
          report_id: number
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          description: string
          id?: never
          location?: string | null
          photo_key?: string | null
          report_id: number
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string
          id?: never
          location?: string | null
          photo_key?: string | null
          report_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "condition_issue_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "condition_report"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_report: {
        Row: {
          action: string | null
          action_status: string
          author_id: string | null
          created_at: string
          event_on: string | null
          event_precision: string | null
          examined_on: string
          examiner: string | null
          grade: string | null
          id: number
          kind: string
          notes: string | null
          oeuvre_id: number
          resolved_on: string | null
          updated_at: string
        }
        Insert: {
          action?: string | null
          action_status?: string
          author_id?: string | null
          created_at?: string
          event_on?: string | null
          event_precision?: string | null
          examined_on?: string
          examiner?: string | null
          grade?: string | null
          id?: never
          kind?: string
          notes?: string | null
          oeuvre_id: number
          resolved_on?: string | null
          updated_at?: string
        }
        Update: {
          action?: string | null
          action_status?: string
          author_id?: string | null
          created_at?: string
          event_on?: string | null
          event_precision?: string | null
          examined_on?: string
          examiner?: string | null
          grade?: string | null
          id?: never
          kind?: string
          notes?: string | null
          oeuvre_id?: number
          resolved_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condition_report_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "condition_report_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      constellation_map: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          r2_key: string
          title: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          r2_key: string
          title: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          r2_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      Contact: {
        Row: {
          Actif: boolean | null
          Adresse: string | null
          auth_user_id: string | null
          CodePostal: string | null
          Connecté: boolean | null
          ContactID: number
          Email: string | null
          Facebook: string | null
          "GDPR Requête": boolean | null
          Genre: string | null
          IndicatifPays1: string | null
          IndicatifPays2: string | null
          Instagram: string | null
          is_admin: boolean | null
          is_private: boolean | null
          is_team_member: boolean
          IsTeamMember: boolean | null
          LinkedIn: string | null
          Nom: string | null
          NomInstitution: string | null
          Notes: string | null
          Pays: string | null
          PersonneResponsable: string | null
          Prénom: string | null
          PropriétaireOeuvre: boolean | null
          Role: string | null
          RoleResponsable: string | null
          signature_r2_key: string | null
          Téléphone1: string | null
          Téléphone2: string | null
          Twitter: string | null
          Type: string | null
          TypeContact: number | null
          Ville: string | null
          Website: string | null
        }
        Insert: {
          Actif?: boolean | null
          Adresse?: string | null
          auth_user_id?: string | null
          CodePostal?: string | null
          Connecté?: boolean | null
          ContactID?: number
          Email?: string | null
          Facebook?: string | null
          "GDPR Requête"?: boolean | null
          Genre?: string | null
          IndicatifPays1?: string | null
          IndicatifPays2?: string | null
          Instagram?: string | null
          is_admin?: boolean | null
          is_private?: boolean | null
          is_team_member?: boolean
          IsTeamMember?: boolean | null
          LinkedIn?: string | null
          Nom?: string | null
          NomInstitution?: string | null
          Notes?: string | null
          Pays?: string | null
          PersonneResponsable?: string | null
          Prénom?: string | null
          PropriétaireOeuvre?: boolean | null
          Role?: string | null
          RoleResponsable?: string | null
          signature_r2_key?: string | null
          Téléphone1?: string | null
          Téléphone2?: string | null
          Twitter?: string | null
          Type?: string | null
          TypeContact?: number | null
          Ville?: string | null
          Website?: string | null
        }
        Update: {
          Actif?: boolean | null
          Adresse?: string | null
          auth_user_id?: string | null
          CodePostal?: string | null
          Connecté?: boolean | null
          ContactID?: number
          Email?: string | null
          Facebook?: string | null
          "GDPR Requête"?: boolean | null
          Genre?: string | null
          IndicatifPays1?: string | null
          IndicatifPays2?: string | null
          Instagram?: string | null
          is_admin?: boolean | null
          is_private?: boolean | null
          is_team_member?: boolean
          IsTeamMember?: boolean | null
          LinkedIn?: string | null
          Nom?: string | null
          NomInstitution?: string | null
          Notes?: string | null
          Pays?: string | null
          PersonneResponsable?: string | null
          Prénom?: string | null
          PropriétaireOeuvre?: boolean | null
          Role?: string | null
          RoleResponsable?: string | null
          signature_r2_key?: string | null
          Téléphone1?: string | null
          Téléphone2?: string | null
          Twitter?: string | null
          Type?: string | null
          TypeContact?: number | null
          Ville?: string | null
          Website?: string | null
        }
        Relationships: []
      }
      contact_addresses: {
        Row: {
          adresse: string | null
          code_postal: string | null
          contact_id: number
          created_at: string | null
          id: number
          label: string | null
          pays: string | null
          position: number | null
          shipping_notes: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          contact_id: number
          created_at?: string | null
          id?: number
          label?: string | null
          pays?: string | null
          position?: number | null
          shipping_notes?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          contact_id?: number
          created_at?: string | null
          id?: number
          label?: string | null
          pays?: string | null
          position?: number | null
          shipping_notes?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_addresses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      contact_emails: {
        Row: {
          contact_id: number | null
          created_at: string | null
          email: string
          id: number
          is_primary: boolean | null
          label: string | null
        }
        Insert: {
          contact_id?: number | null
          created_at?: string | null
          email: string
          id?: number
          is_primary?: boolean | null
          label?: string | null
        }
        Update: {
          contact_id?: number | null
          created_at?: string | null
          email?: string
          id?: number
          is_primary?: boolean | null
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: number | null
          country_code: string | null
          created_at: string | null
          id: number
          is_primary: boolean | null
          label: string | null
          phone: string
        }
        Insert: {
          contact_id?: number | null
          country_code?: string | null
          created_at?: string | null
          id?: number
          is_primary?: boolean | null
          label?: string | null
          phone: string
        }
        Update: {
          contact_id?: number | null
          country_code?: string | null
          created_at?: string | null
          id?: number
          is_primary?: boolean | null
          label?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      contact_place: {
        Row: {
          contact_id: number
          created_at: string
          created_by: string | null
          id: number
          is_primary: boolean
          key_name: string | null
          knows_code_since: string | null
          label: string | null
          level: number | null
          place_id: number
          position: number | null
          role: string
          since: string | null
          until: string | null
        }
        Insert: {
          contact_id: number
          created_at?: string
          created_by?: string | null
          id?: never
          is_primary?: boolean
          key_name?: string | null
          knows_code_since?: string | null
          label?: string | null
          level?: number | null
          place_id: number
          position?: number | null
          role: string
          since?: string | null
          until?: string | null
        }
        Update: {
          contact_id?: number
          created_at?: string
          created_by?: string | null
          id?: never
          is_primary?: boolean
          key_name?: string | null
          knows_code_since?: string | null
          label?: string | null
          level?: number | null
          place_id?: number
          position?: number | null
          role?: string
          since?: string | null
          until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_place_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "contact_place_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_socials: {
        Row: {
          contact_id: number | null
          created_at: string | null
          handle: string
          id: number
          platform: string
        }
        Insert: {
          contact_id?: number | null
          created_at?: string | null
          handle: string
          id?: number
          platform: string
        }
        Update: {
          contact_id?: number | null
          created_at?: string | null
          handle?: string
          id?: number
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_socials_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      contact_websites: {
        Row: {
          contact_id: number | null
          created_at: string | null
          id: number
          label: string | null
          url: string
        }
        Insert: {
          contact_id?: number | null
          created_at?: string | null
          id?: number
          label?: string | null
          url: string
        }
        Update: {
          contact_id?: number | null
          created_at?: string | null
          id?: number
          label?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_websites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      document: {
        Row: {
          cert_hash: string | null
          cert_id: string | null
          concept_id: string | null
          contact_id: number | null
          created_at: string
          doc_date: string | null
          expense_id: number | null
          external_url: string | null
          file_size: number | null
          folder: string | null
          id: string
          kind: string | null
          local_location: string | null
          mime_type: string | null
          name: string
          notes: string | null
          oeuvre_id: number | null
          oeuvre_ids: number[] | null
          process_id: string | null
          source: string
          storage_path: string | null
          supply_order_id: number | null
          work_order_id: string | null
        }
        Insert: {
          cert_hash?: string | null
          cert_id?: string | null
          concept_id?: string | null
          contact_id?: number | null
          created_at?: string
          doc_date?: string | null
          expense_id?: number | null
          external_url?: string | null
          file_size?: number | null
          folder?: string | null
          id?: string
          kind?: string | null
          local_location?: string | null
          mime_type?: string | null
          name: string
          notes?: string | null
          oeuvre_id?: number | null
          oeuvre_ids?: number[] | null
          process_id?: string | null
          source?: string
          storage_path?: string | null
          supply_order_id?: number | null
          work_order_id?: string | null
        }
        Update: {
          cert_hash?: string | null
          cert_id?: string | null
          concept_id?: string | null
          contact_id?: number | null
          created_at?: string
          doc_date?: string | null
          expense_id?: number | null
          external_url?: string | null
          file_size?: number | null
          folder?: string | null
          id?: string
          kind?: string | null
          local_location?: string | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          oeuvre_id?: number | null
          oeuvre_ids?: number[] | null
          process_id?: string | null
          source?: string
          storage_path?: string | null
          supply_order_id?: number | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "document_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "document_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "document_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_supply_order_id_fkey"
            columns: ["supply_order_id"]
            isOneToOne: false
            referencedRelation: "supply_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contact: {
        Row: {
          contact_id: number
          created_at: string
          id: string
          position: number
          process_id: string
          role: string
        }
        Insert: {
          contact_id: number
          created_at?: string
          id?: string
          position?: number
          process_id: string
          role: string
        }
        Update: {
          contact_id?: number
          created_at?: string
          id?: string
          position?: number
          process_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_contact_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "event_contact_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_contact_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      event_work: {
        Row: {
          cartel_at: string | null
          constat_back_at: string | null
          constat_out_at: string | null
          hung_at: string | null
          oeuvre_id: number
          packing_at: string | null
          photo_at: string | null
          presentation_at: string | null
          process_id: string
          relation: string | null
          taken_down_at: string | null
          unpacked_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cartel_at?: string | null
          constat_back_at?: string | null
          constat_out_at?: string | null
          hung_at?: string | null
          oeuvre_id: number
          packing_at?: string | null
          photo_at?: string | null
          presentation_at?: string | null
          process_id: string
          relation?: string | null
          taken_down_at?: string | null
          unpacked_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cartel_at?: string | null
          constat_back_at?: string | null
          constat_out_at?: string | null
          hung_at?: string | null
          oeuvre_id?: number
          packing_at?: string | null
          photo_at?: string | null
          presentation_at?: string | null
          process_id?: string
          relation?: string | null
          taken_down_at?: string | null
          unpacked_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "event_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "event_work_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_work_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_layout: {
        Row: {
          created_at: string
          floorplan_h: number | null
          floorplan_path: string | null
          floorplan_w: number | null
          id: string
          nom: string
          notes: string | null
          placements: Json
          process_id: string | null
          updated_at: string
          walls: Json
        }
        Insert: {
          created_at?: string
          floorplan_h?: number | null
          floorplan_path?: string | null
          floorplan_w?: number | null
          id?: string
          nom?: string
          notes?: string | null
          placements?: Json
          process_id?: string | null
          updated_at?: string
          walls?: Json
        }
        Update: {
          created_at?: string
          floorplan_h?: number | null
          floorplan_path?: string | null
          floorplan_w?: number | null
          id?: string
          nom?: string
          notes?: string | null
          placements?: Json
          process_id?: string | null
          updated_at?: string
          walls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_layout_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_layout_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          category: string | null
          contact_id: number | null
          created_at: string | null
          date: string
          fiscal_year: number | null
          id: number
          libelle: string | null
          montant_ht: number | null
          montant_ttc: number
          notes: string | null
          receipt_ref: string | null
          tva_rate: number | null
          type: string | null
        }
        Insert: {
          category?: string | null
          contact_id?: number | null
          created_at?: string | null
          date: string
          fiscal_year?: number | null
          id?: never
          libelle?: string | null
          montant_ht?: number | null
          montant_ttc: number
          notes?: string | null
          receipt_ref?: string | null
          tva_rate?: number | null
          type?: string | null
        }
        Update: {
          category?: string | null
          contact_id?: number | null
          created_at?: string | null
          date?: string
          fiscal_year?: number | null
          id?: never
          libelle?: string | null
          montant_ht?: number | null
          montant_ttc?: number
          notes?: string | null
          receipt_ref?: string | null
          tva_rate?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      expense_oeuvre: {
        Row: {
          amount: number | null
          created_at: string
          expense_id: number
          oeuvre_id: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          expense_id: number
          oeuvre_id: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          expense_id?: number
          oeuvre_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_oeuvre_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_oeuvre_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "expense_oeuvre_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      feed_item_state: {
        Row: {
          at: string
          item_id: string
          item_kind: string
          recalled_at: string | null
          state: string
          user_id: string
        }
        Insert: {
          at?: string
          item_id: string
          item_kind: string
          recalled_at?: string | null
          state: string
          user_id?: string
        }
        Update: {
          at?: string
          item_id?: string
          item_kind?: string
          recalled_at?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      forest_pins: {
        Row: {
          created_at: string
          id: string
          label: string | null
          lat: number
          lng: number
          rotation: number
          size: number
          work_id: number
          z: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          lat: number
          lng: number
          rotation?: number
          size?: number
          work_id: number
          z?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          lat?: number
          lng?: number
          rotation?: number
          size?: number
          work_id?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "forest_pins_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "forest_pins_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      Format: {
        Row: {
          Format: string | null
          FormatID: number
        }
        Insert: {
          Format?: string | null
          FormatID: number
        }
        Update: {
          Format?: string | null
          FormatID?: number
        }
        Relationships: []
      }
      inquiry: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          oeuvre_id: number | null
          private_link_token: string | null
          status: string
          work_order_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          oeuvre_id?: number | null
          private_link_token?: string | null
          status?: string
          work_order_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          oeuvre_id?: number | null
          private_link_token?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "inquiry_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "inquiry_private_link_token_fkey"
            columns: ["private_link_token"]
            isOneToOne: false
            referencedRelation: "private_link"
            referencedColumns: ["token"]
          },
          {
            foreignKeyName: "inquiry_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      inspiration_photo: {
        Row: {
          author_id: string
          caption: string | null
          concept_id: string | null
          created_at: string
          day: string
          id: string
          image_key: string
          oeuvre_id: number | null
        }
        Insert: {
          author_id?: string
          caption?: string | null
          concept_id?: string | null
          created_at?: string
          day: string
          id?: string
          image_key: string
          oeuvre_id?: number | null
        }
        Update: {
          author_id?: string
          caption?: string | null
          concept_id?: string | null
          created_at?: string
          day?: string
          id?: string
          image_key?: string
          oeuvre_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspiration_photo_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspiration_photo_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "inspiration_photo_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      insurance_claim: {
        Row: {
          amount_claimed: number | null
          amount_paid: number | null
          claim_ref: string | null
          condition_report_id: number | null
          created_at: string
          created_by: string | null
          filed_on: string | null
          id: string
          insurer: string
          notes: string | null
          oeuvre_id: number
          paid_on: string | null
          police_report_ref: string | null
          shipment_id: string | null
          status: string
          work_order_id: string | null
        }
        Insert: {
          amount_claimed?: number | null
          amount_paid?: number | null
          claim_ref?: string | null
          condition_report_id?: number | null
          created_at?: string
          created_by?: string | null
          filed_on?: string | null
          id?: string
          insurer: string
          notes?: string | null
          oeuvre_id: number
          paid_on?: string | null
          police_report_ref?: string | null
          shipment_id?: string | null
          status?: string
          work_order_id?: string | null
        }
        Update: {
          amount_claimed?: number | null
          amount_paid?: number | null
          claim_ref?: string | null
          condition_report_id?: number | null
          created_at?: string
          created_by?: string | null
          filed_on?: string | null
          id?: string
          insurer?: string
          notes?: string | null
          oeuvre_id?: number
          paid_on?: string | null
          police_report_ref?: string | null
          shipment_id?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claim_condition_report_id_fkey"
            columns: ["condition_report_id"]
            isOneToOne: false
            referencedRelation: "condition_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claim_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "insurance_claim_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "insurance_claim_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claim_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice: {
        Row: {
          created_at: string
          created_by: string | null
          credits_invoice_id: string | null
          currency: string
          id: string
          issued_on: string
          kind: string
          lines: Json
          notes: string | null
          number: string | null
          paper_path: string | null
          party_id: number
          series_seq: number | null
          series_year: number | null
          total: number
          vat_mention: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credits_invoice_id?: string | null
          currency?: string
          id?: string
          issued_on?: string
          kind?: string
          lines?: Json
          notes?: string | null
          number?: string | null
          paper_path?: string | null
          party_id: number
          series_seq?: number | null
          series_year?: number | null
          total: number
          vat_mention?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credits_invoice_id?: string | null
          currency?: string
          id?: string
          issued_on?: string
          kind?: string
          lines?: Json
          notes?: string | null
          number?: string | null
          paper_path?: string | null
          party_id?: number
          series_seq?: number | null
          series_year?: number | null
          total?: number
          vat_mention?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_credits_invoice_id_fkey"
            columns: ["credits_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      invoice_order: {
        Row: {
          invoice_id: string
          order_id: string
        }
        Insert: {
          invoice_id: string
          order_id: string
        }
        Update: {
          invoice_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_order_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_order_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry: {
        Row: {
          ai_links_at: string | null
          author_id: string | null
          body: string
          corrects_id: number | null
          created_at: string
          engine: string | null
          event_on: string
          event_precision: string
          hidden_at: string | null
          hidden_by: string | null
          id: number
          kind: string
          provenance: string
          source_key: string | null
          verification: string
          visibility: string
          voice_note_id: string | null
        }
        Insert: {
          ai_links_at?: string | null
          author_id?: string | null
          body: string
          corrects_id?: number | null
          created_at?: string
          engine?: string | null
          event_on?: string
          event_precision?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: never
          kind: string
          provenance?: string
          source_key?: string | null
          verification?: string
          visibility?: string
          voice_note_id?: string | null
        }
        Update: {
          ai_links_at?: string | null
          author_id?: string | null
          body?: string
          corrects_id?: number | null
          created_at?: string
          engine?: string | null
          event_on?: string
          event_precision?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: never
          kind?: string
          provenance?: string
          source_key?: string | null
          verification?: string
          visibility?: string
          voice_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_voice_note_id_fkey"
            columns: ["voice_note_id"]
            isOneToOne: false
            referencedRelation: "voice_note"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_day_change: {
        Row: {
          changed_at: string
          changed_by: string | null
          entry_id: number
          from_day: string
          from_precision: string
          id: number
          to_day: string
          to_precision: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entry_id: number
          from_day: string
          from_precision: string
          id?: never
          to_day: string
          to_precision: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entry_id?: number
          from_day?: string
          from_precision?: string
          id?: never
          to_day?: string
          to_precision?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_day_change_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_label: {
        Row: {
          created_at: string
          created_by: string
          entry_id: number
          id: number
          label: string
          removed_at: string | null
          removed_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          entry_id: number
          id?: never
          label: string
          removed_at?: string | null
          removed_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_id?: number
          id?: never
          label?: string
          removed_at?: string | null
          removed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_label_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_link: {
        Row: {
          concept_id: string | null
          created_at: string
          created_by: string | null
          entry_id: number
          id: number
          oeuvre_id: number | null
          proposed_by: string
          rejected_at: string | null
          rejected_by: string | null
          relation: string
          target_entry_id: number | null
          validated_at: string | null
        }
        Insert: {
          concept_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id: number
          id?: never
          oeuvre_id?: number | null
          proposed_by?: string
          rejected_at?: string | null
          rejected_by?: string | null
          relation?: string
          target_entry_id?: number | null
          validated_at?: string | null
        }
        Update: {
          concept_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: number
          id?: never
          oeuvre_id?: number | null
          proposed_by?: string
          rejected_at?: string | null
          rejected_by?: string | null
          relation?: string
          target_entry_id?: number | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_link_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_link_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_link_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "journal_entry_link_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "journal_entry_link_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      kaizen_item: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          done_at: string | null
          done_by: string | null
          id: number
          legacy_system_log_id: number | null
          screenshots: string[]
          section: string | null
          suggested_section: string | null
          title: string
          updated_at: string
          work_ids: number[]
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: never
          legacy_system_log_id?: number | null
          screenshots?: string[]
          section?: string | null
          suggested_section?: string | null
          title: string
          updated_at?: string
          work_ids?: number[]
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: never
          legacy_system_log_id?: number | null
          screenshots?: string[]
          section?: string | null
          suggested_section?: string | null
          title?: string
          updated_at?: string
          work_ids?: number[]
        }
        Relationships: []
      }
      kaizen_seen: {
        Row: {
          scope: string
          seen_at: string
          user_id: string
        }
        Insert: {
          scope: string
          seen_at?: string
          user_id?: string
        }
        Update: {
          scope?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nodes: {
        Row: {
          created_at: string
          embedded_at: string | null
          embedding: string | null
          embedding_attempts: number
          embedding_dirty_at: string | null
          embedding_error: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_text_hash: string | null
          node_id: string
          node_type: string
          source_pk: string
        }
        Insert: {
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_attempts?: number
          embedding_dirty_at?: string | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_text_hash?: string | null
          node_id?: string
          node_type: string
          source_pk: string
        }
        Update: {
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_attempts?: number
          embedding_dirty_at?: string | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_text_hash?: string | null
          node_id?: string
          node_type?: string
          source_pk?: string
        }
        Relationships: []
      }
      note_line: {
        Row: {
          author_id: string | null
          body: string
          concept_id: string | null
          created_at: string
          discarded_at: string | null
          discarded_by: string | null
          flagged_for_pem: boolean
          id: number
          image_key: string | null
          oeuvre_id: number | null
          target_kind: string
        }
        Insert: {
          author_id?: string | null
          body: string
          concept_id?: string | null
          created_at?: string
          discarded_at?: string | null
          discarded_by?: string | null
          flagged_for_pem?: boolean
          id?: never
          image_key?: string | null
          oeuvre_id?: number | null
          target_kind: string
        }
        Update: {
          author_id?: string | null
          body?: string
          concept_id?: string | null
          created_at?: string
          discarded_at?: string | null
          discarded_by?: string | null
          flagged_for_pem?: boolean
          id?: never
          image_key?: string | null
          oeuvre_id?: number | null
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_line_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_line_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "note_line_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      oeuvre_broadcasts: {
        Row: {
          attempt_count: number
          broadcast_at: string
          caption_final: string | null
          external_post_id: string | null
          external_url: string | null
          id: string
          metadata: Json | null
          oeuvre_id: number
          platform: string
          queued_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          broadcast_at?: string
          caption_final?: string | null
          external_post_id?: string | null
          external_url?: string | null
          id?: string
          metadata?: Json | null
          oeuvre_id: number
          platform: string
          queued_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          broadcast_at?: string
          caption_final?: string | null
          external_post_id?: string | null
          external_url?: string | null
          id?: string
          metadata?: Json | null
          oeuvre_id?: number
          platform?: string
          queued_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "oeuvre_broadcasts_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "oeuvre_broadcasts_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      oeuvre_theme: {
        Row: {
          oeuvre_id: number
          theme_id: number
        }
        Insert: {
          oeuvre_id: number
          theme_id: number
        }
        Update: {
          oeuvre_id?: number
          theme_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "OeuvreTheme_OeuvreID_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "OeuvreTheme_OeuvreID_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "OeuvreTheme_ThemeID_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "theme"
            referencedColumns: ["id"]
          },
        ]
      }
      oeuvre_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          oeuvre_id: number
          snapshot: Json
          source: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          oeuvre_id: number
          snapshot: Json
          source?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          oeuvre_id?: number
          snapshot?: Json
          source?: string | null
        }
        Relationships: []
      }
      Oeuvres: {
        Row: {
          AcheteurID: number | null
          admin_override_anonymity: boolean | null
          Année: string | null
          anonymity_level: number | null
          broadcast_caption_seed: string | null
          broadcast_ready: boolean
          Catalogué: boolean | null
          Commentaires: string | null
          ContactID: number | null
          created_by: string | null
          DateLivraison: string | null
          DateStatut: string | null
          deleted_at: string | null
          Discount: number | null
          edited_at: string | null
          edited_by: string | null
          Encadree: boolean | null
          Exposable: boolean | null
          fate: string | null
          fate_on: string | null
          fate_precision: string | null
          Format: number | null
          Hauteur: string | null
          Historique: string | null
          home_place_id: number | null
          is_paid: boolean | null
          is_public: boolean
          IsCommission: boolean | null
          Largeur: string | null
          localisation_address_id: number | null
          LocalisationDetail: string | null
          LocalisationID: number | null
          Montee: boolean | null
          NeedsPhotograph: boolean | null
          OeuvreID: number
          place_id: number | null
          PresentationID: number | null
          Prix: number | null
          PrixFinal: number | null
          production_completed_on: string | null
          production_completed_precision: string | null
          production_origin: string | null
          production_started_on: string | null
          production_started_precision: string | null
          Profondeur: string | null
          ReturnDate: string | null
          status_before_fate: number | null
          statusId: number | null
          Support: number | null
          Technique: number | null
          Titre: string | null
          tva_rate: number | null
          txtImageNameLink: string | null
        }
        Insert: {
          AcheteurID?: number | null
          admin_override_anonymity?: boolean | null
          Année?: string | null
          anonymity_level?: number | null
          broadcast_caption_seed?: string | null
          broadcast_ready?: boolean
          Catalogué?: boolean | null
          Commentaires?: string | null
          ContactID?: number | null
          created_by?: string | null
          DateLivraison?: string | null
          DateStatut?: string | null
          deleted_at?: string | null
          Discount?: number | null
          edited_at?: string | null
          edited_by?: string | null
          Encadree?: boolean | null
          Exposable?: boolean | null
          fate?: string | null
          fate_on?: string | null
          fate_precision?: string | null
          Format?: number | null
          Hauteur?: string | null
          Historique?: string | null
          home_place_id?: number | null
          is_paid?: boolean | null
          is_public?: boolean
          IsCommission?: boolean | null
          Largeur?: string | null
          localisation_address_id?: number | null
          LocalisationDetail?: string | null
          LocalisationID?: number | null
          Montee?: boolean | null
          NeedsPhotograph?: boolean | null
          OeuvreID: number
          place_id?: number | null
          PresentationID?: number | null
          Prix?: number | null
          PrixFinal?: number | null
          production_completed_on?: string | null
          production_completed_precision?: string | null
          production_origin?: string | null
          production_started_on?: string | null
          production_started_precision?: string | null
          Profondeur?: string | null
          ReturnDate?: string | null
          status_before_fate?: number | null
          statusId?: number | null
          Support?: number | null
          Technique?: number | null
          Titre?: string | null
          tva_rate?: number | null
          txtImageNameLink?: string | null
        }
        Update: {
          AcheteurID?: number | null
          admin_override_anonymity?: boolean | null
          Année?: string | null
          anonymity_level?: number | null
          broadcast_caption_seed?: string | null
          broadcast_ready?: boolean
          Catalogué?: boolean | null
          Commentaires?: string | null
          ContactID?: number | null
          created_by?: string | null
          DateLivraison?: string | null
          DateStatut?: string | null
          deleted_at?: string | null
          Discount?: number | null
          edited_at?: string | null
          edited_by?: string | null
          Encadree?: boolean | null
          Exposable?: boolean | null
          fate?: string | null
          fate_on?: string | null
          fate_precision?: string | null
          Format?: number | null
          Hauteur?: string | null
          Historique?: string | null
          home_place_id?: number | null
          is_paid?: boolean | null
          is_public?: boolean
          IsCommission?: boolean | null
          Largeur?: string | null
          localisation_address_id?: number | null
          LocalisationDetail?: string | null
          LocalisationID?: number | null
          Montee?: boolean | null
          NeedsPhotograph?: boolean | null
          OeuvreID?: number
          place_id?: number | null
          PresentationID?: number | null
          Prix?: number | null
          PrixFinal?: number | null
          production_completed_on?: string | null
          production_completed_precision?: string | null
          production_origin?: string | null
          production_started_on?: string | null
          production_started_precision?: string | null
          Profondeur?: string | null
          ReturnDate?: string | null
          status_before_fate?: number | null
          statusId?: number | null
          Support?: number | null
          Technique?: number | null
          Titre?: string | null
          tva_rate?: number | null
          txtImageNameLink?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_oeuvres_contact"
            columns: ["ContactID"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "fk_oeuvres_format"
            columns: ["Format"]
            isOneToOne: false
            referencedRelation: "Format"
            referencedColumns: ["FormatID"]
          },
          {
            foreignKeyName: "fk_oeuvres_support"
            columns: ["Support"]
            isOneToOne: false
            referencedRelation: "Support"
            referencedColumns: ["SupportID"]
          },
          {
            foreignKeyName: "fk_oeuvres_technique"
            columns: ["Technique"]
            isOneToOne: false
            referencedRelation: "Technique"
            referencedColumns: ["TechniqueID"]
          },
          {
            foreignKeyName: "Oeuvres_AcheteurID_fkey"
            columns: ["AcheteurID"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "Oeuvres_home_place_id_fkey"
            columns: ["home_place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Oeuvres_localisation_address_id_fkey"
            columns: ["localisation_address_id"]
            isOneToOne: false
            referencedRelation: "contact_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Oeuvres_LocalisationID_fkey"
            columns: ["LocalisationID"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "Oeuvres_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Oeuvres_PresentationID_fkey"
            columns: ["PresentationID"]
            isOneToOne: false
            referencedRelation: "tblPresentation"
            referencedColumns: ["PresentationID"]
          },
          {
            foreignKeyName: "Oeuvres_status_before_fate_fkey"
            columns: ["status_before_fate"]
            isOneToOne: false
            referencedRelation: "OeuvreStatus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Oeuvres_statusId_fkey"
            columns: ["statusId"]
            isOneToOne: false
            referencedRelation: "OeuvreStatus"
            referencedColumns: ["id"]
          },
        ]
      }
      OeuvreStatus: {
        Row: {
          id: number
          label: string
        }
        Insert: {
          id?: number
          label: string
        }
        Update: {
          id?: number
          label?: string
        }
        Relationships: []
      }
      page_view: {
        Row: {
          country: string | null
          created_at: string | null
          id: number
          is_team_session: boolean
          path: string
          referrer: string | null
          team_contact_id: number | null
          visitor_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: number
          is_team_session?: boolean
          path: string
          referrer?: string | null
          team_contact_id?: number | null
          visitor_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: number
          is_team_session?: boolean
          path?: string
          referrer?: string | null
          team_contact_id?: number | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_view_team_contact_id_fkey"
            columns: ["team_contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          refunded_at: string | null
          work_order_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          refunded_at?: string | null
          work_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          refunded_at?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_changes: {
        Row: {
          author_email: string | null
          author_id: string | null
          baseline: Json | null
          change_kind: string
          created_at: string
          id: number
          oeuvre_id: number | null
          payload: Json
          reject_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          baseline?: Json | null
          change_kind?: string
          created_at?: string
          id?: number
          oeuvre_id?: number | null
          payload: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          baseline?: Json | null
          change_kind?: string
          created_at?: string
          id?: number
          oeuvre_id?: number | null
          payload?: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_changes_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "pending_changes_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      pending_query_embeddings: {
        Row: {
          created_at: string
          id: string
          query_norm: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_norm: string
        }
        Update: {
          created_at?: string
          id?: string
          query_norm?: string
        }
        Relationships: []
      }
      place: {
        Row: {
          access: Json | null
          address: string | null
          archived_at: string | null
          archived_by: string | null
          code: string | null
          complement: string | null
          conservation: string | null
          country: string | null
          created_at: string
          description: string | null
          fragile: boolean
          id: number
          keeps: Json | null
          kind: string
          latitude: number | null
          longitude: number | null
          name: string
          parent_id: number | null
          photo_key: string | null
          plan: Json | null
          plan_image_key: string | null
          postcode: string | null
          risk: string
          root_id: number | null
          shipping_notes: string | null
          town: string | null
        }
        Insert: {
          access?: Json | null
          address?: string | null
          archived_at?: string | null
          archived_by?: string | null
          code?: string | null
          complement?: string | null
          conservation?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          fragile?: boolean
          id?: never
          keeps?: Json | null
          kind?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          parent_id?: number | null
          photo_key?: string | null
          plan?: Json | null
          plan_image_key?: string | null
          postcode?: string | null
          risk?: string
          root_id?: number | null
          shipping_notes?: string | null
          town?: string | null
        }
        Update: {
          access?: Json | null
          address?: string | null
          archived_at?: string | null
          archived_by?: string | null
          code?: string | null
          complement?: string | null
          conservation?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          fragile?: boolean
          id?: never
          keeps?: Json | null
          kind?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          parent_id?: number | null
          photo_key?: string | null
          plan?: Json | null
          plan_image_key?: string | null
          postcode?: string | null
          risk?: string
          root_id?: number | null
          shipping_notes?: string | null
          town?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
      place_address_map: {
        Row: {
          address_id: number
          link_id: number | null
          mapped_at: string
          place_id: number
        }
        Insert: {
          address_id: number
          link_id?: number | null
          mapped_at?: string
          place_id: number
        }
        Update: {
          address_id?: number
          link_id?: number | null
          mapped_at?: string
          place_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_address_map_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "contact_place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_address_map_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "contact_place_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_address_map_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
      private_link: {
        Row: {
          contact_id: number | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          first_opened_at: string | null
          group_id: string | null
          lang: string
          last_opened_at: string | null
          message: string | null
          pdf_downloads: number
          pdf_key: string | null
          pdf_last_downloaded_at: string | null
          pdf_made_at: string | null
          recipient_name: string | null
          revoked_at: string | null
          token: string
          view_count: number
        }
        Insert: {
          contact_id?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_opened_at?: string | null
          group_id?: string | null
          lang?: string
          last_opened_at?: string | null
          message?: string | null
          pdf_downloads?: number
          pdf_key?: string | null
          pdf_last_downloaded_at?: string | null
          pdf_made_at?: string | null
          recipient_name?: string | null
          revoked_at?: string | null
          token: string
          view_count?: number
        }
        Update: {
          contact_id?: number | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_opened_at?: string | null
          group_id?: string | null
          lang?: string
          last_opened_at?: string | null
          message?: string | null
          pdf_downloads?: number
          pdf_key?: string | null
          pdf_last_downloaded_at?: string | null
          pdf_made_at?: string | null
          recipient_name?: string | null
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "private_link_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "private_link_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "working_group"
            referencedColumns: ["id"]
          },
        ]
      }
      private_link_work: {
        Row: {
          oeuvre_id: number
          position: number
          price: number | null
          show_price: boolean
          token: string
        }
        Insert: {
          oeuvre_id: number
          position: number
          price?: number | null
          show_price?: boolean
          token: string
        }
        Update: {
          oeuvre_id?: number
          position?: number
          price?: number | null
          show_price?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_link_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "private_link_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "private_link_work_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "private_link"
            referencedColumns: ["token"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      query_embedding_cache: {
        Row: {
          created_at: string
          model: string
          query_norm: string
          vector: Json
        }
        Insert: {
          created_at?: string
          model: string
          query_norm: string
          vector: Json
        }
        Update: {
          created_at?: string
          model?: string
          query_norm?: string
          vector?: Json
        }
        Relationships: []
      }
      saved_report: {
        Row: {
          config: Json
          created_at: string
          id: number
          name: string
          owner_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: never
          name: string
          owner_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: never
          name?: string
          owner_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      see_again_dismissed: {
        Row: {
          a: string
          at: string
          b: string
          kind: string
          user_id: string
        }
        Insert: {
          a: string
          at?: string
          b?: string
          kind: string
          user_id?: string
        }
        Update: {
          a?: string
          at?: string
          b?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      share_inbox: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      shipment: {
        Row: {
          address_id: number | null
          cancelled_at: string | null
          carrier: string | null
          charged_to: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          handed_to: string | null
          id: string
          insured_at: string | null
          insured_value: number | null
          insurer: string | null
          kind: string | null
          labelled_at: string | null
          note: string | null
          packed_at: string | null
          packed_dims: string | null
          packed_weight_kg: number | null
          packing_note: string | null
          photos_at: string | null
          picked_at: string | null
          pickup_process_id: string | null
          place_id: number | null
          policy_ref: string | null
          scheduled_for: string | null
          shipped_at: string | null
          status: string | null
          to_contact_id: number | null
          tracking_no: string | null
          tracking_url: string | null
        }
        Insert: {
          address_id?: number | null
          cancelled_at?: string | null
          carrier?: string | null
          charged_to?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          handed_to?: string | null
          id?: string
          insured_at?: string | null
          insured_value?: number | null
          insurer?: string | null
          kind?: string | null
          labelled_at?: string | null
          note?: string | null
          packed_at?: string | null
          packed_dims?: string | null
          packed_weight_kg?: number | null
          packing_note?: string | null
          photos_at?: string | null
          picked_at?: string | null
          pickup_process_id?: string | null
          place_id?: number | null
          policy_ref?: string | null
          scheduled_for?: string | null
          shipped_at?: string | null
          status?: string | null
          to_contact_id?: number | null
          tracking_no?: string | null
          tracking_url?: string | null
        }
        Update: {
          address_id?: number | null
          cancelled_at?: string | null
          carrier?: string | null
          charged_to?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          handed_to?: string | null
          id?: string
          insured_at?: string | null
          insured_value?: number | null
          insurer?: string | null
          kind?: string | null
          labelled_at?: string | null
          note?: string | null
          packed_at?: string | null
          packed_dims?: string | null
          packed_weight_kg?: number | null
          packing_note?: string | null
          photos_at?: string | null
          picked_at?: string | null
          pickup_process_id?: string | null
          place_id?: number | null
          policy_ref?: string | null
          scheduled_for?: string | null
          shipped_at?: string | null
          status?: string | null
          to_contact_id?: number | null
          tracking_no?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "contact_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_pickup_process_id_fkey"
            columns: ["pickup_process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_pickup_process_id_fkey"
            columns: ["pickup_process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_to_contact_id_fkey"
            columns: ["to_contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      shipment_work: {
        Row: {
          id: string
          oeuvre_id: number
          order_line_id: string | null
          shipment_id: string
        }
        Insert: {
          id?: string
          oeuvre_id: number
          order_line_id?: string | null
          shipment_id: string
        }
        Update: {
          id?: string
          oeuvre_id?: number
          order_line_id?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "shipment_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "shipment_work_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "work_order_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_work_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment"
            referencedColumns: ["id"]
          },
        ]
      }
      sketchbook: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slideshow: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          settings: Json
          updated_at: string
          work_ids: number[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          settings?: Json
          updated_at?: string
          work_ids?: number[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
          work_ids?: number[]
        }
        Relationships: []
      }
      stock_item: {
        Row: {
          category: string | null
          cost_unit: number | null
          created_at: string
          id: number
          min_stock: number
          name: string
          notes: string | null
          quantity: number
          supplier_id: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_unit?: number | null
          created_at?: string
          id?: number
          min_stock?: number
          name: string
          notes?: string | null
          quantity?: number
          supplier_id?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_unit?: number | null
          created_at?: string
          id?: number
          min_stock?: number
          name?: string
          notes?: string | null
          quantity?: number
          supplier_id?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_item_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      storage_object_ledger: {
        Row: {
          bucket: string
          classification: string
          content_type: string | null
          created_at: string
          etag: string | null
          first_seen_at: string
          id: string
          last_modified_at: string | null
          last_seen_at: string
          linked_refs: Json
          metadata: Json
          object_key: string
          provider: string
          size_bytes: number | null
          source: string
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          classification?: string
          content_type?: string | null
          created_at?: string
          etag?: string | null
          first_seen_at?: string
          id?: string
          last_modified_at?: string | null
          last_seen_at?: string
          linked_refs?: Json
          metadata?: Json
          object_key: string
          provider?: string
          size_bytes?: number | null
          source?: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          classification?: string
          content_type?: string | null
          created_at?: string
          etag?: string | null
          first_seen_at?: string
          id?: string
          last_modified_at?: string | null
          last_seen_at?: string
          linked_refs?: Json
          metadata?: Json
          object_key?: string
          provider?: string
          size_bytes?: number | null
          source?: string
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      studio_task: {
        Row: {
          action: string
          author_id: string | null
          completed_at: string | null
          created_at: string
          details: string | null
          due_at: string | null
          id: number
          kind: string
          oeuvre_id: number | null
          photo_r2_key: string | null
          priority: string | null
          severity: string | null
          status: string | null
          type: string | null
          updated_at: string
          work_action_type_id: number | null
        }
        Insert: {
          action: string
          author_id?: string | null
          completed_at?: string | null
          created_at?: string
          details?: string | null
          due_at?: string | null
          id?: number
          kind?: string
          oeuvre_id?: number | null
          photo_r2_key?: string | null
          priority?: string | null
          severity?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
          work_action_type_id?: number | null
        }
        Update: {
          action?: string
          author_id?: string | null
          completed_at?: string | null
          created_at?: string
          details?: string | null
          due_at?: string | null
          id?: number
          kind?: string
          oeuvre_id?: number | null
          photo_r2_key?: string | null
          priority?: string | null
          severity?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
          work_action_type_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_task_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "studio_task_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "studio_task_work_action_type_id_fkey"
            columns: ["work_action_type_id"]
            isOneToOne: false
            referencedRelation: "work_action_type"
            referencedColumns: ["id"]
          },
        ]
      }
      suivi_etape: {
        Row: {
          date_echeance: string | null
          id: string
          nom: string
          notes: string | null
          overdue_override: boolean
          position: number
          process_id: string
          statut: string
        }
        Insert: {
          date_echeance?: string | null
          id?: string
          nom: string
          notes?: string | null
          overdue_override?: boolean
          position?: number
          process_id: string
          statut?: string
        }
        Update: {
          date_echeance?: string | null
          id?: string
          nom?: string
          notes?: string | null
          overdue_override?: boolean
          position?: number
          process_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "suivi_etape_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_etape_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      suivi_process: {
        Row: {
          asset_notes: string | null
          contact_id: number | null
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          deadline_time: string | null
          exhibition_process_id: string | null
          id: string
          localisation: string | null
          nom: string
          notes: string | null
          oeuvre_id: number | null
          on_site: boolean
          prep_columns: string[] | null
          responsables: Json | null
          scope: string | null
          stakeholders: string | null
          statut: string
          type: string
          updated_at: string | null
          url: string | null
          vault_path: string | null
          vault_tags: string[] | null
        }
        Insert: {
          asset_notes?: string | null
          contact_id?: number | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          deadline_time?: string | null
          exhibition_process_id?: string | null
          id?: string
          localisation?: string | null
          nom: string
          notes?: string | null
          oeuvre_id?: number | null
          on_site?: boolean
          prep_columns?: string[] | null
          responsables?: Json | null
          scope?: string | null
          stakeholders?: string | null
          statut?: string
          type: string
          updated_at?: string | null
          url?: string | null
          vault_path?: string | null
          vault_tags?: string[] | null
        }
        Update: {
          asset_notes?: string | null
          contact_id?: number | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          deadline_time?: string | null
          exhibition_process_id?: string | null
          id?: string
          localisation?: string | null
          nom?: string
          notes?: string | null
          oeuvre_id?: number | null
          on_site?: boolean
          prep_columns?: string[] | null
          responsables?: Json | null
          scope?: string | null
          stakeholders?: string | null
          statut?: string
          type?: string
          updated_at?: string | null
          url?: string | null
          vault_path?: string | null
          vault_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "suivi_process_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "suivi_process_exhibition_process_id_fkey"
            columns: ["exhibition_process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_process_exhibition_process_id_fkey"
            columns: ["exhibition_process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_process_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "suivi_process_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      suivi_reminder: {
        Row: {
          created_at: string | null
          etape_id: string | null
          id: string
          lu: boolean | null
          message: string
          process_id: string | null
          remind_at: string
        }
        Insert: {
          created_at?: string | null
          etape_id?: string | null
          id?: string
          lu?: boolean | null
          message: string
          process_id?: string | null
          remind_at: string
        }
        Update: {
          created_at?: string | null
          etape_id?: string | null
          id?: string
          lu?: boolean | null
          message?: string
          process_id?: string | null
          remind_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suivi_reminder_etape_id_fkey"
            columns: ["etape_id"]
            isOneToOne: false
            referencedRelation: "suivi_etape"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_reminder_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_reminder_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_order: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          expense_id: number | null
          id: number
          notes: string | null
          ordered_at: string | null
          received_at: string | null
          ref: string | null
          ref_seq: number
          ref_year: number
          status: string
          supplier_id: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: number | null
          id?: never
          notes?: string | null
          ordered_at?: string | null
          received_at?: string | null
          ref?: string | null
          ref_seq: number
          ref_year: number
          status?: string
          supplier_id: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: number | null
          id?: never
          notes?: string | null
          ordered_at?: string | null
          received_at?: string | null
          ref?: string | null
          ref_seq?: number
          ref_year?: number
          status?: string
          supplier_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_order_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_order_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      supply_order_line: {
        Row: {
          id: number
          order_id: number
          position: number
          qty_ordered: number
          qty_received: number
          stock_item_id: number
          unit_price_ht: number | null
        }
        Insert: {
          id?: never
          order_id: number
          position?: number
          qty_ordered: number
          qty_received?: number
          stock_item_id: number
          unit_price_ht?: number | null
        }
        Update: {
          id?: never
          order_id?: number
          position?: number
          qty_ordered?: number
          qty_received?: number
          stock_item_id?: number
          unit_price_ht?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_order_line_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "supply_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_order_line_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_item"
            referencedColumns: ["id"]
          },
        ]
      }
      Support: {
        Row: {
          Support: string | null
          SupportID: number
        }
        Insert: {
          Support?: string | null
          SupportID: number
        }
        Update: {
          Support?: string | null
          SupportID?: number
        }
        Relationships: []
      }
      system_log: {
        Row: {
          action: string
          attachments: Json
          author_id: string | null
          created_at: string | null
          details: string | null
          event_type: string | null
          id: number
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          priority: string | null
          row_id: string | null
          status: string | null
          table_name: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          attachments?: Json
          author_id?: string | null
          created_at?: string | null
          details?: string | null
          event_type?: string | null
          id?: number
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          priority?: string | null
          row_id?: string | null
          status?: string | null
          table_name?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          attachments?: Json
          author_id?: string | null
          created_at?: string | null
          details?: string | null
          event_type?: string | null
          id?: number
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          priority?: string | null
          row_id?: string | null
          status?: string | null
          table_name?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tblImage: {
        Row: {
          capture_meta: Json | null
          DateAdded: string | null
          ImageID: number
          ImageNote: string | null
          is_cover: boolean
          OeuvreID: number | null
          palette: Json | null
          SeqNo: number | null
          sha256: string | null
          txtImageName: string | null
          txtImageNameLink: string | null
        }
        Insert: {
          capture_meta?: Json | null
          DateAdded?: string | null
          ImageID?: number
          ImageNote?: string | null
          is_cover?: boolean
          OeuvreID?: number | null
          palette?: Json | null
          SeqNo?: number | null
          sha256?: string | null
          txtImageName?: string | null
          txtImageNameLink?: string | null
        }
        Update: {
          capture_meta?: Json | null
          DateAdded?: string | null
          ImageID?: number
          ImageNote?: string | null
          is_cover?: boolean
          OeuvreID?: number | null
          palette?: Json | null
          SeqNo?: number | null
          sha256?: string | null
          txtImageName?: string | null
          txtImageNameLink?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tblimage_oeuvre"
            columns: ["OeuvreID"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "fk_tblimage_oeuvre"
            columns: ["OeuvreID"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      tblPresentation: {
        Row: {
          Nom: string
          PresentationID: number
        }
        Insert: {
          Nom: string
          PresentationID?: number
        }
        Update: {
          Nom?: string
          PresentationID?: number
        }
        Relationships: []
      }
      tblrelations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          relation_type: string | null
          source_id: number | null
          source_uid: string | null
          strength: number | null
          target_id: number | null
          target_uid: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          relation_type?: string | null
          source_id?: number | null
          source_uid?: string | null
          strength?: number | null
          target_id?: number | null
          target_uid?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          relation_type?: string | null
          source_id?: number | null
          source_uid?: string | null
          strength?: number | null
          target_id?: number | null
          target_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tblrelations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "tblrelations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "tblrelations_source_uid_fkey"
            columns: ["source_uid"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "tblrelations_source_uid_fkey"
            columns: ["source_uid"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "tblrelations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "tblrelations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "tblrelations_target_uid_fkey"
            columns: ["target_uid"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "tblrelations_target_uid_fkey"
            columns: ["target_uid"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      tblRole: {
        Row: {
          Nom: string
          RoleID: number
        }
        Insert: {
          Nom: string
          RoleID?: number
        }
        Update: {
          Nom?: string
          RoleID?: number
        }
        Relationships: []
      }
      Technique: {
        Row: {
          Technique: string | null
          TechniqueID: number
        }
        Insert: {
          Technique?: string | null
          TechniqueID: number
        }
        Update: {
          Technique?: string | null
          TechniqueID?: number
        }
        Relationships: []
      }
      theme: {
        Row: {
          id: number
          name: string
          notes: string | null
        }
        Insert: {
          id?: number
          name: string
          notes?: string | null
        }
        Update: {
          id?: number
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      user_record_done: {
        Row: {
          completed_at: string
          id: string
          record_id: string
          scope: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          record_id: string
          scope: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          record_id?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_note: {
        Row: {
          audio_mime: string | null
          audio_r2_key: string | null
          bucket: string
          concept_id: string | null
          condition_report_id: number | null
          created_at: string
          duration_ms: number | null
          id: string
          kind: string
          oeuvre_id: number | null
          process_id: string | null
          routed_at: string | null
          sketchbook_id: string | null
          subject: string | null
          transcript: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_mime?: string | null
          audio_r2_key?: string | null
          bucket?: string
          concept_id?: string | null
          condition_report_id?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          oeuvre_id?: number | null
          process_id?: string | null
          routed_at?: string | null
          sketchbook_id?: string | null
          subject?: string | null
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          audio_mime?: string | null
          audio_r2_key?: string | null
          bucket?: string
          concept_id?: string | null
          condition_report_id?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          oeuvre_id?: number | null
          process_id?: string | null
          routed_at?: string | null
          sketchbook_id?: string | null
          subject?: string | null
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_note_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_note_condition_report_id_fkey"
            columns: ["condition_report_id"]
            isOneToOne: false
            referencedRelation: "condition_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_note_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "voice_note_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "voice_note_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_note_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_note_sketchbook_id_fkey"
            columns: ["sketchbook_id"]
            isOneToOne: false
            referencedRelation: "sketchbook"
            referencedColumns: ["id"]
          },
        ]
      }
      work_action: {
        Row: {
          action_type_id: number
          created_at: string
          done: boolean
          done_at: string | null
          id: number
          note: string | null
          oeuvre_id: number
          paused_at: string | null
        }
        Insert: {
          action_type_id: number
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: number
          note?: string | null
          oeuvre_id: number
          paused_at?: string | null
        }
        Update: {
          action_type_id?: number
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: number
          note?: string | null
          oeuvre_id?: number
          paused_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_action_action_type_id_fkey"
            columns: ["action_type_id"]
            isOneToOne: false
            referencedRelation: "work_action_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_action_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_action_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      work_action_type: {
        Row: {
          color: string
          created_at: string
          field_key: string | null
          id: number
          label: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          field_key?: string | null
          id?: number
          label: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          field_key?: string | null
          id?: number
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      work_creation_step: {
        Row: {
          created_at: string
          date_precision: string | null
          id: number
          kind: string
          note: string | null
          oeuvre_id: number
          on_date: string | null
          place_id: number | null
          set_by: string | null
          work_session_id: string | null
        }
        Insert: {
          created_at?: string
          date_precision?: string | null
          id?: never
          kind?: string
          note?: string | null
          oeuvre_id: number
          on_date?: string | null
          place_id?: number | null
          set_by?: string | null
          work_session_id?: string | null
        }
        Update: {
          created_at?: string
          date_precision?: string | null
          id?: never
          kind?: string
          note?: string | null
          oeuvre_id?: number
          on_date?: string | null
          place_id?: number | null
          set_by?: string | null
          work_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_creation_step_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_creation_step_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "work_creation_step_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_creation_step_work_session_id_fkey"
            columns: ["work_session_id"]
            isOneToOne: false
            referencedRelation: "work_session"
            referencedColumns: ["id"]
          },
        ]
      }
      work_description: {
        Row: {
          body: string
          created_at: string
          echoes: string | null
          engine: string
          id: number
          image_key: string
          oeuvre_id: number
          prompt: string
          rated_at: string | null
          rated_by: string | null
          usefulness: number | null
          verification: string
        }
        Insert: {
          body: string
          created_at?: string
          echoes?: string | null
          engine: string
          id?: never
          image_key: string
          oeuvre_id: number
          prompt: string
          rated_at?: string | null
          rated_by?: string | null
          usefulness?: number | null
          verification?: string
        }
        Update: {
          body?: string
          created_at?: string
          echoes?: string | null
          engine?: string
          id?: never
          image_key?: string
          oeuvre_id?: number
          prompt?: string
          rated_at?: string | null
          rated_by?: string | null
          usefulness?: number | null
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_description_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_description_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      work_order: {
        Row: {
          address_id: number | null
          balance_due: string | null
          cancelled_at: string | null
          commission_amount: number | null
          commission_pct: number | null
          created_at: string
          created_by: string | null
          currency: string
          delivered_at: string | null
          delivery_mode: string | null
          deposit_due: string | null
          deposit_pct: number | null
          discount_pct: number | null
          end_date: string | null
          id: string
          kind: string
          notes: string | null
          paid_at: string | null
          paper_path: string | null
          parent_order_id: string | null
          party_id: number
          payment_method: string | null
          place_id: number | null
          price_catalogue: number | null
          price_final: number | null
          process_id: string | null
          reconstituted: boolean
          ref: string | null
          ref_seq: number | null
          ref_year: number | null
          return_window_days: number
          return_window_skipped: boolean
          return_window_starts_at: string | null
          returned_at: string | null
          shipping_charge: number | null
          shipping_method: string | null
          signed_at: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_id?: number | null
          balance_due?: string | null
          cancelled_at?: string | null
          commission_amount?: number | null
          commission_pct?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          delivery_mode?: string | null
          deposit_due?: string | null
          deposit_pct?: number | null
          discount_pct?: number | null
          end_date?: string | null
          id?: string
          kind: string
          notes?: string | null
          paid_at?: string | null
          paper_path?: string | null
          parent_order_id?: string | null
          party_id: number
          payment_method?: string | null
          place_id?: number | null
          price_catalogue?: number | null
          price_final?: number | null
          process_id?: string | null
          reconstituted?: boolean
          ref?: string | null
          ref_seq?: number | null
          ref_year?: number | null
          return_window_days?: number
          return_window_skipped?: boolean
          return_window_starts_at?: string | null
          returned_at?: string | null
          shipping_charge?: number | null
          shipping_method?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_id?: number | null
          balance_due?: string | null
          cancelled_at?: string | null
          commission_amount?: number | null
          commission_pct?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          delivery_mode?: string | null
          deposit_due?: string | null
          deposit_pct?: number | null
          discount_pct?: number | null
          end_date?: string | null
          id?: string
          kind?: string
          notes?: string | null
          paid_at?: string | null
          paper_path?: string | null
          parent_order_id?: string | null
          party_id?: number
          payment_method?: string | null
          place_id?: number | null
          price_catalogue?: number | null
          price_final?: number | null
          process_id?: string | null
          reconstituted?: boolean
          ref?: string | null
          ref_seq?: number | null
          ref_year?: number | null
          return_window_days?: number
          return_window_skipped?: boolean
          return_window_starts_at?: string | null
          returned_at?: string | null
          shipping_charge?: number | null
          shipping_method?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "contact_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "work_order_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_demand: {
        Row: {
          created_at: string
          created_by: string | null
          done_at: string | null
          entrusted_order_id: string | null
          id: string
          kind: string
          line_id: string
          note: string | null
          price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          entrusted_order_id?: string | null
          id?: string
          kind: string
          line_id: string
          note?: string | null
          price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          entrusted_order_id?: string | null
          id?: string
          kind?: string
          line_id?: string
          note?: string | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_demand_entrusted_order_id_fkey"
            columns: ["entrusted_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_demand_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "work_order_work"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_work: {
        Row: {
          closed_at: string | null
          closed_by_order_id: string | null
          coa_document_id: string | null
          id: string
          insurance_value: number | null
          line_status: string
          note: string | null
          oeuvre_id: number
          order_id: string
          position: number
          price: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by_order_id?: string | null
          coa_document_id?: string | null
          id?: string
          insurance_value?: number | null
          line_status?: string
          note?: string | null
          oeuvre_id: number
          order_id: string
          position?: number
          price?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by_order_id?: string | null
          coa_document_id?: string | null
          id?: string
          insurance_value?: number | null
          line_status?: string
          note?: string | null
          oeuvre_id?: number
          order_id?: string
          position?: number
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_work_closed_by_order_id_fkey"
            columns: ["closed_by_order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_work_coa_document_id_fkey"
            columns: ["coa_document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_order_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "work_order_work_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "work_order"
            referencedColumns: ["id"]
          },
        ]
      }
      work_period: {
        Row: {
          created_at: string
          default_place_id: number | null
          end_on: string | null
          end_year: number | null
          id: number
          name: string
          start_on: string
          start_year: number
        }
        Insert: {
          created_at?: string
          default_place_id?: number | null
          end_on?: string | null
          end_year?: number | null
          id?: never
          name: string
          start_on: string
          start_year: number
        }
        Update: {
          created_at?: string
          default_place_id?: number | null
          end_on?: string | null
          end_year?: number | null
          id?: never
          name?: string
          start_on?: string
          start_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_period_default_place_id_fkey"
            columns: ["default_place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
      work_period_override: {
        Row: {
          oeuvre_id: number
          period_id: number | null
          set_at: string
          set_by: string | null
        }
        Insert: {
          oeuvre_id: number
          period_id?: number | null
          set_at?: string
          set_by?: string | null
        }
        Update: {
          oeuvre_id?: number
          period_id?: number | null
          set_at?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_period_override_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: true
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_period_override_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: true
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "work_period_override_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "work_period"
            referencedColumns: ["id"]
          },
        ]
      }
      work_rule_run: {
        Row: {
          breaks: number
          by_rule: Json
          error: string | null
          id: number
          ran_at: string
          ran_by: string | null
          source: string
          works: number | null
        }
        Insert: {
          breaks: number
          by_rule?: Json
          error?: string | null
          id?: never
          ran_at?: string
          ran_by?: string | null
          source: string
          works?: number | null
        }
        Update: {
          breaks?: number
          by_rule?: Json
          error?: string | null
          id?: never
          ran_at?: string
          ran_by?: string | null
          source?: string
          works?: number | null
        }
        Relationships: []
      }
      work_session: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          oeuvre_id: number | null
          payload: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          oeuvre_id?: number | null
          payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          oeuvre_id?: number | null
          payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_session_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_session_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      work_source: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      work_source_link: {
        Row: {
          note: string | null
          oeuvre_id: number
          source_id: number
        }
        Insert: {
          note?: string | null
          oeuvre_id: number
          source_id: number
        }
        Update: {
          note?: string | null
          oeuvre_id?: number
          source_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_source_link_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "work_source_link_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "work_source_link_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "work_source"
            referencedColumns: ["id"]
          },
        ]
      }
      working_group: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string | null
          process_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string | null
          process_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string | null
          process_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "working_group_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "exhibition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_group_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "suivi_process"
            referencedColumns: ["id"]
          },
        ]
      }
      working_group_work: {
        Row: {
          group_id: string
          oeuvre_id: number
          position: number
        }
        Insert: {
          group_id: string
          oeuvre_id: number
          position?: number
        }
        Update: {
          group_id?: string
          oeuvre_id?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_group_work_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "working_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_group_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "working_group_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
    }
    Views: {
      contact_place_lines: {
        Row: {
          adresse: string | null
          building_id: number | null
          code_postal: string | null
          complement: string | null
          contact_id: number | null
          id: number | null
          is_primary: boolean | null
          kind: string | null
          label: string | null
          latitude: number | null
          longitude: number | null
          others: number | null
          parent_id: number | null
          pays: string | null
          place_id: number | null
          place_name: string | null
          position: number | null
          role: string | null
          shipping_notes: string | null
          since: string | null
          ville: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_place_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "contact_place_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_fact: {
        Row: {
          description: string | null
          edge_created_at: string | null
          edge_id: string | null
          legacy_source_oeuvre_id: number | null
          legacy_target_oeuvre_id: number | null
          relation_type: string | null
          source_label: string | null
          source_legacy_int_id: number | null
          source_legacy_uuid: string | null
          source_node_id: string | null
          source_node_type: string | null
          source_pk: string | null
          strength: number | null
          target_label: string | null
          target_legacy_int_id: number | null
          target_legacy_uuid: string | null
          target_node_id: string | null
          target_node_type: string | null
          target_pk: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tblrelations_source_id_fkey"
            columns: ["legacy_source_oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "tblrelations_source_id_fkey"
            columns: ["legacy_source_oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "tblrelations_source_uid_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "tblrelations_source_uid_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "tblrelations_target_id_fkey"
            columns: ["legacy_target_oeuvre_id"]
            isOneToOne: false
            referencedRelation: "oeuvre_place_unlinked"
            referencedColumns: ["oeuvre_id"]
          },
          {
            foreignKeyName: "tblrelations_target_id_fkey"
            columns: ["legacy_target_oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "tblrelations_target_uid_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "tblrelations_target_uid_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      entity: {
        Row: {
          created_at: string | null
          display_label: string | null
          is_public: boolean | null
          legacy_int_id: number | null
          legacy_uuid: string | null
          node_id: string | null
          node_type: string | null
          source_pk: string | null
          title: string | null
        }
        Relationships: []
      }
      exhibition: {
        Row: {
          contact_id: number | null
          date_debut: string | null
          date_fin: string | null
          id: string | null
          lieu: string | null
          titre: string | null
        }
        Insert: {
          contact_id?: number | null
          date_debut?: string | null
          date_fin?: string | null
          id?: string | null
          lieu?: string | null
          titre?: string | null
        }
        Update: {
          contact_id?: number | null
          date_debut?: string | null
          date_fin?: string | null
          id?: string | null
          lieu?: string | null
          titre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suivi_process_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
        ]
      }
      oeuvre_place_unlinked: {
        Row: {
          holder_id: number | null
          oeuvre_id: number | null
          place_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Oeuvres_LocalisationID_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "Oeuvres_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _contact_card: { Args: { p_id: number }; Returns: Json }
      _contact_rows_norm: {
        Args: { p_cols: string[]; p_rows: Json }
        Returns: Json
      }
      _contact_rows_stored: {
        Args: { p_contact: number; p_table: string }
        Returns: Json
      }
      _contact_rows_write: {
        Args: {
          p_cols: string[]
          p_contact: number
          p_rows: Json
          p_table: string
        }
        Returns: undefined
      }
      audit_log_prune: {
        Args: never
        Returns: {
          deleted_broadcast_events: number
          deleted_oeuvre_versions: number
          deleted_pending_changes: number
          deleted_system_log: number
        }[]
      }
      contact_list_label: {
        Args: { p_inst: string; p_nom: string; p_prenom: string }
        Returns: string
      }
      graph_mark_nodes_pending: {
        Args: { p_pk: string; p_type: string }
        Returns: undefined
      }
      graph_node_id: { Args: { p_pk: string; p_type: string }; Returns: string }
      graph_register_node: {
        Args: { p_pk: string; p_type: string }
        Returns: string
      }
      graph_unregister_node: {
        Args: { p_pk: string; p_type: string }
        Returns: undefined
      }
      graph_upsert_relation_edge: {
        Args: {
          p_relation_type: string
          p_source_id?: number
          p_source_uid: string
          p_target_uid: string
        }
        Returns: undefined
      }
      idea_list: {
        Args: { p_limit?: number; p_offset?: number; p_stage?: string }
        Returns: {
          branches: number
          created_at: string
          created_by: string
          days: number
          documents: number
          id: string
          last_at: string
          maturity: string
          moments: number
          oeuvre_id: number
          parent_id: string
          titre: string
          works: number
        }[]
      }
      idea_plant: {
        Args: {
          p_body?: string
          p_from_entry?: number
          p_parent?: string
          p_title: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_team: { Args: never; Returns: boolean }
      journal_move_entry: {
        Args: { p_day: string; p_entry: number; p_precision?: string }
        Returns: number
      }
      journal_propose_links: {
        Args: {
          p_k?: number
          p_limit?: number
          p_margin?: number
          p_min?: number
        }
        Returns: number
      }
      journal_scale: {
        Args: { p_before?: string; p_grain?: string; p_limit?: number }
        Returns: {
          bucket: string
          creation: number
          entries: number
          photos: number
          proposals: number
          remarks: number
          voices: number
        }[]
      }
      match_nodes: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          node_id: string
          node_type: string
          score: number
        }[]
      }
      merge_contacts: {
        Args: { p_keep: number; p_lose: number }
        Returns: number
      }
      my_contact_id: { Args: never; Returns: number }
      node_search_text: { Args: { p_node_id: string }; Returns: string }
      oeuvre_contact_label: {
        Args: { p_id: number; p_with_place?: boolean }
        Returns: string
      }
      oeuvre_fate_close_orders: {
        Args: { p_kind: string; p_oeuvre: number; p_on: string }
        Returns: undefined
      }
      oeuvre_order_exists: {
        Args: { p_contact: number; p_kind: string; p_oeuvre: number }
        Returns: boolean
      }
      oeuvre_search_text: { Args: { p_oid: number }; Returns: string }
      oeuvre_stage_key: {
        Args: { catalogued: boolean; needs_photo: boolean; status: number }
        Returns: string
      }
      places_backfill_from_addresses: { Args: never; Returns: Json }
      places_check: { Args: never; Returns: Json }
      private_link_count_open: { Args: { p_token: string }; Returns: undefined }
      private_link_count_pdf: { Args: { p_token: string }; Returns: undefined }
      receive_supply_order: {
        Args: { p_lines: Json; p_order_id: number }
        Returns: undefined
      }
      replace_oeuvre_themes: {
        Args: { p_oeuvre_id: number; p_theme_ids: number[] }
        Returns: undefined
      }
      replace_oeuvre_work_groups: {
        Args: { p_group_ids: string[]; p_oeuvre_id: number }
        Returns: undefined
      }
      retention_page_view_inquiry: {
        Args: never
        Returns: {
          deleted_inquiry: number
          deleted_page_view: number
        }[]
      }
      save_contact: { Args: { p: Json }; Returns: Json }
      save_contact_places: {
        Args: { p_contact: number; p_rows: Json }
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
    Enums: {},
  },
} as const
