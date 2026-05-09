# AdaptArxiv — Design System

> Adapted from the Structured Money visual language. **Classical-editorial · monochrome-warm · motion-rich.**
>
> Built for AdaptArxiv — a research-paper-adjacent product where the editorial aesthetic does the same work a "trustworthy science" badge would do clumsily. The classical direction (typographic gravitas, considered motion, painterly imagery) signals *permanence* and *rigor* — the same qualities that make academic publishing visually distinct from SaaS.

---

## 1. Design philosophy

A black-first UI carried by a single warm-beige neutral, with a high-contrast display serif italicizing one word at a time inside otherwise uppercase headlines. Everything functional uses a quiet sans. There is no accent color — secondary chroma comes from painterly imagery, not from UI controls.

Three principles:

1. **Quiet UI, loud typography.** The interface itself recedes. Type does the talking.
2. **Geometric ornament over decoration.** Polygonal SVG button shapes, thin frames, circular image clips, large wordmarks-as-graphic — all ornament is structural.
3. **Cinematic, not snappy.** Reveals are slow (0.6s–3s, expo easing), parallax is deliberate. Motion conveys gravitas, not delight.

---

## 2. Color

### 2.1 Core tokens

```
--color-black:           #000000   /* primary surface, body text on light, CTA bg */
--color-primary:         #000000   /* alias for black */
--color-white:           #FFFFFF   /* hover/active states only */
--color-secondary:       #E7E5E4   /* warm off-white */
--color-base-foreground: #F5F5F4   /* paper white */
--color-dust:            #EBEBEB   /* footer / "made liquid" panel bg */
--color-linen:           #DFDCD5   /* fine ornaments at 40% opacity, button text */
--color-ghost:           #DFDCD5   /* button label color on dark */
--color-grey:            #C4C3B6   /* THE accent — heading color on black, partner logos */
--color-light-grey:      #7E7D75
--color-dark-grey:       #595855   /* borders, slider pills, ornament strokes, muted text */
--color-muted-foreground:#A3A3A3
```

The signature pairing is **`#000` background + `#C4C3B6` text** with `#595855` for borders and `#DFDCD5` for soft fills. Do not introduce a fourth UI hue.

### 2.2 Illustration / imagery palette (off-UI)

These never apply to controls or text — only to parallax art layers, painterly backgrounds, generative ornaments.

```
Olive landscape:      #686B25
Deep olive shadow:    #333B18
Antique gold / stone: #B49759
Warm stone:           #BDB7A0
Mist / sky:           #C7D8D0
Cloud grey:           #B8B7A8

/* Manuscript-specific extension */
Cream parchment:      #E8D9A8
Aged binding:         #8B6F3D
Deep umber:           #3A2818
Page shadow:          #2A1F12
```

### 2.3 What never goes in the palette

No bright Bitcoin orange, no neon cyan/green, no fintech teal, no SaaS purple-blue gradient, no glassmorphism tints. Brand-specific accent color (if AdaptArxiv needs one for a single moment — say, a status pill) should be `#000` on `#C4C3B6` or vice versa, not a hue.

---

## 3. Typography

### 3.1 Two families, two roles

| Variable        | Family             | Role                                                                          |
| --------------- | ------------------ | ----------------------------------------------------------------------------- |
| `--font-serif`  | **Davinci** (TRJN) | Display only — H1, H2, H3, hero wordmarks. Weights 400, 400 italic, 500.      |
| `--font-sans`   | **Inter**          | Body, buttons, labels, nav, captions. Weight 400 (and 500 for emphasis only). |
| `--font-mono`   | system mono        | Code/data only. Avoid in marketing.                                           |

Davinci is self-hosted from `/fonts/`. The `font-family` declared in `@font-face` must be `Davinci` (not `TRJN-DaVinci`) — it's what the variable references directly.

```css
@font-face {
  font-family: "Davinci";
  src: url("/fonts/TRJN-DaVinci-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Davinci";
  src: url("/fonts/TRJN-DaVinci-Italic.woff2") format("woff2");
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: "Davinci";
  src: url("/fonts/TRJN-DaVinci-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
```

**Always preload all three weights** in `<head>`:

