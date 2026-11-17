import { buildCatalog } from './build'

/** French copy only. In the production browser build this module is replaced by its JSON (next.config.ts). */
const fr = buildCatalog('fr')
export default fr
