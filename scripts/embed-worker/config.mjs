export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL?.trim() || 'nomic-embed-text'
export const EMBEDDING_VECTOR_SIZE = 768
export const QDRANT_COLLECTION = process.env.EMBEDDING_COLLECTION?.trim() || 'pem_universe'
export const BATCH_SIZE = 32
export const STUCK_EMBEDDING_MINUTES = 10
export const MAX_EMBEDDING_ATTEMPTS = 5