```html
<link rel="preload" href="/fonts/TRJN-DaVinci-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/TRJN-DaVinci-Italic.woff2"  as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/TRJN-DaVinci-Medium.woff2"  as="font" type="font/woff2" crossorigin>
```

Inter is loaded via `next/font` or `@fontsource/inter`. Enable stylistic sets `ss01` and `cv11` for the closest match to Helvetica Now's neutral grotesque feel:

```css
body {
  font-family: var(--font-sans);
  font-feature-settings: "ss01", "cv11";
}
```

### 3.2 Fluid type scale (clamp-based)

| Token              | Min → Max     | Usage                                                          |
| ------------------ | ------------- | -------------------------------------------------------------- |
| `text-heading-xxl` | 145 → 400 px  | Single hero wordmark only (the AdaptArxiv footer treatment)    |
| `text-heading-xl`  | 45 → 94 px    | Section H2s                                                    |
| `text-heading-lg`  | 46 → 52 px    | Sub-section H2s                                                |
| `text-heading-lg-s`| 36 → 52 px    | Card titles in feature grids                                   |
| `text-heading-md`  | 30 → 34 px    | H3s, intro panel titles                                        |
| `text-heading-sm`  | 24 → 27 px    | H4s                                                            |
| `text-heading-xs`  | 19 → 21 px    | H5s                                                            |
| `text-body`        | 15 px (fixed) | Default body, button label                                     |
| `text-body-sm`     | 12 → 15 px    | Captions, meta                                                 |
| `text-link`        | 12 px (fixed) | Nav, footer links                                              |
| `text-small`       | 9 px          | Legal, microcopy                                               |

All headings: `letter-spacing: -0.03rem`, `line-height: 1` (tight). Body: `line-height: 1.25`.

### 3.3 Heading treatment rules

- **Default heading state is uppercase.** Apply via `text-transform: uppercase`, not by typing in caps.
- **Italicize one conceptual word per heading** with `<em>`. The italic word stays in its case; surrounding caps are unaffected. Class: `c-italic-no-uppercase` on the wrapper, `<em>` on the word.
  ```html
  <h2 class="c-heading-xl c-italic-no-uppercase">
    Real research, <em>structured</em>
  </h2>
  ```
- **Headlines stay short**: 2–5 words.
- **Centered alignment** for hero and section titles. **Left-aligned** only inside cards and editorial blocks.
- Never use bold display weight; the serif's contrast is the emphasis. Reserve weight 500 (medium) for card headings only.

---

## 4. Layout & grid

### 4.1 Grid

```
Mobile (< 1024px):  4 columns,  16px edge,  20px gutter
Desktop (≥ 1024px): 12 columns, 16px edge,  20px gutter
```

Single hard breakpoint at `1024px`. Tailwind-style prefixes: `m:` (medium = ≥640px), `l:` (large = ≥1024px). Additional fluid breakpoint at `--breakpoint-sm: 40rem` (640px).

### 4.2 Section heights

| Section              | Height                           |
| -------------------- | -------------------------------- |
| Hero (top)           | `90dvh` desktop / `85dvh` mobile |
| Sticky storytelling  | `100vh` per panel                |
| Feature grid         | content-driven, ~448px card aspect |
| Footer wordmark      | `100vh` (signature scroll moment)|

### 4.3 Card aspect ratios (lock these)

| Card type            | Ratio       |
| -------------------- | ----------- |
| Feature/expand card  | `459 / 448` |
| Use-case card        | `458 / 545` |
| Intro sticky card    | `458 / 474` |

### 4.4 Content widths

Body copy maxes at `240–360px`. Headlines max at `300–500px`. Wide content (data tables, code) gets the full grid. Never set a `max-width: 1440px` container — let edge padding (`16px`) and grid columns do the work.

---

## 5. Spacing & radius

### 5.1 Border radius

| Element              | Radius                                                          |
| -------------------- | --------------------------------------------------------------- |
| Section container    | `10px`, animates → `0px` on scroll-in                           |
| Card                 | `10px`                                                          |
| Intro black panel    | `9px`                                                           |
| Button wrapper       | `4px` (label inside SVG end-caps; visible shape is SVG-driven)  |
| Slider pills         | `2px`                                                           |

