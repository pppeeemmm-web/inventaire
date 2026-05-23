import { defineMessages } from '../message-core'

export const searchMessages = defineMessages({
  search_semantic_group: {
    fr: 'Recherche sémantique',
    en: 'Semantic search',
  },
  search_semantic_unavailable: {
    fr: 'Recherche sémantique indisponible (Ollama / Qdrant)',
    en: 'Semantic search unavailable (Ollama / Qdrant)',
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
