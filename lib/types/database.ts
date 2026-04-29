export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      Contact: {
        Row: {
          Actif: boolean | null
          Adresse: string | null
          auth_user_id: string | null
          CodePostal: string | null
          "Connecté": boolean | null
          ContactID: number
          Email: string | null
          Facebook: string | null
          "GDPR Requête": boolean | null
          Genre: string | null
          IndicatifPays1: string | null
          IndicatifPays2: string | null
          Instagram: string | null
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
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      Format: {
        Row: {
          Format: string | null
          FormatID: number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      OeuvreStatus: {
        Row: {
          id: number
          label: string
          color: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      OeuvreTheme: {
        Row: {
          OeuvreID: number
          ThemeID: number
        }
        Insert: { OeuvreID: number; ThemeID: number }
        Update: { [key: string]: unknown }
      }
      Oeuvres: {
        Row: {
          AcheteurID: number | null
          Année: string | null
          Catalogué: boolean | null
          Commentaires: string | null
          ContactID: number | null
          DateLivraison: string | null
          Discount: number | null
          Encadree: boolean | null
          Exposable: boolean | null
          Format: number | null
          Hauteur: string | null
          Historique: string | null
          IsCommission: boolean | null
          is_public: boolean | null
          Largeur: string | null
          LocalisationDetail: string | null
          LocalisationID: number | null
          OeuvreID: number
          Prénom: string | null
          PresentationID: number | null
          Prix: number | null
          PrixFinal: number | null
          Profondeur: string | null
          ReturnDate: string | null
          statusId: number | null
          Support: number | null
          Technique: number | null
          theme: string | null
          Titre: string | null
          txtImageNameLink: string | null
          UniteDimension: number | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      OeuvresComplete: {
        Row: { [key: string]: unknown }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      Support: {
        Row: {
          Support: string | null
          SupportID: number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      Technique: {
        Row: {
          Technique: string | null
          TechniqueID: number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      consignment: {
        Row: {
          id: number
          oeuvre_id: number | null
          contact_id: number | null
          start_date: string | null
          end_date: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      contact_addresses: {
        Row: {
          id: number
          contact_id: number | null
          label: string | null
          street: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          is_default: boolean | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      document: {
        Row: {
          id: number
          name: string
          kind: string | null
          notes: string | null
          doc_date: string | null
          oeuvre_id: number | null
          contact_id: number | null
          storage_path: string
          file_size: number
          mime_type: string
          cert_id: string | null
          cert_hash: string | null
          created_at: string | null
        }
        Insert: {
          name: string
          kind?: string | null
          notes?: string | null
          doc_date?: string | null
          oeuvre_id?: number | null
          contact_id?: number | null
          storage_path: string
          file_size: number
          mime_type: string
          cert_id?: string | null
          cert_hash?: string | null
        }
        Update: { [key: string]: unknown }
      }
      expense: {
        Row: {
          id: number
          oeuvre_id: number | null
          label: string | null
          amount: number | null
          currency: string | null
          date: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      private_link: {
        Row: {
          id: number
          token: string
          oeuvre_ids: number[]
          contact_id: number | null
          expires_at: string | null
          created_at: string | null
          label: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          updated_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      shipment: {
        Row: {
          id: number
          contact_id: number | null
          ship_date: string | null
          arrival_date: string | null
          carrier: string | null
          tracking: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      shipment_work: {
        Row: {
          shipment_id: number
          oeuvre_id: number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      suivi_etape: {
        Row: {
          id: number
          oeuvre_id: number | null
          label: string | null
          done: boolean | null
          due_date: string | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      suivi_process: {
        Row: {
          id: number
          oeuvre_id: number | null
          label: string | null
          status: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      suivi_reminder: {
        Row: {
          id: number
          oeuvre_id: number | null
          contact_id: number | null
          remind_at: string | null
          note: string | null
          done: boolean | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      tblImage: {
        Row: {
          DateAdded: string | null
          ImageID: number
          OeuvreID: number | null
          SeqNo: number | null
          txtImageName: string | null
          txtImageNameLink: string | null
        }
        Insert: {
          ImageID?: number
          OeuvreID?: number | null
          txtImageNameLink?: string | null
          txtImageName?: string | null
          SeqNo?: number | null
          DateAdded?: string | null
        }
        Update: { [key: string]: unknown }
      }
      tblPresentation: {
        Row: {
          Nom: string | null
          PresentationID: number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      tblRole: {
        Row: {
          id: number
          label: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      tblTheme: {
        Row: {
          Nom: string | null
          ThemeID: number
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      tblrelations: {
        Row: {
          id: number
          source_id: number
          target_id: number
          relation_type: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
      working_group: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { [key: string]: unknown }
      }
      working_group_work: {
        Row: {
          group_id: string
          oeuvre_id: number
          added_at: string | null
        }
        Insert: { [key: string]: unknown }
        Update: { [key: string]: unknown }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_team: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_contact_id: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

type PublicTables = Database["public"]["Tables"]
export type WorkImage = PublicTables["tblImage"]["Row"]
export type Oeuvre   = PublicTables["Oeuvres"]["Row"]