```
--radius-sm:  0.25rem   /* 4px  */
--radius-xl:  0.75rem   /* 12px */
--radius-2xl: 1rem      /* 16px */
```

### 5.2 Strokes

- `1px` for inner ornament, fine dividers (use `#595855` at 100% or `#DFDCD5` at 40%).
- `2px` for card outlines (`#595855`).
- Never use `0.5px` hairlines — they vanish on standard displays.

---

## 6. Components

### 6.1 Header

- Fixed, transparent on initial load; on scroll-past-hero, switches to `#000` bg with `1px` bottom border in `#595855`.
- Left: monogram logo (30×31 SVG, `currentColor` fill).
- Right: a single utility link. No multi-item nav.
- Header items animate in via `translateX(±30px) + opacity 0 → 1` over `0.5s`.
- Padding: `16px` vertical, grid-edge horizontal.

### 6.2 Buttons

The CTA is a label flanked by two SVG hexagonal end-caps, forming an angular gem/capsule shape — not a rounded rectangle.

```css
:root {
  --button-height:           40px;
  --button-min-width:        95px;
  --button-radius:           4px;
  --button-font-size:        15px;
  --button-padding:          0 6px;
  --button-color:            #DFDCD5;
  --button-background:       var(--color-primary);
  --button-color-hover:      #FFFFFF;
  --button-background-hover: #808080;
  --button-color-active:     #000000;
  --button-background-active:#FFFFFF;
}
```

Variants:
- **Primary (default).** Black bg, linen text. Use for `Sign up`, `Get started` — max one per section.
- **Bordered.** Transparent bg, hexagonal SVG outline. Used as the `+`/`−` toggle on feature cards.
- **Light.** Inverse: linen bg, black text. For dark-on-dark contexts.

Hover behavior: two pseudo-element circles (`:before`, `:after`) at the label's left/right edges. They live at `scale(0.75)`. On hover they expand to `scale(1.4)` and the wrapper background shifts.

### 6.3 Feature card (expandable)

Three across on desktop, stacked on mobile.

- Square-ish aspect (`459/448`).
- Centered serif title at top (`c-heading-md`, weight 400).
- Circular-clipped illustration window. Clip uses `clip-path: inset(0% round 100%)`; on `.is-open`, animates to `inset(10% round 100%)` and fades opacity 0.
- Body copy appears **only when open** — fades in over `0.3s`.
- Border (`1px #595855`) appears only on `.is-open`, with `transform: scale(0.95) → scale(1)`.
- Bottom edge: `+`/`−` toggle button (bordered variant).

### 6.4 Use-case card

Three across, larger aspect (`458/545`).

- Black bg, `2px #595855` border, `10px` radius.
- Top edge: ornamental SVG frame (polygon notch with peaks/valleys). On scroll-in, a follower path traces the outline using `stroke-dasharray`.
- Large display title at bottom-left (`c-heading-lg-s-light` — weight 400, ~52px).
- Short body below (~13–15px).
- Entrance: clip-path from bottom over `1s` with `--ease-out-expo`. Stagger by ~200ms across cards in the same row.

### 6.5 Footer (with wordmark composition)

The footer is the closing visual moment of the landing page. It uses the canonical `footer-aged-books.png` composition: two towers of weathered books, scrolls, and writing tools flanking a deep central void on a pitch-black background. The negative space between the towers is the *slot* where the "AdaptArxiv" wordmark rises into view as the user scrolls to the bottom.

Layer stack (back to front, all `position: absolute` inside an `overflow: hidden` container):

| Layer            | Source                           | Z-index | Parallax behavior                                 |
| ---------------- | -------------------------------- | ------- | ------------------------------------------------- |
| Page bg          | solid `#000000`                  | 0       | static                                            |
| Wordmark         | `<svg>` "AdaptArxiv" in Davinci  | 1       | `translateY: 100% → 0%` over scroll progress      |
| Left tower       | `book-tower-left.png`            | 2       | mouse parallax `strength: 12, invert: true`       |
| Right tower      | `book-tower-right.png`           | 2       | mouse parallax `strength: 12, invert: true`       |
| Quill/inkwell    | `inkwell.png` (top-left tower)   | 3       | mouse parallax `strength: 6, invert: false`      |
| Magnifier lens   | `lens.png` (top-right tower)     | 3       | mouse parallax `strength: 6, invert: false`      |
| Loose pages      | `loose-pages.png` (foreground)   | 4       | mouse parallax `strength: 4, invert: false`      |
| Utility links    | `<ul>` (top of footer)           | 10      | static, on top                                    |
| Legal row        | `<div>` (bottom of footer)       | 10      | static, on top                                    |

