export type Lang = 'fr' | 'en'

export type DictKey =
  | 'hub' | 'tagline' | 'signedAs'
  | 'team' | 'clients' | 'galleries' | 'public'
  | 'teamDesc' | 'clientsDesc' | 'galleriesDesc' | 'publicDesc'
  | 'overview' | 'inventory' | 'constellation' | 'production'
  | 'logistics' | 'sales' | 'exhibitions' | 'vault'
  | 'works' | 'works_cap' | 'catalogued' | 'exposable'
  | 'unpriced' | 'noImage' | 'thisYear' | 'wip' | 'consigned'
  | 'sold' | 'available' | 'totalValue' | 'atStudio' | 'onLoan'
  | 'allWorks' | 'recentlyAdded' | 'byTechnique' | 'bySupport'
  | 'byYear' | 'search' | 'filter' | 'reset' | 'untitled' | 'newWork'
  | 'quickActions' | 'openTasks' | 'upcomingShipments' | 'activity'
  | 'notes' | 'seeAll' | 'close' | 'back' | 'details' | 'cancel' | 'delete'
  | 'stage_idea' | 'stage_sketch' | 'stage_wip' | 'stage_drying'
  | 'stage_framing' | 'stage_shot' | 'stage_catalogued'
  | 'constellation_intro' | 'year' | 'technique' | 'support'
  | 'theme' | 'status' | 'allTech' | 'allSupports' | 'allYears'
  | 'showEdges' | 'hideEdges' | 'edgesBy' | 'selected' | 'clearSel'
  | 'curate' | 'workingGroups' | 'newGroup' | 'viewMode'
  | 'listView' | 'graphView' | 'gridView'
  | 'workingGroup' | 'exportChecklist' | 'exportPacket' | 'privateLink'
  | 'generateLink' | 'recipient' | 'expiresIn' | 'groupName'
  | 'addToGroup' | 'removeFromGroup' | 'shareWith' | 'priceOnRequest'
  | 'loading' | 'loadingInventory' | 'error' | 'empty'
  | 'noSelection' | 'clickToSelect'
  | 'title' | 'dimensions' | 'presentation' | 'contact'
  | 'price' | 'discount' | 'framed' | 'commission'
  | 'returnDate' | 'deliveryDate' | 'addToSel' | 'edit'
  | 'surDemande' | 'atelier' | 'localisation'
  | 'pipeline' | 'map' | 'contacts' | 'reminders' | 'upcomingDeadlines'
  | 'searchPlaceholderContacts' | 'allRoles' | 'deleteSelected' | 'confirmDeleteContacts'
  | 'fiscal' | 'expenses' | 'dashboard' | 'income' | 'tax' | 'category' | 'amount'
  | 'sales' | 'revenue' | 'orders' | 'newOrder' | 'buyer'
  | 'concepts' | 'themes' | 'location' | 'tirage' | 'exhibitable' | 'image'
  | 'searchFieldAll' | 'searchFieldName' | 'searchFieldCity' | 'searchFieldEmail' | 'searchFieldNotes'
  | 'identity' | 'depth' | 'visibility' | 'history' | 'save' | 'create'
  | 'priced' | 'date' | 'label'
  | 'selection' | 'modify' | 'export' | 'compare' | 'groupNamePlaceholder' | 'clear'
  | 'legend' | 'stage_mounting'

type Dictionary = Record<DictKey, string>

