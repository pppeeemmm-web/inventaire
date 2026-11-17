import { buildCatalog } from './build'

/** English copy only (FR text where a key has no EN). In the production browser build this module is replaced by its JSON (next.config.ts). */
const en = buildCatalog('en')
export default en
