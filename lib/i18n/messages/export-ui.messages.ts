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
    fr: 'Sur l’étiquette : image à gauche (pas avec le QR sur L7160 / L7651), titre, année · technique · support, dimensions, prix, n°. Statut et notes ne s’impriment pas.',
    en: 'On the label: image on the left (not with the QR on L7160 / L7651), title, year · technique · support, dimensions, price, no. Status and notes are not printed.',
  },
  ex_label_qr: { fr: 'QR code (ouvre l’œuvre dans l’Atelier)', en: 'QR code (opens the work in the Atelier)' },
  ex_label_qr_hint: {
    fr: 'À droite de l’étiquette. Le scanner de l’Atelier le lit ; il faut être connecté pour voir l’œuvre.',
    en: 'On the right of the label. The Atelier scanner reads it; you need to be signed in to see the work.',
  },
  ex_label_qr_hint_small: {
    fr: 'Petite étiquette : QR d’environ 17 mm, le titre est coupé plus tôt. Testez un scan avant d’imprimer toute une planche.',
    en: 'Small label: QR about 17 mm, the title is cut sooner. Test a scan before printing a whole sheet.',
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
  // TODO B7 (2026-11-15): labels print the image now; status / notes are not printed on labels.
  ex_label_field_unused: { fr: 'Pas imprimé sur les étiquettes', en: 'Not printed on labels' },
  ex_label_image_no_room: {
    fr: 'Pas de place pour l’image à côté du QR sur ce format : décochez le QR ou prenez L7163 / L7165.',
    en: 'No room for the image beside the QR on this sheet: untick the QR or use L7163 / L7165.',
  },
})
