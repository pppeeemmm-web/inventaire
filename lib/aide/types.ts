/**
 * In-app Aide (help) — owner GO 2026-11-18. Two guides (team, admin), FR + EN, one chapter = one markdown string.
 * Markdown subset read by `AideMarkdown`: ## / ### headings, paragraphs, « - » and « 1. » lists, « > » notes,
 * **bold**, [label](/internal/path). No HTML, no external links.
 *
 * `verified`: the day the chapter was checked against the live app (YYYY-MM-DD). Touch the feature → re-check + re-stamp.
 */
export type AideChapter = {
  id: string
  title: string
  verified: string
  md: string
}

export type AideGuideId = 'team' | 'admin'
