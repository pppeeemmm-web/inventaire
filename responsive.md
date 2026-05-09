# Fix Landing Page Responsiveness

## Context
Landing page circle (min 300px) + orb padding (52px each side) + text = ~500px+ total width. On 375px screens, left/right orbs clip due to `overflow: hidden`. Top/bottom orbs can overlap header/footer on short screens.

## Strategy
Replace fixed px values with `clamp()` fluid scaling. No @media breakpoints — smooth scaling, minimal code, same aesthetic.

## Changes — `app/page.tsx` style block only

### Circle
```css
.circle-wrap { width: clamp(160px, 38vmin, 520px); height: clamp(160px, 38vmin, 520px); }
```

### Orbs (base)
```css
.orb { font-size: clamp(8px, 1.4vmin, 10px); letter-spacing: clamp(1.5px, 0.4vmin, 3px); gap: clamp(4px, 1.2vmin, 10px); }
```

### Orb positions
```css
.orb-top    { padding-bottom: clamp(20px, 6vh, 52px); }
.orb-top::after    { height: clamp(14px, 3vmin, 28px); }
.orb-bottom { padding-top: clamp(20px, 6vh, 52px); }
.orb-bottom::after { height: clamp(14px, 3vmin, 28px); }
.orb-left   { padding-right: clamp(20px, 6vw, 52px); }
.orb-left::after   { width: clamp(14px, 3vmin, 28px); }
.orb-right  { padding-left: clamp(20px, 6vw, 52px); }
.orb-right::after  { width: clamp(14px, 3vmin, 28px); }
```

### Header elements
```css
.wordmark { top: clamp(12px, 3vh, 28px); left: clamp(12px, 3vw, 32px); font-size: clamp(7px, 1.3vmin, 9px); letter-spacing: clamp(1.5px, 0.4vmin, 3px); }
.lang-toggle { top: clamp(10px, 2.8vh, 24px); right: clamp(12px, 3vw, 32px); font-size: clamp(7px, 1.3vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); }
```

### Hub link (inline style → clamp strings)
```
bottom: 'clamp(10px, 3vh, 32px)', right: 'clamp(12px, 4vw, 40px)', fontSize: 'clamp(7px, 1.3vmin, 9px)'
```

## Space budget at 320px (iPhone SE)
- Circle: 160px (min clamp)
- Left orb: text(~36px) + gap(4px) + line(14px) + pad(20px) = 74px
- Right orb: same 74px
- Total: 74 + 160 + 74 = **308px** < 320px

## Verification
1. `npm run dev` → open localhost:3000
2. DevTools responsive mode: test 320px, 375px, 414px, 768px, 1024px widths
3. Check: no horizontal overflow, all 4 orbs visible, no overlap with header/footer
4. Check: desktop still looks identical to current (clamp maxes = current values)