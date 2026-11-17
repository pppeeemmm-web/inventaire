/**
 * Webpack loader (production browser build only — see next.config.ts) for lib/i18n/catalog/{fr,en}.ts.
 * The catalog module imports every `defineMessages` module (FR + EN together) and the legacy fr/en dictionaries.
 * This loader runs that module at build time and emits only its result — one language as JSON — so the
 * browser chunk carries one language instead of both. The authoring format does not change.
 */
module.exports = function i18nCatalogLoader() {
  const callback = this.async()
  this.importModule(`${this.resourcePath}?i18n-catalog-eval`)
    .then((mod) => {
      const catalog = mod && mod.default
      if (!catalog || typeof catalog !== 'object' || Object.keys(catalog).length === 0) {
        throw new Error(`[i18n-catalog-loader] ${this.resourcePath}: empty catalog`)
      }
      callback(null, `export default JSON.parse(${JSON.stringify(JSON.stringify(catalog))})\n`)
    })
    .catch((err) => callback(err))
}
