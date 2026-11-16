import { defineMessages } from '../message-core'

/** Constellation: undo, marquee, arrow tool, how-to (TODO 20, Pem 2026-11-15). */
export const constellationToolsMessages = defineMessages({
  ct_undo: { fr: 'Annuler (Ctrl/Cmd+Z)', en: 'Undo (Ctrl/Cmd+Z)' },
  ct_redo: { fr: 'Rétablir (Ctrl+Maj+Z / Ctrl+Y)', en: 'Redo (Ctrl+Shift+Z / Ctrl+Y)' },
  ct_tool_arrow: { fr: 'Flèche (à main levée)', en: 'Arrow (freehand)' },
  ct_shortcuts_undo: {
    fr: 'Ctrl/Cmd+Z : annuler · Ctrl+Maj+Z ou Ctrl+Y : rétablir.',
    en: 'Ctrl/Cmd+Z: undo · Ctrl+Shift+Z or Ctrl+Y: redo.',
  },
  ct_select_hint: {
    fr: 'Maj+clic : ajouter ou retirer de la sélection. Maj+glisser sur le vide (ou outil ⬛) : rectangle de sélection.',
    en: 'Shift+click: add to or remove from the selection. Shift+drag on empty space (or the ⬛ tool): selection rectangle.',
  },
  ct_add_all_cap: {
    fr: '120 œuvres au plus, exprès : le canevas reste lisible et les vignettes se chargent 20 par 20.',
    en: '120 works at most, on purpose: the canvas stays readable and thumbnails load 20 at a time.',
  },
  ct_howto_title: { fr: 'Mode d’emploi', en: 'How to' },
  ct_howto_works: { fr: 'Œuvres', en: 'Works' },
  ct_howto_open: { fr: 'Double-clic sur une œuvre : l’ouvrir.', en: 'Double-click a work: open it.' },
  ct_howto_click: {
    fr: 'Clic : aperçu dans ce panneau. Maj+clic : ajouter ou retirer de la sélection.',
    en: 'Click: preview in this panel. Shift+click: add to or remove from the selection.',
  },
  ct_howto_drag: {
    fr: 'Glisser une œuvre : la déplacer — toute la sélection suit si l’œuvre en fait partie.',
    en: 'Drag a work: move it — the whole selection follows if the work is part of it.',
  },
  ct_howto_marquee: {
    fr: 'Maj+glisser sur le vide, ou outil ⬛ : rectangle de sélection (pointillés qui défilent). Maj garde la sélection en cours.',
    en: 'Shift+drag on empty space, or the ⬛ tool: selection rectangle (marching ants). Shift keeps the current selection.',
  },
  ct_howto_right: {
    fr: 'Clic droit sur une œuvre : la retirer du canevas, du thème ou du groupe affiché. Ctrl+clic droit : l’ouvrir.',
    en: 'Right-click a work: remove it from the canvas, theme or group shown. Ctrl+right-click: open it.',
  },
  ct_howto_view: { fr: 'Vue', en: 'View' },
  ct_howto_pan: {
    fr: 'Glisser sur le vide : déplacer la vue. Espace maintenu : déplacer la vue avec n’importe quel outil. Molette : zoom.',
    en: 'Drag on empty space: pan. Hold Space: pan with any tool. Wheel: zoom.',
  },
  ct_howto_links: { fr: 'Liens', en: 'Links' },
  ct_howto_link_make: {
    fr: 'Glisser depuis le bord d’une œuvre (l’anneau) jusqu’à une autre : crée un lien du type choisi dans la barre. Clic droit sur un lien : le supprimer.',
    en: 'Drag from the edge of a work (the ring) to another: makes a link of the type picked in the bar. Right-click a link: delete it.',
  },
  ct_howto_link_influence: { fr: 'une œuvre en a nourri une autre.', en: 'one work fed another.' },
  ct_howto_link_proximity: {
    fr: 'parentes par le sujet, la forme ou le moment.',
    en: 'related by subject, form or moment.',
  },
  ct_howto_link_series: { fr: 'de la même série.', en: 'from the same series.' },
  ct_howto_link_diptych: { fr: 'faites pour être vues ensemble.', en: 'made to be seen together.' },
  ct_howto_link_directed_label: {
    fr: 'Peinte sur · Dérivée de · Répond à',
    en: 'Painted on · Derived from · Answers',
  },
  ct_howto_link_directed: {
    fr: 'liens fléchés, posés depuis l’onglet Liens de l’œuvre ; la flèche pointe vers l’œuvre la plus récente.',
    en: 'arrowed links, set from the work’s Links tab; the arrow points at the newer work.',
  },
  ct_howto_draw: { fr: 'Dessin', en: 'Drawing' },
  ct_howto_tools: {
    fr: 'Crayon, trait, flèche, texte : notes posées sur le canevas (couleur et épaisseur dans la barre d’outils). Elles ne touchent pas aux liens des œuvres.',
    en: 'Pencil, line, arrow, text: notes on the canvas (colour and width in the tool bar). They never touch the works’ links.',
  },
  ct_howto_erase: {
    fr: 'Gomme : un clic efface un objet entier — le dessin ou texte du dessus, sinon le lien sous le curseur.',
    en: 'Eraser: one click removes one whole object — the topmost drawing or text, else the link under the cursor.',
  },
  ct_howto_undo: {
    fr: 'Ctrl/Cmd+Z ou ↶ : annuler (dessins, textes, déplacements, liens). Ctrl+Maj+Z, Ctrl+Y ou ↷ : rétablir.',
    en: 'Ctrl/Cmd+Z or ↶: undo (drawings, text, moves, links). Ctrl+Shift+Z, Ctrl+Y or ↷: redo.',
  },
})