Wordmark sits in Davinci weight 400, sized via `--text-heading-xxl` (clamps 145 → 400px). Color: `currentColor` set to `--color-grey` (`#C4C3B6`). The wordmark uses single-path letterforms — viewBox sized to the wordmark's intrinsic dimensions, scaled to fill width via `h-auto w-full`.

The black void in the center of `footer-aged-books.png` must be true `#000` so it merges seamlessly with the section background — the towers should look like they're emerging from darkness rather than sitting on a colored frame.

---

## 7. Motion

### 7.1 Easing tokens

```
--ease-out-quad:    cubic-bezier(.25, .46, .45, .94)   /* UI, hover, micro */
--ease-out-expo:    cubic-bezier(.19,  1,   .22, 1)    /* section reveals  */
--ease-in-out-expo: cubic-bezier(.87,  0,   .13, 1)    /* clip-path morphs */
```

### 7.2 Duration tokens

```
--transition-duration:      0.4s     /* hover, fade, default UI */
--transition-duration-slow: 0.6s     /* clip-path, morph */
0.3s   — tooltip, badge, tag fade
0.5s   — header/link entrance
1.0s   — section clip-path reveal
3.0s   — large card translate / opacity composite
```

### 7.3 Patterns (recipes in §11)

- **Split-text reveal.** Wrap headlines in a custom element that splits to lines → words → letters and stagger transition-delays (50ms per letter, 100ms per line). On `.is-inview`, transform `translateY(100%) → 0`.
- **Scroll parallax.** Use Lenis for smooth scroll + Framer Motion's `useScroll` / `useTransform` per layer. Speeds: foreground `0.1`, mid `0.2`, far `0.3`.
- **Mouse parallax.** Custom hook (see §11.4) applies transforms via direct DOM `style.transform` for performance. Layers nest inside Framer Motion scroll wrappers to avoid transform conflicts.
- **Sticky storytelling panel.** Position a centered card `position: sticky; top: 0; height: 100vh` while a long parallax background scrolls behind it. Inside the card, swap text slides via `.active` class; trigger via scroll-progress percentage.
- **Soft-light glow followers.** A `40×40px` blurred (`blur(6px)`) circle of `--color-secondary` with `mix-blend-mode: soft-light`. Two or three per section, never more.
- **Path-trace ornament.** SVG outline of a card frame with a second `<path>` using `stroke-dasharray` to trace on `.is-inview`.
- **Diamond button morph.** Hexagonal clip-path on the button label, end-cap SVGs scale to `0` on hover so the shape "snaps open" into a rectangle.

### 7.4 What to avoid

- No spring/bounce easing.
- No "scale on hover" without compensating motion (it reads as cheap).
- No fade-only entrances — always pair opacity with translate or clip-path.
- No looping ambient animations (rotating coins, pulsing dots). Motion should be triggered, deliberate, and end.

---

## 8. Imagery & art direction

### 8.1 The visual vocabulary

Where Structured borrowed temples and landscapes for its "permanent value" metaphor, AdaptArxiv has a native vocabulary: **aged manuscripts, leather-bound codices, quills and inkwells, hand-drawn diagrams, scrolls, magnifying lenses, monograph spreads, marginalia, citation graphs**. These are the literal artifacts of scholarship — borrowing them isn't metaphor, it's heritage.

Hold the same painterly treatment as Structured (atmospheric, layered, brushed texture — never flat-vector), but the subject matter shifts entirely toward the library, the archive, the desk.

### 8.2 The canonical composition

`footer-aged-books.png` is the visual anchor of the brand: two towers of weathered books, manuscripts, scrolls, and tools (quill in inkwell, magnifying lens) flanking a deep central void. Pitch-black background. Warm sepia/cream/burnt-umber palette.

