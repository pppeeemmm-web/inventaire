/**
 * Collector kit page `/c/[token]` (TODO 11b) — light gallery look, one work per screen on the phone,
 * sticky « Écrire à l'atelier » + « PDF » bar. Shared with Playwright (`tests/private-link-layout.spec.ts`) — keep in sync.
 */
export const PRIVATE_LINK_SELECTION_CSS = `
:root:has(.ck-root) { scroll-snap-type: y proximity; }
.ck-root {
  --ck-bg: #f6f4ef; --ck-tx: #1a1816; --ck-tx2: #5c5852; --ck-tx3: #8a8680; --ck-bd: #e0dcd3; --ck-ac: #8a6d3b;
  --ck-ok: #4f7a4a; --ck-serif: var(--font-instrument-next, 'Instrument Serif'), Didot, Georgia, serif;
  min-height: 100dvh;
  background: var(--ck-bg);
  color: var(--ck-tx);
  font-family: var(--font-sofia-next, 'Sofia Sans'), ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.4;
  overflow-x: hidden;
  padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
}
.ck-wrap {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px));
  box-sizing: border-box;
}
.ck-top { display: flex; justify-content: flex-end; gap: 4px; padding-top: max(10px, env(safe-area-inset-top, 0px)); }
.ck-top a { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: var(--ck-tx3); text-decoration: none; letter-spacing: .06em; }
.ck-top a[aria-current="true"] { color: var(--ck-tx); font-weight: 600; }
.ck-hdr { padding: 4px 0 20px; border-bottom: 1px solid var(--ck-bd); scroll-snap-align: start; }
.ck-eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ck-tx3); font-weight: 600; }
.ck-h1 { font-family: var(--ck-serif); font-weight: 400; font-size: 32px; line-height: 1.1; margin: 8px 0 4px; overflow-wrap: anywhere; }
.ck-msg { font-family: var(--ck-serif); font-style: italic; font-size: 18px; color: var(--ck-tx2); margin: 12px 0 0; white-space: pre-line; overflow-wrap: anywhere; }
.ck-valid { font-size: 12px; color: var(--ck-tx3); margin-top: 10px; }
.ck-works { display: flex; flex-direction: column; }
.ck-work {
  display: flex; flex-direction: column; justify-content: flex-start; gap: 14px;
  min-height: calc(100svh - 76px - env(safe-area-inset-bottom, 0px));
  padding: 20px 0; box-sizing: border-box; border-bottom: 1px solid var(--ck-bd);
  scroll-snap-align: start;
}
.ck-img-btn { display: block; width: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; }
.ck-img { display: block; width: 100%; max-height: 62svh; object-fit: contain; }
.ck-img-ph { width: 100%; aspect-ratio: 4 / 5; max-height: 62svh; background: var(--ck-bd); }
.ck-meta { min-width: 0; }
.ck-h2 { font-family: var(--ck-serif); font-weight: 400; font-size: 24px; margin: 0 0 4px; overflow-wrap: anywhere; }
.ck-line { font-size: 13px; color: var(--ck-tx2); }
.ck-price { font-size: 16px; margin-top: 8px; }
.ck-price small { font-size: 11px; color: var(--ck-tx3); margin-left: 6px; }
.ck-price-req { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ck-tx3); margin-top: 8px; }
.ck-avail { display: inline-block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; font-weight: 600; margin-top: 8px; color: var(--ck-ok); }
.ck-avail--reserved { color: var(--ck-ac); }
.ck-avail--sold, .ck-avail--unavailable { color: var(--ck-tx3); }
.ck-work--gone .ck-img, .ck-work--gone .ck-img-ph { opacity: .45; filter: grayscale(1); }
.ck-work--gone .ck-h2 { color: var(--ck-tx3); }
.ck-btn {
  min-height: 44px; padding: 0 16px; border: 1px solid var(--ck-tx); border-radius: 3px; background: none; color: var(--ck-tx);
  font: inherit; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  text-decoration: none; cursor: pointer; box-sizing: border-box;
}
.ck-btn:disabled { opacity: .5; cursor: default; }
.ck-btn--fill { background: var(--ck-tx); color: var(--ck-bg); }
.ck-btn--ghost { border-color: var(--ck-bd); }
.ck-btn--wide { width: 100%; margin-top: 14px; }
.ck-foot { font-size: 11px; color: var(--ck-tx3); padding: 20px 0 28px; display: flex; flex-direction: column; gap: 6px; scroll-snap-align: start; }
.ck-foot a { color: var(--ck-tx2); }
.ck-empty { padding: 48px 0; color: var(--ck-tx2); }
.ck-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  background: var(--ck-bg); border-top: 1px solid var(--ck-bd);
  padding: 12px max(16px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
}
.ck-bar-in { max-width: 1080px; margin: 0 auto; display: flex; gap: 10px; }
.ck-bar-in .ck-btn--fill { flex: 1; }
.ck-dim { position: fixed; inset: 0; z-index: 30; background: rgba(20, 18, 16, .45); display: flex; align-items: flex-end; justify-content: center; }
.ck-sheet {
  width: 100%; max-width: 560px; max-height: 92dvh; overflow-y: auto; box-sizing: border-box;
  background: var(--ck-bg); color: var(--ck-tx); border-radius: 16px 16px 0 0;
  padding: 16px max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  box-shadow: 0 -10px 40px rgba(0, 0, 0, .25);
}
.ck-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--ck-bd); margin: 0 auto 12px; }
.ck-h3 { font-family: var(--ck-serif); font-weight: 400; font-size: 22px; margin: 0 0 10px; }
.ck-label { font-size: 12px; color: var(--ck-tx3); margin: 12px 0 6px; display: block; }
.ck-pick { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; cursor: pointer; }
.ck-pick input { width: 20px; height: 20px; accent-color: var(--ck-tx); flex: none; }
.ck-input, .ck-ta {
  width: 100%; box-sizing: border-box; border: 1px solid var(--ck-bd); border-radius: 4px; background: #fff; color: var(--ck-tx);
  font: inherit; font-size: 16px; padding: 10px;
}
.ck-input { min-height: 44px; }
.ck-ta { min-height: 110px; resize: vertical; }
.ck-row { display: flex; gap: 10px; margin-top: 14px; }
.ck-row .ck-btn--fill { flex: 1; }
.ck-note { font-size: 13px; margin-top: 10px; color: var(--ck-tx2); }
.ck-note--err { color: #a33a2a; }
.ck-zoom { position: fixed; inset: 0; z-index: 40; background: #0c0b0a; display: flex; align-items: center; justify-content: center; cursor: zoom-out; padding: 0; border: 0; width: 100%; }
.ck-zoom img { max-width: 100%; max-height: 100dvh; object-fit: contain; touch-action: pinch-zoom; }
.ck-center { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 14px; padding: 24px; box-sizing: border-box; }
@media (min-width: 768px) {
  .ck-sheet { border-radius: 12px; margin-bottom: 8vh; }
  .ck-dim { align-items: center; }
  .ck-work { display: grid; grid-template-columns: minmax(0, 3fr) minmax(240px, 2fr); gap: 48px; align-items: center; min-height: 0; padding: 48px 0; }
  .ck-img { max-height: 78vh; }
  .ck-h1 { font-size: 40px; }
  .ck-hdr { padding: 12px 0 32px; }
  .ck-bar-in { justify-content: flex-end; }
  .ck-bar-in .ck-btn--fill { flex: 0 0 auto; padding: 0 32px; }
}
`.trim()
