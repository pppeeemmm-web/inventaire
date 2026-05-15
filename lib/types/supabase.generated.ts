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
          external_event_id: string
          id: string
          provider: string
          suivi_etape_id: string | null
          suivi_process_id: string | null
          sync_etag: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          calendar_account_id: string
          external_event_id: string
          id?: string
          provider: string
          suivi_etape_id?: string | null
          suivi_process_id?: string | null
          sync_etag?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          calendar_account_id?: string
          external_event_id?: string
          id?: string
          provider?: string
          suivi_etape_id?: string | null
          suivi_process_id?: string | null
          sync_etag?: string | null
          updated_at?: string
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
        ]
      }
      concept: {
        Row: {
          created_at: string
          description: string | null
          energie: number | null
          id: string
          image_note: string | null
          medium: string | null
          notes: string | null
          oeuvre_id: number | null
          statut: string
          themes: string[] | null
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          energie?: number | null
          id?: string
          image_note?: string | null
          medium?: string | null
          notes?: string | null
          oeuvre_id?: number | null
          statut?: string
          themes?: string[] | null
          titre?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          energie?: number | null
          id?: string
          image_note?: string | null
          medium?: string | null
          notes?: string | null
          oeuvre_id?: number | null
          statut?: string
          themes?: string[] | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      consignment_order: {
        Row: {
          catalog_price: number | null
          created_at: string | null
          end_date: string | null
          id: string
          insurance_value: number | null
          kind: string
          notes: string | null
          oeuvre_id: number | null
          order_ref: string | null
          partner_id: number | null
          pdf_path: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          catalog_price?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          insurance_value?: number | null
          kind?: string
          notes?: string | null
          oeuvre_id?: number | null
          order_ref?: string | null
          partner_id?: number | null
          pdf_path?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          catalog_price?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          insurance_value?: number | null
          kind?: string
          notes?: string | null
          oeuvre_id?: number | null
          order_ref?: string | null
          partner_id?: number | null
          pdf_path?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consignment_order_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "consignment_order_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
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
          contact_id: number | null
          created_at: string
          doc_date: string | null
          file_size: number | null
          folder: string | null
          id: string
          kind: string | null
          mime_type: string | null
          name: string
          notes: string | null
          oeuvre_id: number | null
          oeuvre_ids: number[] | null
          process_id: string | null
          storage_path: string | null
        }
        Insert: {
          cert_hash?: string | null
          cert_id?: string | null
          contact_id?: number | null
          created_at?: string
          doc_date?: string | null
          file_size?: number | null
          folder?: string | null
          id?: string
          kind?: string | null
          mime_type?: string | null
          name: string
          notes?: string | null
          oeuvre_id?: number | null
          oeuvre_ids?: number[] | null
          process_id?: string | null
          storage_path?: string | null
        }
        Update: {
          cert_hash?: string | null
          cert_id?: string | null
          contact_id?: number | null
          created_at?: string
          doc_date?: string | null
          file_size?: number | null
          folder?: string | null
          id?: string
          kind?: string | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          oeuvre_id?: number | null
          oeuvre_ids?: number[] | null
          process_id?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
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
          sale_order_id: string | null
          status: string
        }
        Insert: {
          category?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          oeuvre_id?: number | null
          sale_order_id?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          oeuvre_id?: number | null
          sale_order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "inquiry_sale_order_id_fkey"
            columns: ["sale_order_id"]
            isOneToOne: false
            referencedRelation: "sale_order"
            referencedColumns: ["id"]
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
          commercial_status: string | null
          ContactID: number | null
          DateLivraison: string | null
          DateStatut: string | null
          deleted_at: string | null
          Discount: number | null
          Encadree: boolean | null
          Exposable: boolean | null
          Format: number | null
          Hauteur: string | null
          Historique: string | null
          is_gift: boolean | null
          is_paid: boolean | null
          is_public: boolean
          IsCommission: boolean | null
          Largeur: string | null
          LocalisationDetail: string | null
          LocalisationID: number | null
          Montee: boolean | null
          NeedsPhotograph: boolean | null
          OeuvreID: number
          PresentationID: number | null
          Prix: number | null
          PrixFinal: number | null
          Profondeur: string | null
          ReturnDate: string | null
          StageProduction: string | null
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
          commercial_status?: string | null
          ContactID?: number | null
          DateLivraison?: string | null
          DateStatut?: string | null
          deleted_at?: string | null
          Discount?: number | null
          Encadree?: boolean | null
          Exposable?: boolean | null
          Format?: number | null
          Hauteur?: string | null
          Historique?: string | null
          is_gift?: boolean | null
          is_paid?: boolean | null
          is_public?: boolean
          IsCommission?: boolean | null
          Largeur?: string | null
          LocalisationDetail?: string | null
          LocalisationID?: number | null
          Montee?: boolean | null
          NeedsPhotograph?: boolean | null
          OeuvreID: number
          PresentationID?: number | null
          Prix?: number | null
          PrixFinal?: number | null
          Profondeur?: string | null
          ReturnDate?: string | null
          StageProduction?: string | null
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
          commercial_status?: string | null
          ContactID?: number | null
          DateLivraison?: string | null
          DateStatut?: string | null
          deleted_at?: string | null
          Discount?: number | null
          Encadree?: boolean | null
          Exposable?: boolean | null
          Format?: number | null
          Hauteur?: string | null
          Historique?: string | null
          is_gift?: boolean | null
          is_paid?: boolean | null
          is_public?: boolean
          IsCommission?: boolean | null
          Largeur?: string | null
          LocalisationDetail?: string | null
          LocalisationID?: number | null
          Montee?: boolean | null
          NeedsPhotograph?: boolean | null
          OeuvreID?: number
          PresentationID?: number | null
          Prix?: number | null
          PrixFinal?: number | null
          Profondeur?: string | null
          ReturnDate?: string | null
          StageProduction?: string | null
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
            foreignKeyName: "Oeuvres_LocalisationID_fkey"
            columns: ["LocalisationID"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "Oeuvres_PresentationID_fkey"
            columns: ["PresentationID"]
            isOneToOne: false
            referencedRelation: "tblPresentation"
            referencedColumns: ["PresentationID"]
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
          visitor_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: number
          is_team_session?: boolean
          path: string
          referrer?: string | null
          visitor_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: number
          is_team_session?: boolean
          path?: string
          referrer?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      pending_changes: {
        Row: {
          author_email: string | null
          author_id: string | null
          baseline: Json | null
          created_at: string
          id: number
          oeuvre_id: number
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
          created_at?: string
          id?: number
          oeuvre_id: number
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
          created_at?: string
          id?: number
          oeuvre_id?: number
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
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
      private_link: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          group_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          token: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          group_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          token: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          group_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          token?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_link_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "working_group"
            referencedColumns: ["id"]
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
      sale_order: {
        Row: {
          balance_due: string | null
          balance_paid: boolean
          buyer_id: number | null
          completed_at: string | null
          created_at: string
          currency: string
          delivered: boolean
          delivery_address: string | null
          delivery_date: string | null
          deposit_due: string | null
          deposit_paid: boolean
          deposit_pct: number | null
          discount_pct: number | null
          id: string
          notes: string | null
          oeuvre_id: number
          order_ref: string | null
          payment_method: string | null
          pdf_path: string | null
          prix_catalogue: number | null
          prix_final: number | null
          return_window_days: number
          return_window_skipped: boolean
          return_window_starts_at: string | null
          shipping_method: string | null
          statut: string
        }
        Insert: {
          balance_due?: string | null
          balance_paid?: boolean
          buyer_id?: number | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered?: boolean
          delivery_address?: string | null
          delivery_date?: string | null
          deposit_due?: string | null
          deposit_paid?: boolean
          deposit_pct?: number | null
          discount_pct?: number | null
          id?: string
          notes?: string | null
          oeuvre_id: number
          order_ref?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          prix_catalogue?: number | null
          prix_final?: number | null
          return_window_days?: number
          return_window_skipped?: boolean
          return_window_starts_at?: string | null
          shipping_method?: string | null
          statut?: string
        }
        Update: {
          balance_due?: string | null
          balance_paid?: boolean
          buyer_id?: number | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered?: boolean
          delivery_address?: string | null
          delivery_date?: string | null
          deposit_due?: string | null
          deposit_paid?: boolean
          deposit_pct?: number | null
          discount_pct?: number | null
          id?: string
          notes?: string | null
          oeuvre_id?: number
          order_ref?: string | null
          payment_method?: string | null
          pdf_path?: string | null
          prix_catalogue?: number | null
          prix_final?: number | null
          return_window_days?: number
          return_window_skipped?: boolean
          return_window_starts_at?: string | null
          shipping_method?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_order_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "Contact"
            referencedColumns: ["ContactID"]
          },
          {
            foreignKeyName: "sale_order_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
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
          created_at: string | null
          delivered_at: string | null
          id: string
          kind: string | null
          note: string | null
          order_id: string | null
          sale_order_id: string | null
          scheduled_for: string | null
          shipped_at: string | null
          status: string | null
          to_contact_id: number | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          kind?: string | null
          note?: string | null
          order_id?: string | null
          sale_order_id?: string | null
          scheduled_for?: string | null
          shipped_at?: string | null
          status?: string | null
          to_contact_id?: number | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          kind?: string | null
          note?: string | null
          order_id?: string | null
          sale_order_id?: string | null
          scheduled_for?: string | null
          shipped_at?: string | null
          status?: string | null
          to_contact_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_sale_order_id_fkey"
            columns: ["sale_order_id"]
            isOneToOne: false
            referencedRelation: "sale_order"
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
          oeuvre_id: number | null
          shipment_id: string | null
        }
        Insert: {
          id?: string
          oeuvre_id?: number | null
          shipment_id?: string | null
        }
        Update: {
          id?: string
          oeuvre_id?: number | null
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_work_oeuvre_id_fkey"
            columns: ["oeuvre_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
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
          strength: number | null
          target_id: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          relation_type?: string | null
          source_id?: number | null
          strength?: number | null
          target_id?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          relation_type?: string | null
          source_id?: number | null
          strength?: number | null
          target_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tblrelations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
          {
            foreignKeyName: "tblrelations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
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
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
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
          created_at: string
          duration_ms: number | null
          id: string
          kind: string
          oeuvre_id: number | null
          process_id: string | null
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
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          oeuvre_id?: number | null
          process_id?: string | null
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
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          oeuvre_id?: number | null
          process_id?: string | null
          sketchbook_id?: string | null
          subject?: string | null
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
        }
        Insert: {
          action_type_id: number
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: number
          note?: string | null
          oeuvre_id: number
        }
        Update: {
          action_type_id?: number
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: number
          note?: string | null
          oeuvre_id?: number
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
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
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
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string | null
        }
        Relationships: []
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
            referencedRelation: "Oeuvres"
            referencedColumns: ["OeuvreID"]
          },
        ]
      }
    }
    Views: {
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
    }
    Functions: {
      audit_log_prune: {
        Args: never
        Returns: {
          deleted_broadcast_events: number
          deleted_oeuvre_versions: number
          deleted_pending_changes: number
          deleted_system_log: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_team: { Args: never; Returns: boolean }
      my_contact_id: { Args: never; Returns: number }
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
  public: {
    Enums: {},
  },
} as const