The composition is engineered — not symmetric. Left tower carries the **inkwell and quill** (writing). Right tower carries the **magnifying lens** (reading). Together: scholarship as a complete loop. The negative space in the middle is the slot where the "AdaptArxiv" wordmark rises (see §9).

### 8.3 Production rules

- Pipeline: Midjourney/Flux on a tuned LoRA → manual paint-out and edge-cleanup in Photoshop → export per parallax layer with transparent background.
- Layer separately: foreground books, midground manuscripts, background atmospheric haze. 3–6 layers per scene.
- Black surrounds must be true `#000` (not `#0A0A0A`, not deep brown) so they merge with section backgrounds.
- Resolutions: serve `500 / 768 / 1024 / 1440 / 1920` widths via `srcset`. Always `.webp` source before `.png`.
- Hand-painted texture preserved at all sizes — no vector simplification at small breakpoints.

### 8.4 What to avoid

- No 3D book renders (Blender realism reads as stock).
- No flat symmetric Wes-Anderson-library illustrations.
- No fake parchment/paper textures applied to UI chrome (texture lives in imagery, never in cards or buttons).
- No "AI brain", circuit-board, or data-flow imagery — even though AdaptArxiv may use ML, the visual identity rejects that vocabulary.
- No live people, no modern photographs, no clean vector book icons in marketing surfaces.

---

## 9. Hero & footer wordmark composition

The "AdaptArxiv" wordmark rising into the central void of the aged-books composition is the brand's signature scroll moment. Treat it as a single integrated component.

### 9.1 Markup

```tsx
<section
  ref={footerRef}
  className="relative h-[100vh] w-full overflow-hidden bg-black"
>
  {/* Wordmark (z-1) */}
  <motion.div
    style={{ y: wordmarkY, scale: wordmarkScale }}
    className="absolute inset-x-0 bottom-0 z-10 px-grid-edge"
  >
    <svg viewBox="0 0 1440 298" className="h-auto w-full fill-grey">
      {/* AdaptArxiv letterforms as single paths, exported from Davinci */}
    </svg>
  </motion.div>

  {/* Left tower (z-2) */}
  <motion.img
    ref={leftTowerRef}
    src="/assets/book-tower-left.png"
    alt=""
    className="pointer-events-none absolute bottom-0 left-0 z-20 h-full w-auto select-none"
    draggable={false}
  />

  {/* Right tower (z-2) */}
  <motion.img
    ref={rightTowerRef}
    src="/assets/book-tower-right.png"
    alt=""
    className="pointer-events-none absolute bottom-0 right-0 z-20 h-full w-auto select-none"
    draggable={false}
  />

  {/* Foreground tools (z-3) */}
  <motion.img ref={inkwellRef} src="/assets/inkwell.png" /* ... */ />
  <motion.img ref={lensRef}    src="/assets/lens.png"    /* ... */ />

  {/* Loose pages overlay (z-4) */}
  <motion.img ref={pagesRef}   src="/assets/loose-pages.png" /* ... */ />

  {/* UI surfaces (z-10) */}
  <FooterNav />
  <FooterLegal />
</section>
```

### 9.2 Scroll behavior

```tsx
const { scrollYProgress } = useScroll({
  target: footerRef,
  offset: ["start end", "end end"],
});

// Wordmark rises from below into the void
const wordmarkY = useTransform(scrollYProgress, [0, 1], ["100%", "0%"]);

// Subtle scale-down at the end
const wordmarkScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
```

### 9.3 Wordmark export rules

- Single SVG path per letter (or one combined path for the whole wordmark).
- Exported from Davinci weight 400 at any size — viewBox carries the geometry.
- `fill="currentColor"`, set color via parent `text-grey` class.
- No stroke. No drop-shadow. No gradient. The wordmark is a flat silhouette.
- The whole wordmark fits in a `viewBox` proportional to its intrinsic letter run; the SVG then scales to `width: 100%` of the section. Don't apply a different SVG for mobile.

---

## 10. Voice & content

Calm, declarative, institutional. Prefers nouns over adjectives. Names what the product is and what it does. Avoids hype.

**Use:** *liquid, structured, rigorous, sustainable, composable, cited, integrated, scalable, real, proven, adaptive, archived*

