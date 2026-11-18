import { defineMessages } from '../message-core'

// Supply orders (TODO 11 + 11d): Studio → Fournitures → Commandes, receiving, expense, invoice files.
export const supplyOrdersMessages = defineMessages({
  supplies_view_orders: { fr: 'Commandes', en: 'Orders' },

  // List
  so_intro: {
    fr: 'Commandes aux fournisseurs et achats en magasin. « Recevoir » ajoute les quantités au stock ; une erreur se corrige au Comptage.',
    en: 'Orders to suppliers and shop purchases. « Receive » adds the quantities to stock; a wrong figure is fixed in Count.',
  },
  so_filter_aria: { fr: 'Filtrer les commandes', en: 'Filter orders' },
  so_filter_open_fmt: { fr: 'En cours · {n}', en: 'Open · {n}' },
  so_filter_all_fmt: { fr: 'Toutes · {n}', en: 'All · {n}' },
  so_new_order: { fr: '+ Commande', en: '+ Order' },
  so_new_purchase: { fr: '+ Achat', en: '+ Purchase' },
  so_empty: { fr: 'Aucune commande.', en: 'No orders.' },
  so_col_ref: { fr: 'Réf.', en: 'Ref.' },
  so_col_supplier: { fr: 'Fournisseur', en: 'Supplier' },
  so_col_status: { fr: 'État', en: 'Status' },
  so_col_lines: { fr: 'Lignes', en: 'Lines' },
  so_col_total: { fr: 'Total HT', en: 'Total excl. VAT' },
  so_col_dates: { fr: 'Dates', en: 'Dates' },
  so_col_expense: { fr: 'Dép.', en: 'Exp.' },
  so_col_files: { fr: 'Fact.', en: 'Inv.' },
  so_lines_fmt: { fr: '{n} ligne(s)', en: '{n} line(s)' },
  so_date_ordered_fmt: { fr: 'cmd {d}', en: 'ord. {d}' },
  so_date_received_fmt: { fr: 'reçu {d}', en: 'rec. {d}' },

  // Status
  so_status_draft: { fr: 'Brouillon', en: 'Draft' },
  so_status_ordered: { fr: 'Commandée', en: 'Ordered' },
  so_status_partial: { fr: 'Reçue {n} / {of}', en: 'Received {n} / {of}' },
  so_status_partial_some: { fr: 'Reçue en partie', en: 'Partly received' },
  so_status_received: { fr: 'Reçue', en: 'Received' },
  so_status_closed_short: { fr: 'Close (manque)', en: 'Closed (short)' },
  so_status_cancelled: { fr: 'Annulée', en: 'Cancelled' },

  // Sheet
  so_new_title: { fr: 'Nouvelle commande', en: 'New order' },
  so_purchase_title: { fr: 'Nouvel achat', en: 'New purchase' },
  so_order_title_fmt: { fr: 'Commande {ref}', en: 'Order {ref}' },
  so_loading: { fr: 'Chargement…', en: 'Loading…' },
  so_supplier: { fr: 'Fournisseur', en: 'Supplier' },
  so_change: { fr: 'Changer', en: 'Change' },
  so_supplier_search: { fr: 'Rechercher un fournisseur ou un contact…', en: 'Search a supplier or contact…' },
  so_new_supplier: { fr: '+ Nouveau fournisseur…', en: '+ New supplier…' },
  so_new_supplier_name: { fr: 'Nom du fournisseur', en: 'Supplier name' },
  so_new_supplier_email: { fr: 'E-mail (facultatif)', en: 'Email (optional)' },
  so_new_supplier_phone: { fr: 'Téléphone (facultatif)', en: 'Phone (optional)' },
  so_add_supplier: { fr: 'Ajouter le fournisseur', en: 'Add supplier' },
  so_lines: { fr: 'Lignes', en: 'Lines' },
  so_lines_empty: { fr: 'Aucun article pour l’instant.', en: 'No items yet.' },
  so_qty: { fr: 'Qté', en: 'Qty' },
  so_price_ht: { fr: 'Prix HT', en: 'Price excl. VAT' },
  so_remove_line: { fr: 'Retirer la ligne', en: 'Remove line' },
  so_in_stock_fmt: { fr: 'en stock {n} {unit}', en: 'in stock {n} {unit}' },
  so_received_fmt: { fr: 'reçu {n} / {of}', en: 'received {n} / {of}' },
  so_item_search: { fr: '+ Article : rechercher dans le stock…', en: '+ Item: search the stock…' },
  so_new_item_fmt: { fr: '+ Nouvel article « {name} »', en: '+ New item « {name} »' },
  so_new_item_name: { fr: 'Nom de l’article', en: 'Item name' },
  so_new_item_unit: { fr: 'Unité (tube, l, m…)', en: 'Unit (tube, l, m…)' },
  so_new_item_category: { fr: 'Catégorie (facultatif)', en: 'Category (optional)' },
  so_add_item: { fr: 'Ajouter l’article', en: 'Add item' },
  so_total_ht: { fr: 'Total HT', en: 'Total excl. VAT' },
  so_notes: { fr: 'Notes', en: 'Notes' },

  // Steps
  so_save_draft: { fr: 'Brouillon', en: 'Save draft' },
  so_mark_ordered: { fr: 'Marquer commandée', en: 'Mark ordered' },
  so_receive: { fr: 'Recevoir…', en: 'Receive…' },
  so_receive_rest: { fr: 'Recevoir le reste…', en: 'Receive the rest…' },
  so_close_short: { fr: 'Clore (manque accepté)', en: 'Close (accept shortfall)' },
  so_copy_text: { fr: 'Copier le texte', en: 'Copy text' },
  so_delete_draft: { fr: 'Supprimer le brouillon', en: 'Delete draft' },
  so_cancel_order: { fr: 'Annuler la commande', en: 'Cancel order' },
  so_confirm_cancel: { fr: 'Annuler cette commande ?', en: 'Cancel this order?' },
  so_confirm_close: {
    fr: 'Clore la commande avec ce qui est arrivé ? Le reste ne sera plus attendu.',
    en: 'Close the order with what arrived? The rest will no longer be expected.',
  },
  so_confirm_delete: { fr: 'Supprimer ce brouillon ?', en: 'Delete this draft?' },

  // Receive
  so_receive_title: { fr: 'Recevoir', en: 'Receive' },
  so_move_fmt: { fr: 'stock {from} → {to} {unit}', en: 'stock {from} → {to} {unit}' },
  so_less: { fr: 'Moins', en: 'Less' },
  so_more: { fr: 'Plus', en: 'More' },
  so_receive_hint: {
    fr: 'Le prix payé devient le coût unitaire de l’article et ce fournisseur devient le sien. Une ligne à 0 reste à recevoir. Pas d’annulation : une erreur se corrige au Comptage.',
    en: 'The price paid becomes the item’s unit cost and this supplier becomes its supplier. A line at 0 stays due. No undo: a wrong figure is fixed in Count.',
  },
  so_receive_confirm: { fr: 'Recevoir', en: 'Receive' },
  so_received_toast: { fr: 'Reçu : stock mis à jour.', en: 'Received: stock updated.' },

  // Walk-in purchase
  so_ticket: { fr: 'Ticket / facture', en: 'Ticket / invoice' },
  so_ticket_pick: { fr: 'Photo ou PDF → Coffre « Factures »', en: 'Photo or PDF → Vault « Factures »' },
  so_purchase_expense: { fr: 'Créer la dépense', en: 'Create the expense' },
  so_received_today: { fr: 'Reçu aujourd’hui', en: 'Received today' },

  // Expense
  so_expense: { fr: 'Dépense', en: 'Expense' },
  so_expense_line_fmt: { fr: '{date} · n° {ref} · {ttc} TTC', en: '{date} · no. {ref} · {ttc} incl. VAT' },
  so_create_expense: { fr: 'Créer la dépense', en: 'Create the expense' },
  so_link_expense: { fr: 'Lier une dépense', en: 'Link an expense' },
  so_link_empty: { fr: 'Aucune dépense pour ce fournisseur.', en: 'No expenses for this supplier.' },
  so_unlink: { fr: 'Délier', en: 'Unlink' },
  so_exp_date: { fr: 'Date', en: 'Date' },
  so_exp_ref: { fr: 'N° de facture', en: 'Invoice no.' },
  so_exp_ht: { fr: 'HT', en: 'Excl. VAT' },
  so_exp_tva: { fr: 'TVA %', en: 'VAT %' },
  so_exp_ttc: { fr: 'TTC', en: 'Incl. VAT' },
  so_exp_hint: {
    fr: 'Pré-rempli depuis la commande : vérifiez les montants sur la facture. La dépense apparaît dans Revenus & dépenses.',
    en: 'Filled from the order: check the amounts against the invoice. The expense shows in Income & expenses.',
  },
  so_exp_save: { fr: 'Enregistrer la dépense', en: 'Save the expense' },
  so_expense_created: { fr: 'Dépense créée et liée.', en: 'Expense created and linked.' },

  // Files
  so_files: { fr: 'Factures et bons', en: 'Invoices and delivery notes' },
  so_add_file: { fr: '+ Fichier (photo ou PDF)', en: '+ File (photo or PDF)' },
  so_file_added: { fr: 'Fichier ajouté au Coffre « Factures ».', en: 'File added to the Vault « Factures ».' },
  so_file_default_name: { fr: 'Facture', en: 'Invoice' },
  so_expense_files: { fr: 'Facture / ticket', en: 'Invoice / ticket' },
  so_expense_orders_fmt: { fr: 'Commande(s) : {refs}', en: 'Order(s): {refs}' },
  so_open_order: { fr: 'Ouvrir', en: 'Open' },

  // Réassort
  so_create_from_restock: { fr: 'Créer la commande', en: 'Create the order' },
  so_created_from_restock: { fr: 'Commande brouillon créée.', en: 'Draft order created.' },

  // Errors
  so_err_sql_waiting: {
    fr: 'Les commandes attendent leur mise en place en base (SQL non appliqué).',
    en: 'Orders are waiting for their database setup (SQL not applied).',
  },
  so_err_auth: { fr: 'Accès réservé à l’équipe.', en: 'Team access only.' },
  so_err_supplier: { fr: 'Choisissez un fournisseur.', en: 'Choose a supplier.' },
  so_err_no_lines: { fr: 'Ajoutez au moins un article.', en: 'Add at least one item.' },
  so_err_qty: { fr: 'Quantité ou prix invalide.', en: 'Invalid quantity or price.' },
  so_err_duplicate_item: { fr: 'Un article ne peut figurer qu’une fois.', en: 'An item can only appear once.' },
  so_err_line_received: {
    fr: 'Une ligne déjà reçue ne peut pas être retirée.',
    en: 'A line already received cannot be removed.',
  },
  so_err_item: { fr: 'Nom d’article manquant.', en: 'Item name missing.' },
  so_err_nothing_to_receive: { fr: 'Rien à recevoir.', en: 'Nothing to receive.' },
  so_err_not_open: { fr: 'Cette commande n’est plus ouverte.', en: 'This order is no longer open.' },
  so_err_cancel_received: {
    fr: 'Des articles sont déjà reçus : clôturez la commande (« Clore ») plutôt que l’annuler.',
    en: 'Items are already received: close the order (« Close ») instead of cancelling it.',
  },
  so_err_date: { fr: 'Date invalide.', en: 'Invalid date.' },
  so_err_amount: { fr: 'Montant TTC invalide.', en: 'Invalid amount incl. VAT.' },
  so_err_has_expense: { fr: 'Cette commande a déjà une dépense.', en: 'This order already has an expense.' },
  so_err_upload: {
    fr: 'Envoi du fichier impossible (stockage refusé).',
    en: 'File upload failed (storage refused).',
  },
})
