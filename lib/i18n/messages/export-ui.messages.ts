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
  // Image quality (owner 2026-11-14): screen / print, 72 / 150 / 300 dpi, colour / black & white.
  ex_output: { fr: 'Sortie', en: 'Output' },
  ex_output_screen: { fr: 'Écran', en: 'Screen' },
  ex_output_print: { fr: 'Impression', en: 'Print' },
  ex_output_hint: {
    fr: 'Écran : 72 dpi, fichier léger (à envoyer, à regarder). Impression : 300 dpi. La résolution reste modifiable.',
    en: 'Screen: 72 dpi, a light file (to send, to look at). Print: 300 dpi. The resolution can still be changed.',
  },
  ex_dpi: { fr: 'Résolution', en: 'Resolution' },
  ex_colour: { fr: 'Couleur', en: 'Colour' },
  ex_colour_colour: { fr: 'Couleur', en: 'Colour' },
  ex_colour_mono: { fr: 'Noir & blanc', en: 'Black & white' },
  ex_img_linked: { fr: 'En ligne (chargées à l’ouverture)', en: 'Online (loaded when opened)' },
  ex_img_embedded: { fr: 'Dans le fichier', en: 'In the file' },
  ex_block_page: { fr: 'Page', en: 'Page' },
  ex_block_image: { fr: 'Image', en: 'Image' },
  ex_orientation: { fr: 'Orientation', en: 'Orientation' },
  ex_portrait: { fr: 'Portrait', en: 'Portrait' },
  ex_landscape: { fr: 'Paysage', en: 'Landscape' },
  ex_colour_light: { fr: 'N&B clair', en: 'Light B&W' },
  ex_colour_hint: {
    fr: 'N&B : images en gris. N&B clair : gris adouci (le noir imprime à 65 %), environ 35 % d’encre en moins sur les images.',
    en: 'B&W: grey images. Light B&W: softened grey (black prints at 65 %), about 35 % less ink on the images.',
  },
  ex_frame_cm_fmt: { fr: 'Cadre {w} × {h} cm · {px} px', en: 'Frame {w} × {h} cm · {px} px' },
  ex_frame_screen_fmt: { fr: 'Cadre {w} × {h} px à l’écran · {px} px', en: 'Frame {w} × {h} px on screen · {px} px' },
  ex_size_fmt: { fr: 'Fichier ≈ {size}', en: 'File ≈ {size}' },
  ex_size_hint: {
    fr: 'Estimé d’après les premières œuvres : l’écart peut atteindre ± 40 % selon les images.',
    en: 'Estimated from the first works: it can be off by ± 40 % depending on the images.',
  },
})