**Avoid:** *revolutionary, next-gen, unlock, supercharge, insane, blazing-fast, AI-powered (as a hero claim), to the moon, game-changing*

Headlines: 2–5 words, with one italicized concept word.
Body: 1–2 sentences, ~25 words max per block.
Microcopy: lowercase or sentence case (e.g., "open library", "search archive"), never title-case for CTAs.

---

## 11. Motion implementation cookbook

Concrete recipes for the patterns referenced in §7. All examples assume **Framer Motion** + **Lenis**.

### 11.1 Lenis bootstrap (`main.tsx`)

```tsx
import Lenis from "lenis";

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});

function raf(time: number) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
```

### 11.2 Nav blur reveal (entry)

```tsx
<motion.nav
  initial={{ opacity: 0, filter: "blur(8px)" }}
  animate={{ opacity: 1, filter: "blur(0px)" }}
  transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
>
  ...
</motion.nav>
```

Stagger children by `0.1s` using a parent variant.

### 11.3 Heading clip-reveal (entry)

Each line of a heading sits in its own `overflow: hidden` wrapper. The line itself starts at `y: 100%` and animates to `y: 0%`.

```tsx
<h1>
  {lines.map((line, i) => (
    <span key={i} className="block overflow-hidden">
      <motion.span
        className="block"
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        transition={{
          duration: 0.7,
          delay: i * 0.1,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        {line}
      </motion.span>
    </span>
  ))}
</h1>
```

For word-by-word stagger inside a single line: `stagger: 0.035s`, `duration: 0.55s`, same easing.

### 11.4 Mouse parallax hook

Custom hook applies transforms via direct `style.transform` (faster than re-rendering through Framer Motion):

```ts
// hooks/useMouseParallax.ts
import { RefObject, useEffect, useRef } from "react";

interface Options {
  strength?: number;     // max displacement in px
  invert?: boolean;      // true = opposite to cursor
  ease?: number;         // lerp factor, default 0.08
  restingScale?: number; // default 1.05 (bleed coverage)
  containerRef?: RefObject<HTMLElement>;
}

export function useMouseParallax<T extends HTMLElement>(
  ref: RefObject<T>,
  {
    strength = 15,
    invert = false,
    ease = 0.08,
    restingScale = 1.05,
    containerRef,
  }: Options = {}
) {
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const bounds = (containerRef?.current ?? document.body).getBoundingClientRect();
      const nx = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
      const ny = ((e.clientY - bounds.top) / bounds.height) * 2 - 1;
      const dir = invert ? -1 : 1;
      target.current = { x: nx * strength * dir, y: ny * strength * dir };
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * ease;
      current.current.y += (target.current.y - current.current.y) * ease;
      if (ref.current) {
        ref.current.style.transform =
          `translate3d(${current.current.x}px, ${current.current.y}px, 0) scale(${restingScale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [ref, strength, invert, ease, restingScale, containerRef]);
}
```

Layer assignments for the footer composition:

| Layer        | strength | invert |
| ------------ | -------- | ------ |
| Book towers  | 12       | true   |
| Inkwell/lens | 6        | false  |
| Loose pages  | 4        | false  |

The wordmark itself does *not* get mouse parallax — only scroll-driven translateY. That keeps the centerpiece stable.

### 11.5 Diamond / hexagonal button morph

The button has two SVG end-caps and a center label. On hover, the end-caps collapse (`scaleX → 0`) and the label's clip-path morphs from hexagon to rectangle.

```tsx
const initialClip =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0 50%)";
const hoverClip =
  "polygon(0 0, 100% 0, 100% 50%, 100% 100%, 0 100%, 0 50%)";

<button
  onMouseEnter={...}
  onMouseLeave={...}
  className="relative inline-flex h-[40px]"
  style={{
    clipPath: hover ? hoverClip : initialClip,
    transition: "clip-path 300ms ease-out",
  }}
>
  <LeftCapSVG  style={{ transform: hover ? "scaleX(0)" : "scaleX(1)" }} />
  <span className="c-button_label">Get started</span>
  <RightCapSVG style={{ transform: hover ? "scaleX(0)" : "scaleX(1)" }} />
