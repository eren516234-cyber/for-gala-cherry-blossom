---
name: Scroll-scrubbed image-sequence sites
description: How to turn a provided PNG frame sequence (zip) into a cinematic canvas scroll-scrubber site without regenerating any art.
---

When a user provides a zip of numbered PNG frames (e.g. `frame_00000.png`...) meant to be "the entire visual foundation" of a scroll site:

- Raw PNG frame sequences from these generators are large (often ~1MB/frame at 1280x720). Convert to WebP at the same resolution, quality ~75 — this typically cuts an 8-frame-per-second-of-video sequence from ~200MB down to ~10-15MB with no visible quality loss, since the content is usually soft/bokeh-heavy. Use `magick <in>.png -resize <dims> -quality 75 <out>.webp`, parallelized with `xargs -P 8` (plain sequential loops for ~200 files will exceed the 120s bash timeout).
- Place converted frames in the artifact's `public/frames/` directory and reference via `${import.meta.env.BASE_URL}frames/frame_XXXXX.webp` (never a hardcoded leading `/`).
- Core mechanic: canvas 2D context, scroll progress (Lenis + framer-motion `useScroll`) mapped to `frame = round(progress * (TOTAL_FRAMES-1))`, drawn with object-fit:cover sizing. This is a well-known, reliable pattern the design subagent can execute directly from a text brief — no need to prescribe implementation details beyond naming the technique and required libraries (Lenis, GSAP/ScrollTrigger, framer-motion).
- Inspect a handful of sample frames first (first/mid/last) to check whether the source frames already contain baked-in text/messages — if not, overlay any requested text (e.g. friendship messages) yourself as UI, not baked into images.
- `lenis` is not in the react-vite scaffold's default `package.json` — expect to `pnpm --filter <artifact> add lenis` after the design subagent's first build if it imports it, then restart the workflow.
- Default to `object-fit: cover` (full-bleed, crop overflow) for the canvas draw, not `contain`. Users who ask for "show the whole image, nothing cropped" almost always mean it literally at first, but once they see letterbox bars they call it "weird"/empty and ask to fill the screen edge-to-edge again. `cover` is the safer default; only switch to `contain` if they explicitly reject cropping after seeing `cover`.
