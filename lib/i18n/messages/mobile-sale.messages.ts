import { defineMessages } from '../message-core'

export const mobileSaleMessages = defineMessages({
  sale_mobile_kicker: {
    fr: 'Terrain · vente',
    en: 'Field · sale',
  },
  sale_mobile_title: {
    fr: 'Encaisser une vente',
    en: 'Complete a sale',
  },
  sale_mobile_intro: {
    fr: 'Crée une commande de vente. Sans paiement : un brouillon, à signer dans Commandes. Paiement reçu : la commande est signée, l’acompte réserve l’œuvre, le prix entier la passe en vendu.',
    en: 'Creates a sale order. No payment: a draft, signed later in Orders. Money received: the order is signed, a deposit reserves the work, the full price marks it sold.',
  },
  sale_mobile_steps_aria: {
    fr: 'Étapes de la vente mobile',
    en: 'Mobile sale steps',
  },
  sale_mobile_step_work: {
    fr: 'Œuvres',
    en: 'Works',
  },
  sale_mobile_step_buyer: {
    fr: 'Acheteur',
    en: 'Buyer',
  },
  sale_mobile_step_payment: {
    fr: 'Paiement',
    en: 'Payment',
  },
  sale_mobile_step_review: {
    fr: 'Validation',
    en: 'Review',
  },
  sale_mobile_group_placeholder: {
    fr: 'Ajouter depuis un groupe',
    en: 'Add from a group',
  },
  sale_mobile_work_search: {
    fr: 'Rechercher par n° ou titre…',
    en: 'Search by no. or title…',
  },
  sale_mobile_catalogue_price: {
    fr: 'Prix catalogue (€)',
    en: 'Catalogue price (€)',
  },
  sale_mobile_discount: {
    fr: 'Remise (%)',
    en: 'Discount (%)',
  },
  sale_mobile_final_price: {
    fr: 'Prix final (€)',
    en: 'Final price (€)',
  },
  sale_mobile_payment_amount: {
    fr: 'Montant réglé (€)',
    en: 'Amount paid (€)',
  },
  sale_mobile_payment_method: {
    fr: 'Mode de paiement',
    en: 'Payment method',
  },
  sale_mobile_method_card: {
    fr: 'Terminal carte',
    en: 'Card terminal',
  },
  sale_mobile_method_cash: {
    fr: 'Espèces',
    en: 'Cash',
  },
  sale_mobile_method_bank: {
    fr: 'Virement bancaire',
    en: 'Bank transfer',
  },
  sale_mobile_method_cheque: {
    fr: 'Chèque',
    en: 'Cheque',
  },
  sale_mobile_method_paypal: {
    fr: 'PayPal',
    en: 'PayPal',
  },
  sale_mobile_notes: {
    fr: 'Notes',
    en: 'Notes',
  },
  sale_mobile_summary_works: {
    fr: 'Œuvres',
    en: 'Works',
  },
  sale_mobile_summary_buyer: {
    fr: 'Acheteur',
    en: 'Buyer',
  },
  sale_mobile_summary_paid: {
    fr: 'Réglé',
    en: 'Paid',
  },
  sale_mobile_summary_remaining: {
    fr: 'Reste',
    en: 'Remaining',
  },
  sale_mobile_summary_order: {
    fr: 'Commande',
    en: 'Order',
  },
  sale_mobile_next: {
    fr: 'Continuer',
    en: 'Continue',
  },
  sale_mobile_complete: {
    fr: 'Créer et finaliser',
    en: 'Create and finish',
  },
  sale_mobile_completing: {
    fr: 'Finalisation…',
    en: 'Finishing…',
  },
  sale_mobile_validation_step: {
    fr: 'Complétez cette étape avant de continuer.',
    en: 'Complete this step before continuing.',
  },
  sale_mobile_done_kicker: {
    fr: 'Vente enregistrée',
    en: 'Sale recorded',
  },
  sale_mobile_done_title: {
    fr: 'C’est fait',
    en: 'Done',
  },
  sale_mobile_done_completed: {
    fr: 'Paiement complet : l’œuvre est passée en vendu. L’argent reste en attente jusqu’à 14 jours après la remise (marquez « Livrée » dans Commandes quand l’acheteur l’emporte).',
    en: 'Full payment recorded: the work is now sold. The money stays held until 14 days after hand-over (mark « Delivered » in Orders when the buyer takes it).',
  },
  sale_mobile_done_pending: {
    fr: 'Acompte enregistré : la commande est signée et l’œuvre réservée pour l’acheteur.',
    en: 'Deposit recorded: the order is signed and the work reserved for the buyer.',
  },
  sale_mobile_done_draft: {
    fr: 'Brouillon de vente créé, avec son bon de commande. Rien ne bouge tant qu’il n’est pas signé dans Commandes.',
    en: 'Draft sale created, with its order form. Nothing moves until it is signed in Orders.',
  },
  sale_mobile_done_hub: {
    fr: 'Retour au Hub',
    en: 'Back to Hub',
  },
  sale_mobile_done_sales: {
    fr: 'Voir la commande',
    en: 'View the order',
  },
  sale_mobile_remove_work: {
    fr: 'Retirer l’œuvre',
    en: 'Remove work',
  },
  sale_mobile_forbidden_title: {
    fr: 'Accès refusé',
    en: 'Access denied',
  },
  sale_mobile_forbidden_body: {
    fr: 'Cette action est réservée à l’équipe.',
    en: 'This action is restricted to the team.',
  },
  hub_field_sale: {
    fr: 'Vente / paiement',
    en: 'Sale / payment',
  },
  hub_field_sale_sub: {
    fr: 'Encaisser et solder',
    en: 'Record and complete',
  },
  // Buyer step: search + « + Nouveau contact » (stress test 2026-11-18).
  sale_mobile_buyer_search_label: {
    fr: 'Rechercher un acheteur',
    en: 'Find a buyer',
  },
  sale_mobile_buyer_search_ph: {
    fr: 'Nom, prénom ou structure',
    en: 'Name, first name or organisation',
  },
  sale_mobile_buyer_none: {
    fr: 'Aucun contact trouvé — créez-le ci-dessous.',
    en: 'No contact found — create it below.',
  },
  sale_mobile_buyer_new_failed: {
    fr: 'Le contact n’a pas été créé.',
    en: 'The contact was not created.',
  },
})
