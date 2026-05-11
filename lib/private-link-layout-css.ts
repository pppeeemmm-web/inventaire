/** Shared with `/c/[token]` and Playwright — keep in sync. */
export const PRIVATE_LINK_SELECTION_CSS = `
.pl-root {
  min-height: 100vh;
  background: var(--bg0);
  color: var(--tx);
  padding: 48px 40px;
  padding-left: max(40px, env(safe-area-inset-left, 0px));
  padding-right: max(40px, env(safe-area-inset-right, 0px));
  box-sizing: border-box;
  overflow-x: hidden;
}
.pl-header { margin-bottom: 48px; border-bottom: 1px solid var(--bd); padding-bottom: 24px; }
.pl-works { display: flex; flex-direction: column; gap: 48px; }
.pl-row {
  display: grid;
  grid-template-columns: min(420px, 100%) 1fr;
  gap: 40px;
  align-items: start;
}
.pl-thumb {
  height: 420px;
  position: relative;
  width: 100%;
  max-width: 420px;
}
.pl-meta { padding-top: 8px; min-width: 0; }
.pl-footer { margin-top: 80px; border-top: 1px solid var(--bd); padding-top: 24px; color: var(--tx3); font-size: 10px; letter-spacing: 1px; }
@media (max-width: 767px) {
  .pl-root {
    padding: 24px 16px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
    padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
  }
  .pl-header { margin-bottom: 32px; }
  .pl-works { gap: 32px; }
  .pl-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .pl-thumb {
    height: auto;
    aspect-ratio: 1;
    max-height: min(85vw, 420px);
    max-width: min(100%, 420px);
    margin-inline: auto;
  }
  .pl-footer { margin-top: 48px; }
}
`.trim()
