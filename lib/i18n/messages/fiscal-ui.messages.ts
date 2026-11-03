import { defineMessages } from '../message-core'

export const fiscalUiMessages = defineMessages({
  fiscal_regime_reel: {
    fr: 'Déclaration contrôlée',
    en: 'Controlled declaration (réel)',
  },
  fiscal_no_expenses_year: {
    fr: 'Aucune dépense enregistrée pour {year}. Cliquez sur « + Nouvelle dépense » pour commencer.',
    en: 'No expenses recorded for {year}. Click « + New expense » to get started.',
  },
  fiscal_doc_type_docket: {
    fr: 'Bon de livraison',
    en: 'Delivery note',
  },
  fiscal_receipt_ref_label: {
    fr: 'Référence justificatif / numéro dossier',
    en: 'Receipt / file reference',
  },
  fiscal_delete_confirm: {
    fr: 'Supprimer ?',
    en: 'Delete?',
  },
  fiscal_expense_desc_placeholder: {
    fr: 'Description de la dépense',
    en: 'Expense description',
  },
  fiscal_cost_works_label: {
    fr: 'Œuvres concernées (coût par œuvre)',
    en: 'Works this cost belongs to (cost per work)',
  },
  fiscal_cost_works_hint: {
    fr: 'Montant vide = dépense TTC répartie à parts égales entre les œuvres liées. Visible par l’admin seulement.',
    en: 'Empty amount = expense (incl. VAT) split evenly across the linked works. Admin only.',
  },
  fiscal_cost_works_search_ph: {
    fr: 'N° ou titre de l’œuvre…',
    en: 'Work no. or title…',
  },
  fiscal_cost_amount_ph: {
    fr: 'part €',
    en: 'share €',
  },
  fiscal_cost_remove: {
    fr: 'Retirer cette œuvre',
    en: 'Remove this work',
  },
  wf_cost_title: {
    fr: 'Coût de revient (admin)',
    en: 'Cost (admin)',
  },
  wf_cost_total: {
    fr: 'Total des coûts',
    en: 'Total cost',
  },
  wf_cost_none: {
    fr: 'Aucune dépense liée. Liez des dépenses à cette œuvre depuis Revenus & Dépenses.',
    en: 'No linked expenses. Link expenses to this work from Income & Expenses.',
  },
  wf_cost_margin_sale: {
    fr: 'Marge sur la vente',
    en: 'Margin on the sale',
  },
  wf_cost_margin_catalogue: {
    fr: 'Marge au prix catalogue',
    en: 'Margin at catalogue price',
  },
  wf_cost_split: {
    fr: 'réparti',
    en: 'split',
  },
  wf_cost_detail_fmt: {
    fr: 'Détail des dépenses ({n})',
    en: 'Expense detail ({n})',
  },
  wf_cost_uncategorised: {
    fr: 'Sans catégorie',
    en: 'Uncategorised',
  },
  fiscal_by_year_tab: { fr: 'Par année', en: 'By year' },
  fiscal_by_year_heading: {
    fr: 'Recettes et dépenses par année',
    en: 'Income and expenses by year',
  },
  fiscal_by_year_hint: {
    fr: 'Recettes encaissées (paiements, ou ventes conclues sans paiement saisi) ; dépenses TTC.',
    en: 'Income received (payments, or completed sales with no payment recorded); expenses incl. VAT.',
  },
  fiscal_col_year: { fr: 'Année', en: 'Year' },
  fiscal_col_income: { fr: 'Recettes', en: 'Income' },
  fiscal_col_expenses: { fr: 'Dépenses TTC', en: 'Expenses' },
  fiscal_col_net: { fr: 'Solde', en: 'Net' },
  fiscal_col_count: { fr: 'Nb dépenses', en: 'Expense count' },
  fiscal_year_to_date_fmt: { fr: '{year} au {date}', en: '{year} to {date}' },
  fiscal_same_period_fmt: { fr: '{year}, même période', en: '{year}, same period' },
  fiscal_by_year_empty: { fr: 'Aucune recette ni dépense enregistrée.', en: 'No income or expenses recorded.' },
  fiscal_flow_income: { fr: 'Recette', en: 'Income' },
  fiscal_flow_expense: { fr: 'Dépense', en: 'Expense' },
  fiscal_pivot_dim_year: { fr: 'Année', en: 'Year' },
  fiscal_pivot_dim_month: { fr: 'Mois', en: 'Month' },
  fiscal_pivot_dim_flow: { fr: 'Recette / dépense', en: 'Income / expense' },
  fiscal_pivot_amount: { fr: 'Montant', en: 'Amount' },
  fiscal_pivot_net: { fr: 'Solde (recettes − dépenses)', en: 'Net (income − expenses)' },
  fiscal_pivot_sales: { fr: 'Ventes', en: 'Sales' },
})
