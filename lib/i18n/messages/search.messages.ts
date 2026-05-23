import { defineMessages } from '../message-core'

export const searchMessages = defineMessages({
  search_semantic_group: {
    fr: 'Recherche sémantique',
    en: 'Semantic search',
  },
  search_semantic_unavailable: {
    fr: 'Recherche sémantique indisponible (Qdrant non configuré)',
    en: 'Semantic search unavailable (Qdrant not configured)',
  },
  search_semantic_pending: {
    fr: 'Indexation en cours — réessayez dans un instant',
    en: 'Indexing in progress — try again shortly',
  },
  search_semantic_loading: {
    fr: 'Recherche…',
    en: 'Searching…',
  },
  embedding_status_pending: {
    fr: 'Embedding en attente',
    en: 'Embedding pending',
  },
})