</button>
```

### 11.6 Sticky scroll-driven slideshow card

For the intro thesis section (3 panels of copy that swap as the user scrolls past a fixed card):

```tsx
const { scrollYProgress } = useScroll({ target: sectionRef });
const slideIndex = useTransform(scrollYProgress, (p) =>
  Math.min(slides.length - 1, Math.floor(p * slides.length))
);

<section ref={sectionRef} className="relative h-[300vh]">
  <div className="sticky top-0 grid h-screen place-items-center">
    {/* Card sits centered, content swaps based on slideIndex */}
  </div>
</section>
```

Section height = `100vh × number of slides`. Each slide's content fades in (`opacity 0 → 1`, `0.4s easeOut`) when its index matches.

### 11.7 CSS Grid overlap for sticky-with-overlap layouts

When two sections must visually overlap *and* sticky positioning still needs to work inside one of them:

```css
.overlap-container {
  display: grid;
  grid-template-columns: 1fr;
}
.overlap-container > * {
  grid-column: 1;
  grid-row: 1;
}
.overlap-container > .overlay {
  pointer-events: none;
}
.overlap-container > .overlay > .interactive {
  pointer-events: auto;
}
```

Avoids `margin-top: -100vh` hacks that break sticky scroll progress calculations.

### 11.8 Performance checklist

- `will-change: transform` on every parallax layer (remove after animation completes if static).
- All transforms use `translate3d(...)` — never `top` or `left`.
- All image containers carry `overflow: hidden` to prevent parallax bleed.
- All decorative imagery: `pointer-events: none`, `user-select: none`, `draggable={false}`.
- Don't mix Framer Motion transforms with direct DOM transforms on the same element.
- Lenis must not run on touch (`smoothTouch: false`); native scroll on mobile is faster and more accurate.

---

## 12. Implementation: CSS tokens

Drop this into `tokens.css` or your Tailwind theme:

```css
:root {
  /* Color */
  --color-black:           #000000;
  --color-primary:         #000000;
  --color-white:           #FFFFFF;
  --color-secondary:       #E7E5E4;
  --color-base-foreground: #F5F5F4;
  --color-dust:            #EBEBEB;
  --color-linen:           #DFDCD5;
  --color-ghost:           #DFDCD5;
  --color-grey:            #C4C3B6;
  --color-light-grey:      #7E7D75;
  --color-dark-grey:       #595855;
  --color-muted-foreground:#A3A3A3;

  /* Type families */
  --font-serif: "Davinci", "Times New Roman", serif;
  --font-sans:  "Inter", "Helvetica Neue", "Arial", sans-serif;
  --font-mono:  ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* Type scale */
  --text-heading-xxl: clamp(9.0625rem, 3.519rem + 27.7174vw, 25rem);
  --text-heading-xl:  clamp(2.8125rem, 1.7473rem + 5.3261vw, 5.875rem);
  --text-heading-lg:  clamp(2.875rem, 2.7446rem + 0.6522vw, 3.25rem);
  --text-heading-lg-s:clamp(2.25rem, 1.9022rem + 1.7391vw, 3.25rem);
  --text-heading-md:  clamp(1.875rem, 1.788rem + 0.4348vw, 2.125rem);
  --text-heading-sm:  clamp(1.5rem, 1.4348rem + 0.3261vw, 1.6875rem);
  --text-heading-xs:  clamp(1.1875rem, 1.144rem + 0.2174vw, 1.3125rem);
  --text-body:        clamp(0.9375rem, 0.9375rem + 0vw, 0.9375rem);
  --text-body-sm:     clamp(0.75rem, 0.6848rem + 0.3261vw, 0.9375rem);
  --text-link:        0.75rem;
  --text-small:       0.5625rem;

  /* Radius */
  --radius-sm:  0.25rem;
  --radius-xl:  0.75rem;
  --radius-2xl: 1rem;

  /* Motion */
  --ease-out-quad:    cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-out-expo:    cubic-bezier(0.19, 1,    0.22, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0,    0.13, 1);
  --transition-duration:      0.4s;
  --transition-duration-slow: 0.6s;

  /* Grid */
  --grid-edge-s:   16px;
  --grid-edge-m:   16px;
  --grid-gutter:   20px;
  --grid-columns-s: 4;
  --grid-columns-m: 12;
  --breakpoint-sm: 40rem;
  --breakpoint-l:  64rem;

  /* Buttons */
  --button-height:           40px;
  --button-min-width:        95px;
  --button-radius:           4px;
  --button-font-size:        15px;
  --button-padding:          0 6px;
  --button-color:            #DFDCD5;
  --button-background:       var(--color-primary);
  --button-color-hover:      #FFFFFF;
  --button-background-hover: #808080;
  --button-color-active:     #000000;
  --button-background-active:#FFFFFF;
}

