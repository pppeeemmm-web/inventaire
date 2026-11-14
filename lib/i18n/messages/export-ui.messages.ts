import { defineMessages } from '../message-core'

/** Selection export dialog rebuilt with a live preview (B3, owner D2 2026-11-14: + Labels + CSV/XLSX). */
export const exportUiMessages = defineMessages({
  ex_title_fmt: { fr: 'Exporter {n} œuvres', en: 'Export {n} works' },
  ex_tabs: { fr: 'Type d’export', en: 'Export type' },
  ex_tab_labels: { fr: 'Étiquettes', en: 'Labels' },
  ex_tab_csv: { fr: 'CSV / XLSX', en: 'CSV / XLSX' },
  ex_preview: { fr: 'Aperçu', en: 'Preview' },
  ex_preview_of_fmt: {
    fr: 'Le vrai fichier, sur les {n} premières œuvres de {total}',
    en: 'The real file, on the first {n} of {total} works',
  },
  ex_preview_loading: { fr: 'Aperçu en cours…', en: 'Updating preview…' },
  ex_preview_error: { fr: 'Aperçu impossible :', en: 'Preview failed:' },
  ex_layout_options: { fr: 'Mise en page', en: 'Layout' },
  ex_label_preset: { fr: 'Planche', en: 'Sheet' },
  ex_label_start: { fr: 'Commencer à l’étiquette n°', en: 'Start at label no.' },
  ex_label_start_hint: {
    fr: 'Pour une planche déjà entamée : les étiquettes avant celle-ci restent vides.',
    en: 'For a partly used sheet: the labels before this one stay blank.',
  },
  ex_label_sheets_fmt: { fr: '{n} étiquettes · {sheets} planche(s)', en: '{n} labels · {sheets} sheet(s)' },
  ex_label_fields_hint: {
    fr: 'Sur l’étiquette : titre, année · technique · support, dimensions, prix, n°. Image, statut et notes ne s’impriment pas.',
    en: 'On the label: title, year · technique · support, dimensions, price, no. Image, status and notes are not printed.',
  },
  ex_csv_rows_fmt: { fr: '{n} lignes · colonnes = champs cochés', en: '{n} rows · columns = ticked fields' },
  ex_csv_more_fmt: { fr: '… et {n} autres lignes', en: '… and {n} more rows' },
  ex_download_csv: { fr: 'Télécharger CSV', en: 'Download CSV' },
  ex_download_xlsx: { fr: 'Télécharger XLSX', en: 'Download XLSX' },
})
