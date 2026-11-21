# Survey 5 — the map of links and the digests (draft, 2026-11-21)

Status: **local draft**. Run early at Pem's request; to be re-read when the map has enough links to design on. Question: how are links suggested and accepted, and how are digests of a map written, in proven systems. Made from two web searches (sources at the end — research papers and patents; **nothing found on note-taking tools specifically**) plus general knowledge, set against the hub's schema and `ARCHITECTURE.md` §8. Not read: `CONSTELLATION.md`, the Constellation screen.

## 1. Suggesting links

| Practice | Source | The hub today | Verdict |
|---|---|---|---|
| **A suggestion is shown with its reason and its confidence; a person accepts or rejects; rejected ones never enter the graph** | Entity-linking literature (CleanGraph; patents) | Journal → work / idea: exactly this (`journal_entry_link`: `proposed_by`, `validated_at`, `rejected_at`), tuned on Pem's 17 accepted / 18 rejected | **Already at the state of the art** for the journal |
| The same for object ↔ object | — | `tblrelations` has type, strength, description — **no « proposed by », no accepted / rejected, no author** | **Gap**: work ↔ work suggestions cannot be stored as proposals as the table stands; a hand-made link and a machine copy look alike (the master plan counts 52 human links out of 3,772 by their type) |
| **Similarity ranks candidates; it does not decide** — near vectors are candidates only | Patents on embedding suggestions | `match_nodes`, cosine threshold + a correction for « hub » items | Covered |
| **Suggest the kind of relation only from a short, same-family list; hold back while the data is thin** | LEC-KG (2026) | Seven link types for works (painted on, derived from, answers, series, diptych, influence, proximity) | Take: the machine proposes « these two belong together » and Pem picks the type, at least at first |
| Names and titles are poorly served by meaning vectors; match them as text too | Search-suggestion patent | `#1234` parsing only | Same finding as survey 2: add plain title matching |
| Keep what was rejected, so it is not proposed again | General practice | Done for journal links (nothing deleted) | Take for work ↔ work |

## 2. Digests of a map

The proven method (Microsoft's GraphRAG, 2024): build the graph → **detect communities** (clusters, with an algorithm such as Leiden; clusters inside clusters) → an AI writes a **summary per cluster**, higher levels summarising the lower ones → questions about the whole are answered from the summaries.

| Step | The hub |
|---|---|
| Graph | `nodes` + `tblrelations` (and the `edge_fact` view) — exists |
| Communities | None computed. Themes and groups are human clusters; the map has no automatic ones |
| Summary per cluster | None; `ai_job` with accept / reject exists as the vehicle |
| Local AI | Ollama on the PC — **no source found testing this method with small local models**; quality is the open question |

**Cautions:** a digest of a graph that is 98 % automatic copies (themes, owners, places) will describe the filing system, not the work. The digests are only worth what the human links are worth — the master plan's order (links first, digests after) is right. A 2025 paper (« GraphRAG under Fire ») examines the method's weaknesses; not read.

**The cheap first digest needs no clustering:** one per theme and one per idea — the clusters Pem already made — with « before → suggested » acceptance. Automatic communities come later, when hand-made links exist to find them in.

## 3. What to take — when the map is designed

1. Give work ↔ work links the same proposal life as journal links (who proposed, accepted, rejected, when) — and an author on every link, so human and machine are told apart by fact, not by type.
2. The machine proposes pairs; Pem names the relation.
3. Digests: start from Pem's own clusters (themes, ideas); automatic communities later.
4. Test the local model on five real clusters before building anything around it.

## Sources

- Human-in-the-loop graph refinement — https://arxiv.org/html/2405.03932v2 · https://arxiv.org/pdf/2602.02090
- Embedding-based suggestions — https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11307881 · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12596933
- GraphRAG — https://arxiv.org/pdf/2404.16130 · https://neo4j.com/blog/developer/global-graphrag-neo4j-langchain/ · https://arxiv.org/pdf/2501.14050 (critique, not read)
