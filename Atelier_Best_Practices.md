# Atelier Data Integrity: Best Practices & Guidelines

To maintain the leverage and professionalism of the studio hub, all data input must follow these high-fidelity standards. This ensures the "Constellation" remains accurate and the exports (PDFs/Web) remain museum-grade.

---

## 1. Naming & Typography
*   **Global Capitalization**: All proper nouns (Titles, Names, Institutions) must use **Title Case**. 
    *   *Correct*: `CoG 2026`, `Pierre Emmanuel Moulin`, `Galerie Maeght`.
    *   *Avoid*: `cog 2026`, `pierre emmanuel moulin`, `GALERIE MAEGHT`.
*   **Titles**: Artwork titles should be kept concise. Do not include dates or medium in the title field—use the dedicated fields instead.
*   **Dimensions**: Always input as `Height × Width × Depth` in cm. Use the standard multiplication sign `×` rather than the letter `x`.

## 2. Imagery & Assets
*   **Format**: Use **.avif** or **.webp** for web-optimized thumbnails.
*   **Standard Filename**: `W_{OeuvreID}_{Date}_{Photographer}.avif`
*   **Flat-Fielding**: All new photography should be flat-field corrected before upload to eliminate lighting hotspots.
*   **The "Needs Photograph" Flag**: If a work is cataloged but not yet shot, ensure the "Needs Photograph" toggle is **ON** in the Work Drawer. This triggers the correct color-coding in the inventory.

## 3. The Production Pipeline (Kanban)
*   **No "Ghost" Projects**: Every project in the pipeline must be linked to either a **Concept** or an **Oeuvre**. 
*   **Stage Definitions**:
    *   `Idée`: Raw concept, no physical start.
    *   `En cours`: Active work on the support.
    *   `Séchage`: Work is physically finished but not handleable.
    *   `Catalogué`: Full metadata + photography completed. 
*   **Status Sync**: Once a work is marked `Catalogué` in the pipeline, it should move automatically to `Disponible` in the inventory.

## 4. Fiscal & Expenses
*   **Transaction Integrity**: The `Date` of an expense must be the date on the receipt, not the date of input.
*   **Fiscal Year**: Always ensure the `Fiscal Year` tag matches the transaction date. If importing digital dockets, verify the auto-tagging.
*   **Supplier Links**: Always link expenses to a known **Supplier** in the Contacts database to enable cost-per-project reporting.

## 5. Stock & Inventory Audit
*   **Monthly Ritual**: A physical stock-take should be performed on the last Friday of every month.
*   **Discrepancy Reporting**: Use the **Stock-take** tab to record physical counts. Any discrepancy > 5% should be logged in the **System Ledger** as a maintenance task.

## 6. Suggestions & Improvements
*   **Log it, don't ignore it**: If the system feels slow or a button is confusing, log it as a **💡 Suggestion** in the **System Tab**. 
*   **Status Codes**: 
    *   `Requested`: A new idea.
    *   `Active`: I am currently building it.
    *   `Completed`: Live and pushed to GitHub.

---
> [!IMPORTANT]
> The leverage of the Atelier Hub comes from the "interconnectedness" of the data. Never leave a field blank if the information is available—a partially filled database is a liability, not an asset.