/* Heading utility classes */
.c-heading-xl { font: 400 var(--text-heading-xl)/1 var(--font-serif); letter-spacing: -0.03rem; }
.c-heading-lg { font: 400 var(--text-heading-lg)/1 var(--font-serif); }
.c-heading-md { font: 400 var(--text-heading-md)/1.1 var(--font-serif); }

/* Italic-keeps-case modifier */
.c-italic-no-uppercase { text-transform: uppercase; }
.c-italic-no-uppercase em { text-transform: none; font-style: italic; }

/* Body */
.c-body    { font: 400 var(--text-body)/1.25 var(--font-sans); }
.c-body-sm { font: 400 var(--text-body-sm)/1.25 var(--font-sans); }
```

---

## 13. Build stack

- **Vite + React + TypeScript** for the marketing site.
- **Tailwind v4** for utility classes; the `@theme` block holds the tokens above.
- **Framer Motion** for entry animations, scroll-linked transforms, sticky cards.
- **Lenis** for smooth scroll. Initialize once in `main.tsx`, never on touch.
- **next/font** or `<link rel="preload" as="font">` for self-hosted Davinci.
- `<picture>` + `srcset` for parallax PNG layers; serve `.webp` first.

### 13.1 Suggested file structure

```
src/
  main.tsx              # Vite entry + Lenis bootstrap
  App.tsx               # Routes / page composition
  index.css             # @font-face + Tailwind config + Lenis styles
  components/
    DiamondButton.tsx
    IntroBlackBox.tsx
    FeatureCard.tsx
    UseCaseCard.tsx
    FooterWordmark.tsx  # the §9 composition
  hooks/
    useMouseParallax.ts
public/
  fonts/
    TRJN-DaVinci-Regular.woff2
    TRJN-DaVinci-Italic.woff2
    TRJN-DaVinci-Medium.woff2
  assets/
    footer-aged-books.png       # full composition (reference)
    book-tower-left.png         # split layer
    book-tower-right.png        # split layer
    inkwell.png
    lens.png
    loose-pages.png
```

### 13.2 Implementation order

1. Set up Vite + React + TypeScript.
2. Install `framer-motion`, `lenis`, `tailwindcss@next`, `@fontsource/inter`.
3. Configure Tailwind v4 `@theme` with the §12 tokens.
4. Add `@font-face` declarations and preload links for Davinci.
5. Initialize Lenis in `main.tsx`.
6. Build `useMouseParallax` hook.
7. Hero section (top of page) with entry animations and clip-reveal headings.
8. Diamond button component.
9. IntroBlackBox sticky slideshow card.
10. Feature card grid (expandable).
11. Use-case card row.
12. Footer wordmark composition (§9) — splitting `footer-aged-books.png` into layered PNGs.
13. CSS Grid overlap for any sticky-overlap sections.
14. Responsive adjustments and accessibility audit.

---

## 14. Anti-patterns checklist

Before shipping a page, verify:

- [ ] No accent color in UI controls (no blue, no orange, no green).
- [ ] No more than two type families on the page.
- [ ] No bold weight in body copy.
- [ ] No glassmorphism or frosted blur on cards.
- [ ] No emoji or 3D illustration in marketing surfaces.
- [ ] No "AI-generated" cyber/futuristic tropes.
- [ ] All headings ≤ 5 words.
- [ ] At most one primary CTA per section.
- [ ] Every entrance animation pairs translate or clip-path with opacity.
- [ ] Every painterly image has at least one parallax layer.
- [ ] The footer wordmark uses single-path SVG, not text rendering.
- [ ] All decorative imagery is `pointer-events: none` and `draggable={false}`.

---