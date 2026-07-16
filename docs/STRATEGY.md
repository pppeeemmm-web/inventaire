# Strategy — owner intent (living document)

**Status: SKELETON — content to be filled in a dedicated owner exchange (planned 2026-07). Until then, treat every section as unanswered, not as "no".**

Purpose: the filter for all new work. A request that serves none of the goals below — or touches a non-goal — gets parked, not built. Companion to the [request protocol](../CLAUDE.md) (bug / lived friction / idea triage).

## 1. What this system is for (owner's words)

_À remplir : la mission en 2-3 phrases. Ex. : « registre d'atelier fiable + terminal de terrain + vitrine — pour un artiste seul avec une petite équipe occasionnelle »._

## 2. Long-term goals (ranked)

_À remplir. Candidats évoqués à valider/ordonner : fiabilité du registre (aucune donnée perdue, traçabilité), fluidité du flux terrain (capture → journal → œuvre en minutes), diffusion (site public, portfolio, broadcast), scalabilité (catalogue qui grandit sans refonte)._

## 3. Potentials under consideration (not commitments)

_À remplir : pistes envisagées (ex. F2–F10 du TODO, OCR élargi, e-mail transactionnel, ventes en ligne ?, multi-artistes ?) avec pour chacune : quel problème réel elle résoudrait, et quel signal déclencherait un GO._

## 4. Non-goals (explicit refusals)

_À remplir. Déjà actés ailleurs : pas de background queues / OCR élargi / e-mail transactionnel sans GO (CLAUDE.md) ; pas de polish spéculatif sans friction vécue ×2 ; `NeedsPhotograph` reste un gate qualité manuel._

## 5. Scalability assumptions

_À remplir : ordres de grandeur cibles (nb d'œuvres, images, utilisateurs, sessions/mois) pour dimensionner sans sur-construire._

## 6. Decision log (strategy-level only)

- 2026-07-15 — `NeedsPhotograph` = manual quality gate, never auto-cleared by any image add (phone photos are journal references, not diffusion-grade).
- 2026-07-15 — Lightroom in-app UI removed; canonical mobile flow = capture in Lightroom → export → library picker → new/existing item.
- 2026-07-16 — Changes gated on lived friction (≥2×) from real usage; problem-statements over prescribed solutions; batch fixes.
