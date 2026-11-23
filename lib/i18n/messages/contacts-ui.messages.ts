import { defineMessages } from '../message-core'

export const contactsUiMessages = defineMessages({
  contact_team_section: {
    fr: 'Accès atelier',
    en: 'Studio access',
  },
  contact_team_contact_id: {
    fr: 'Fiche contact',
    en: 'Contact record',
  },
  contact_team_connect: {
    fr: 'Connecter l’accès atelier',
    en: 'Connect studio access',
  },
  contact_team_connecting: {
    fr: 'Connexion…',
    en: 'Connecting…',
  },
  contact_team_connect_ok: {
    fr: 'Accès atelier connecté.',
    en: 'Studio access connected.',
  },
  contact_team_auth_exists: {
    fr: 'Compte Supabase trouvé pour cet e-mail.',
    en: 'Supabase account found for this email.',
  },
  contact_team_linked_other: {
    fr: 'Ce login est déjà lié à la fiche #{id}. Ouvrez cette fiche ou fusionnez les contacts.',
    en: 'This login is already linked to contact #{id}. Open that record or merge contacts.',
  },
  contact_team_save_email_first: {
    fr: 'Ajoutez un e-mail dans la section E-mails ci-dessous.',
    en: 'Add an email in the Emails section below.',
  },
  contact_team_member: {
    fr: 'Membre équipe',
    en: 'Team member',
  },
  contact_team_member_hint: {
    fr: 'Autorise la connexion à l’atelier (avec compte lié).',
    en: 'Allows sign-in to the studio (when an account is linked).',
  },
  contact_team_linked: {
    fr: 'Compte lié',
    en: 'Account linked',
  },
  contact_team_not_linked: {
    fr: 'Aucun compte auth lié',
    en: 'No auth account linked',
  },
  contact_team_link_account: {
    fr: 'Lier le compte Supabase',
    en: 'Link Supabase account',
  },
  contact_team_linking: {
    fr: 'Liaison…',
    en: 'Linking…',
  },
  contact_team_link_ok: {
    fr: 'Compte lié.',
    en: 'Account linked.',
  },
  contact_team_invite_send: {
    fr: 'Envoyer une invitation (nouveau compte)',
    en: 'Send invite email (new account)',
  },
  contact_team_invite_confirm: {
    fr: 'Envoyer un e-mail d’invitation Supabase à cette adresse ? (nouveau compte uniquement)',
    en: 'Send a Supabase invite email to this address? (new accounts only)',
  },
  contact_team_invite_sending: {
    fr: 'Envoi…',
    en: 'Sending…',
  },
  contact_team_invite_save_first: {
    fr: 'Enregistrez le contact avant d’envoyer une invitation.',
    en: 'Save the contact before sending an invite.',
  },
  contact_team_invite_ok_invited: {
    fr: 'Invitation envoyée.',
    en: 'Invite sent.',
  },
  contact_team_invite_ok_linked: {
    fr: 'Compte existant lié.',
    en: 'Existing account linked.',
  },
  contact_team_invite_no_email: {
    fr: 'Ajoutez un e-mail avant d’inviter.',
    en: 'Add an email before inviting.',
  },
  contacts_merge_err_invoices: {
    fr: 'Ce contact a des factures : gardez-le, c’est l’autre qui doit disparaître (une facture émise ne change jamais de destinataire).',
    en: 'This contact has invoices: keep it and merge the other one into it (an issued invoice never changes hands).',
  },
  contacts_merge_err_both_invoiced: {
    fr: 'Les deux contacts ont des factures : la fusion est impossible (une facture émise ne change jamais de destinataire).',
    en: 'Both contacts have invoices: they can’t be merged (an issued invoice never changes hands).',
  },
  contact_save_forbidden: {
    fr: 'Rien n’a été enregistré : seule l’équipe peut modifier une fiche contact.',
    en: 'Nothing was saved: only the team can change a contact.',
  },
  contact_save_admin_only_fmt: {
    fr: 'Rien n’a été enregistré : « {field} » ne peut être changé que par un administrateur.',
    en: 'Nothing was saved: “{field}” can only be changed by an admin.',
  },
  contact_save_stale: {
    fr: 'Rien n’a été enregistré : cette fiche a été modifiée ailleurs entre-temps. Rouvrez-la pour voir la version actuelle, puis refaites votre changement.',
    en: 'Nothing was saved: this contact was changed elsewhere meanwhile. Reopen it to see the current version, then make your change again.',
  },
  contact_save_not_found: {
    fr: 'Rien n’a été enregistré : cette fiche n’existe plus (supprimée ou fusionnée).',
    en: 'Nothing was saved: this contact no longer exists (deleted or merged).',
  },
  contact_save_bad_field_fmt: {
    fr: 'Rien n’a été enregistré : le champ « {field} » ne passe pas par cette porte.',
    en: 'Nothing was saved: the field “{field}” cannot be saved here.',
  },
  contact_save_unchanged: {
    fr: 'Rien à enregistrer : la fiche était déjà ainsi.',
    en: 'Nothing to save: the contact was already like this.',
  },
  contact_save_error_fmt: {
    fr: 'Rien n’a été enregistré : {msg}',
    en: 'Nothing was saved: {msg}',
  },
  contact_editor_complement: { fr: 'Étage / appartement', en: 'Floor / flat' },
  contact_editor_complement_ph: { fr: '3e étage, rez-de-chaussée… (facultatif)', en: '3rd floor, ground floor… (optional)' },
  contact_editor_place_others_fmt: { fr: 'Aussi : {n} autre(s) personne(s) à ce lieu', en: 'Also: {n} other person(s) at this place' },
})
