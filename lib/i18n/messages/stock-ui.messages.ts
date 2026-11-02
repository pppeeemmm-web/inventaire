import { defineMessages } from '../message-core'

export const stockUiMessages = defineMessages({
  stock_suppliers_section: {
    fr: 'Fournisseurs',
    en: 'Suppliers',
  },
  stock_supplier_search_ph: {
    fr: 'Rechercher un fournisseur…',
    en: 'Search suppliers…',
  },
  stock_supplier_empty: {
    fr: 'Aucun fournisseur — rôle Fournisseur, Magasin ou Fabricant, ou lien sur un article de stock.',
    en: 'No suppliers yet — use role Supplier, Magasin, or Fabricant, or link one on a stock item.',
  },
  stock_supplier_no_filtered: {
    fr: 'Aucun fournisseur ne correspond à la recherche.',
    en: 'No suppliers match your search.',
  },
  stock_supplier_col_contact: {
    fr: 'Coordonnées',
    en: 'Contact',
  },
  stock_supplier_select_all_aria: {
    fr: 'Tout sélectionner (liste visible)',
    en: 'Select all (visible list)',
  },
  stock_supplier_selection_fmt: {
    fr: '{n} sélectionné(s)',
    en: '{n} selected',
  },
  stock_supplier_export_list: {
    fr: 'Exporter la liste',
    en: 'Export list',
  },
  stock_supplier_export_copied: {
    fr: 'Liste copiée dans le presse-papiers.',
    en: 'List copied to clipboard.',
  },
  stock_supplier_export_clipboard_failed: {
    fr: 'Fichier téléchargé ; copie presse-papiers indisponible.',
    en: 'File downloaded; clipboard copy unavailable.',
  },
  stock_supplier_clear: {
    fr: 'Effacer la sélection',
    en: 'Clear selection',
  },
  stock_supplier_print_blocked: {
    fr: 'Autorisez les fenêtres pop-up pour imprimer la liste.',
    en: 'Allow pop-ups to print the list.',
  },
  stock_materials_section: {
    fr: 'Matériaux & stock',
    en: 'Materials & stock',
  },
  stock_supplier_export_label_contact: {
    fr: 'Coordonnées',
    en: 'Contact',
  },
  stock_supplier_export_label_address: {
    fr: 'Adresse',
    en: 'Address',
  },
  stock_supplier_export_label_notes: {
    fr: 'Notes',
    en: 'Notes',
  },
  stock_supplier_export_generated: {
    fr: 'Généré le',
    en: 'Generated',
  },
  stock_jump_suppliers: {
    fr: 'Liste fournisseurs ↑',
    en: 'Suppliers list ↑',
  },
  stock_material_select_all_aria: {
    fr: 'Tout sélectionner (matériaux visibles)',
    en: 'Select all (visible list)',
  },
  stock_material_selection_fmt: {
    fr: '{n} article(s) sélectionné(s)',
    en: '{n} item(s) selected',
  },
  stock_material_clear: {
    fr: 'Effacer la sélection',
    en: 'Clear selection',
  },
  stock_material_export_list: {
    fr: 'Exporter la liste',
    en: 'Export list',
  },
  stock_material_export_copied: {
    fr: 'Liste copiée dans le presse-papiers.',
    en: 'List copied to clipboard.',
  },
  stock_material_export_clipboard_failed: {
    fr: 'Fichier téléchargé ; copie presse-papiers indisponible.',
    en: 'File downloaded; clipboard copy unavailable.',
  },
  stock_material_print_blocked: {
    fr: 'Autorisez les fenêtres pop-up pour imprimer la liste.',
    en: 'Allow pop-ups to print the list.',
  },
  stock_material_export_line_value: {
    fr: 'Valeur ligne',
    en: 'Line value',
  },
  stock_export_all_csv: {
    fr: 'Exporter tout (CSV)',
    en: 'Export all (CSV)',
  },
  stock_suppliers_expand: {
    fr: 'Afficher la section fournisseurs',
    en: 'Show suppliers section',
  },
  stock_suppliers_collapse: {
    fr: 'Masquer la section fournisseurs',
    en: 'Hide suppliers section',
  },
  stock_filtered_count_fmt: {
    fr: '{shown} / {total} article(s)',
    en: '{shown} / {total} item(s)',
  },
  stock_filter_supplier_all: {
    fr: 'Tous les fournisseurs',
    en: 'All suppliers',
  },
  stock_filters_clear: {
    fr: 'Effacer les filtres',
    en: 'Clear filters',
  },
  stock_supplier_export_downloaded: {
    fr: 'Liste fournisseurs téléchargée.',
    en: 'Supplier list downloaded.',
  },
  stock_material_export_downloaded: {
    fr: 'Liste matériaux téléchargée.',
    en: 'Materials list downloaded.',
  },
  stock_supplier_filter_by: {
    fr: 'Filtrer les matériaux par ce fournisseur',
    en: 'Filter materials by this supplier',
  },
  stock_supplier_open_contact: {
    fr: 'Ouvrir la fiche contact',
    en: 'Open contact card',
  },
  stock_supplier_filter_chip_fmt: {
    fr: 'Fournisseur : {name}',
    en: 'Supplier: {name}',
  },
  supplies_view_stock: { fr: 'Stock', en: 'Stock' },
  supplies_view_count: { fr: 'Comptage', en: 'Count' },
  supplies_view_restock: { fr: 'Réassort / Commande', en: 'Restock / Order' },
  supplies_views_aria: { fr: 'Vues des fournitures', en: 'Supplies views' },
  restock_intro: {
    fr: 'Ce qui manque ou passe sous son minimum, groupé par fournisseur. Saisissez les quantités à commander puis copiez la commande. Le minimum se règle ici et alimente le badge « Bas ».',
    en: 'What is out of stock or below its minimum, grouped by supplier. Enter the quantities to order, then copy the order. Minimums set here also drive the "Low" badge.',
  },
  restock_show_all: { fr: 'Afficher toutes les fournitures', en: 'Show all supplies' },
  restock_empty: {
    fr: 'Rien sous le minimum. Aucun minimum n’est encore réglé : cochez « Afficher toutes les fournitures » pour en régler ou préparer une commande.',
    en: 'Nothing below minimum. No minimums are set yet: tick "Show all supplies" to set some or prepare an order.',
  },
  restock_no_supplier: { fr: 'Sans fournisseur', en: 'No supplier' },
  restock_col_item: { fr: 'Fourniture', en: 'Item' },
  restock_col_qty: { fr: 'En stock', en: 'In stock' },
  restock_col_min: { fr: 'Minimum', en: 'Minimum' },
  restock_col_order: { fr: 'À commander', en: 'To order' },
  restock_col_estimate: { fr: 'Estimation', en: 'Estimate' },
  restock_copy: { fr: 'Copier la commande', en: 'Copy order' },
  restock_copied: { fr: 'Commande copiée', en: 'Order copied' },
  restock_order_header_fmt: { fr: 'Commande — {supplier} — {date}', en: 'Order — {supplier} — {date}' },
  restock_total_fmt: { fr: 'Total estimé : {total}', en: 'Estimated total: {total}' },
  restock_min_saved: { fr: 'Minimum enregistré', en: 'Minimum saved' },
})
