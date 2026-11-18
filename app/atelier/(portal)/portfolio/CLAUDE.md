# Portfolio PDF (loaded when working here; root CLAUDE.md still applies)

- Engine: `pdf-action.ts` → `generatePortfolioPdf(opts)`. The server action loads R2 config + public works; no client data prep.
- Section source priority: `raw.sections`, then `raw.works_modes[0].collections`, then `raw.works_collections`, else `__all__`.
- Work order: `manual_work_order[]` first, then theme residual.
- Cover = first loaded image; excluded from the work pages.
- Pdfkit: never an 8-char alpha hex. Use `fillOpacity(N).fill('#RRGGBB').fillOpacity(1)`. Text without `height` can auto-page; refill the background.