export const dict: Record<Lang, Dictionary> = {
  fr: {
    hub: 'Atelier',
    tagline: 'Inventaire · Production · Curation · Relations',
    signedAs: 'Atelier',
    team: 'Atelier', clients: 'Collectionneurs',
    galleries: 'Galeries', public: 'Portfolio',
    teamDesc: 'Inventaire complet, production, curation, logistique, ventes.',
    clientsDesc: 'Liens privés et sélections curatées par destinataire.',
    galleriesDesc: 'Consignations, listes partagées, oeuvres co-gérées.',
    publicDesc: 'Portfolio public, expositions, presse.',
    overview: "Vue d'ensemble", inventory: 'Inventaire',
    constellation: 'Constellation', production: 'Production',
    logistics: 'Logistique', sales: 'Ventes',
    exhibitions: 'Expositions', vault: 'Coffre',
    works: 'oeuvres', works_cap: 'Oeuvres', catalogued: 'cataloguées',
    exposable: 'exposables', unpriced: 'sans prix', noImage: 'sans image',
    thisYear: 'cette année', wip: 'en production',
    consigned: 'en consignation', sold: 'vendues',
    available: 'disponibles', totalValue: 'valeur totale',
    atStudio: "à l'atelier", onLoan: 'en prêt',
    allWorks: 'Toutes les oeuvres', recentlyAdded: 'Récemment ajoutées',
    byTechnique: 'Par technique', bySupport: 'Par support',
    byYear: 'Par année', search: 'Rechercher...',
    filter: 'Filtrer', reset: 'Réinitialiser',
    untitled: 'Sans titre', newWork: 'Nouvelle oeuvre',
    quickActions: 'Actions', openTasks: 'Tâches ouvertes',
    upcomingShipments: 'Envois à venir', activity: 'Activité',
    notes: 'Notes', seeAll: 'Tout voir', close: 'Fermer',
    back: 'Retour', details: 'Détails', cancel: 'Annuler', delete: 'Supprimer',
    stage_idea: 'Idée', stage_sketch: 'Esquisse', stage_wip: 'En cours',
    stage_drying: 'Séchage', stage_framing: 'À encadrer',
    stage_shot: 'À photographier', stage_catalogued: 'À cataloguer',
    constellation_intro: "Carte de l'oeuvre. Axe horizontal : année. Axe vertical : technique. Sélectionnez une région pour curer un groupe de travail.",
    year: 'Année', technique: 'Technique', support: 'Support',
    theme: 'Thème', status: 'Statut',
    allTech: 'Toutes techniques', allSupports: 'Tous supports',
    allYears: 'Toutes années', showEdges: 'Afficher les liens',
    hideEdges: 'Masquer les liens', edgesBy: 'Liens par',
    selected: 'sélectionnées', clearSel: 'Effacer', curate: 'Curer',
    workingGroups: 'Groupes de travail', newGroup: 'Nouveau groupe',
    viewMode: 'Vue', listView: 'Liste', graphView: 'Constellation', gridView: 'Grille',
    workingGroup: 'Groupe de travail',
    exportChecklist: 'Exporter checklist (PDF)',
    exportPacket: 'Exporter dossier presse',
    privateLink: 'Lien privé', generateLink: 'Générer un lien',
    recipient: 'Destinataire', expiresIn: 'Expire dans',
    groupName: 'Nom du groupe', addToGroup: 'Ajouter au groupe',
    removeFromGroup: 'Retirer', shareWith: 'Partager avec',
    priceOnRequest: 'Prix sur demande',
    loading: 'Chargement...', loadingInventory: "Chargement de l'inventaire...",
    error: 'Erreur', empty: 'Vide', noSelection: 'Aucune sélection',
    clickToSelect: 'Cliquez une oeuvre ou tracez une zone pour curer',
    title: 'Titre', dimensions: 'Dimensions', presentation: 'Présentation',
    contact: 'Contact', price: 'Prix', discount: 'Remise',
    framed: 'Encadrée', commission: 'Commission',
    returnDate: 'Retour', deliveryDate: 'Livraison',
    addToSel: '+ Groupe', edit: 'Éditer',
    surDemande: 'Sur demande', atelier: 'Atelier', localisation: 'Localisation',
    pipeline: 'Suivi', map: 'Carte', contacts: 'Contacts',
    reminders: 'Rappels', upcomingDeadlines: 'Échéances',
    searchPlaceholderContacts: 'Rechercher nom, institution, ville, email, notes...',
    allRoles: 'Tous rôles', deleteSelected: 'Supprimer',
    confirmDeleteContacts: 'Supprimer définitivement ces contacts ?',
    fiscal: 'Fiscal', expenses: 'Dépenses', dashboard: 'Tableau de bord',
    income: 'Revenus', tax: 'Impôts', category: 'Catégorie', amount: 'Montant',
    sales: 'Ventes', revenue: 'Chiffre d\'affaires', orders: 'Commandes',
    newOrder: 'Nouvelle commande', buyer: 'Acheteur',
    concepts: 'Concepts', themes: 'Thèmes / Groupes', location: 'Localisation',
    tirage: 'Tirage', exhibitable: 'Exposable', image: 'Image',
    searchFieldAll: 'Partout', searchFieldName: 'Nom', searchFieldCity: 'Ville',
    searchFieldEmail: 'Email', searchFieldNotes: 'Notes',
    identity: 'Identité', depth: 'Profondeur', visibility: 'Visibilité',
    history: 'Historique', save: 'Enregistrer', create: 'Créer',
    priced: 'Évalué', date: 'Date', label: 'Libellé',
    selection: 'SÉLECTION', modify: 'MODIFIER', export: 'EXPORTER',
    compare: 'COMPARER', groupNamePlaceholder: 'nom du groupe...', clear: 'EFFACER',
    legend: 'LÉGENDE', stage_mounting: 'À monter',
  },
  en: {
    hub: 'Studio', tagline: 'Inventory · Production · Curation · Relations',
    signedAs: 'Studio',
    team: 'Studio', clients: 'Collectors',
    galleries: 'Galleries', public: 'Portfolio',
    teamDesc: 'Full inventory, production, curation, logistics, sales.',
    clientsDesc: 'Private links and curated selections per recipient.',
    galleriesDesc: 'Consignments, shared checklists, co-managed works.',
    publicDesc: 'Public portfolio, exhibitions, press.',
    overview: 'Overview', inventory: 'Inventory',
    constellation: 'Constellation', production: 'Production',
    logistics: 'Logistics', sales: 'Sales',
    exhibitions: 'Exhibitions', vault: 'Vault',
    works: 'works', works_cap: 'Works', catalogued: 'catalogued',
    exposable: 'exhibitable', unpriced: 'unpriced', noImage: 'no image',
    thisYear: 'this year', wip: 'in production',
    consigned: 'on consignment', sold: 'sold',
    available: 'available', totalValue: 'total value',
    atStudio: 'at studio', onLoan: 'on loan',
    allWorks: 'All works', recentlyAdded: 'Recently added',
    byTechnique: 'By technique', bySupport: 'By support',
    byYear: 'By year', search: 'Search...',
    filter: 'Filter', reset: 'Reset',
    untitled: 'Untitled', newWork: 'New work',
    quickActions: 'Actions', openTasks: 'Open tasks',
    upcomingShipments: 'Upcoming shipments', activity: 'Activity',
    notes: 'Notes', seeAll: 'See all', close: 'Close',
    back: 'Back', details: 'Details', cancel: 'Cancel', delete: 'Delete',
    stage_idea: 'Idea', stage_sketch: 'Sketch', stage_wip: 'In progress',
    stage_drying: 'Drying', stage_framing: 'Framing',
    stage_shot: 'Photographed', stage_catalogued: 'Catalogued',
    constellation_intro: 'Map of the oeuvre. Horizontal axis: year. Vertical axis: technique. Select a region to curate a working group.',
    year: 'Year', technique: 'Technique', support: 'Support',
    theme: 'Theme', status: 'Status',
    allTech: 'All techniques', allSupports: 'All supports',
    allYears: 'All years', showEdges: 'Show edges',
    hideEdges: 'Hide edges', edgesBy: 'Edges by',
    selected: 'selected', clearSel: 'Clear', curate: 'Curate',
    workingGroups: 'Working groups', newGroup: 'New group',
    viewMode: 'View', listView: 'List', graphView: 'Constellation', gridView: 'Grid',
    workingGroup: 'Working group',
    exportChecklist: 'Export checklist (PDF)',
    exportPacket: 'Export press packet',
    privateLink: 'Private link', generateLink: 'Generate link',
    recipient: 'Recipient', expiresIn: 'Expires in',
    groupName: 'Group name', addToGroup: 'Add to group',
    removeFromGroup: 'Remove', shareWith: 'Share with',
    priceOnRequest: 'Price on request',
    loading: 'Loading...', loadingInventory: 'Loading inventory...',
    error: 'Error', empty: 'Empty', noSelection: 'No selection',
    clickToSelect: 'Click a work or drag a region to curate',
    title: 'Title', dimensions: 'Dimensions', presentation: 'Presentation',
    contact: 'Contact', price: 'Price', discount: 'Discount',
    framed: 'Framed', commission: 'Commission',
    returnDate: 'Return', deliveryDate: 'Delivery',
    addToSel: '+ Group', edit: 'Edit',
    surDemande: 'On request', atelier: 'Studio', localisation: 'Location',
    pipeline: 'Pipeline', map: 'Map', contacts: 'Contacts',
    reminders: 'Reminders', upcomingDeadlines: 'Upcoming deadlines',
    searchPlaceholderContacts: 'Search name, institution, city, email, notes...',
    allRoles: 'All roles', deleteSelected: 'Delete',
    confirmDeleteContacts: 'Permanently delete these contacts?',
    fiscal: 'Fiscal', expenses: 'Expenses', dashboard: 'Dashboard',
    income: 'Income', tax: 'Taxes', category: 'Category', amount: 'Amount',
    sales: 'Sales', revenue: 'Revenue', orders: 'Orders',
    newOrder: 'New order', buyer: 'Buyer',
    concepts: 'Concepts', themes: 'Themes / Groups', location: 'Location',
    tirage: 'Edition', exhibitable: 'Exhibitable', image: 'Image',
    searchFieldAll: 'All', searchFieldName: 'Name', searchFieldCity: 'City',
    searchFieldEmail: 'Email', searchFieldNotes: 'Notes',
    selection: 'SELECTION', modify: 'MODIFY', export: 'EXPORT',
    compare: 'COMPARE', groupNamePlaceholder: 'group name...', clear: 'CLEAR',
    legend: 'LEGEND', stage_mounting: 'To mount',
  },
}
