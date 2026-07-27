@AGENTS.md

# Connekyt Mobile — Project Instructions

> Expo (React Native) app using expo-router. Styling is React Native
> `StyleSheet` with design tokens from `@/theme` (`colors`, `spacing`,
> `radii`, `fontSize`, `fontWeight`). There is NO Tailwind/NativeWind and
> no HTML here, so the design directive below is written for RN, not web.
> Keep features in parity with the web clients (dashboard/landing) per the
> shared `backend.connekyt.com` API contract.

## UI/UX Design Directive (always apply for any UI work)

Whenever I ask you to create a new screen/component that needs UI, or to update/change existing UI, treat it as a DESIGN task, not a patch task. Follow this every time, without me having to restate it:

1. **Redesign, don't patch.** Build the screen/component fresh as a clean, self-contained unit first, then wire it into the app (routing, data, imports) rather than minimally editing existing markup. Prefer a modern rebuild over incremental tweaks unless I explicitly say "small change only."

2. **Design in isolation first.** Draft the component standalone with mock data (clean layout, no legacy baggage), get the visual result right, THEN integrate it with real hooks, `@/api` endpoints, and expo-router navigation. Greenfield freedom first, real wiring second.

3. **Honor brand tokens.** Use the design system in `@/theme`: brand **navy `#083A85`** and **pink `#F20C8F`** (exposed as `colors.primary` / `colors.accent`), plus the existing `spacing`, `radii`, `fontSize`, `fontWeight` scales and the `src/components/ui` primitives (Button, ScreenHeader, etc.). Compose them fresh and intentionally, never hardcode raw hex when a token exists, and never copy whatever the old screen did by default.

4. **Apply modern mobile design principles by default:**
   - Generous, consistent spacing from the `spacing` scale; a clear vertical rhythm.
   - Strong typographic hierarchy via `fontSize`/`fontWeight` (distinct title, label, body, meta).
   - Clear visual grouping, alignment, and a sensible flex layout.
   - Purposeful color: brand tokens as accents, neutral surfaces for calm.
   - Subtle depth (soft shadow/elevation, `radii`, hairline borders), polished not heavy.
   - Tasteful micro-interactions: `Pressable` pressed states, `hitSlop`, transitions/`LayoutAnimation` where they add clarity.
   - Responsive to screen size and orientation (flex, `Dimensions`/`useWindowDimensions`), and respects **safe areas** (`react-native-safe-area-context`) and notches.
   - Accessible: `accessibilityRole`/`accessibilityLabel` on interactive elements, adequate touch targets (~44pt), WCAG-AA contrast, and don't disable `allowFontScaling` (support Dynamic Type).
   - Light/dark handled through `@/theme` (never hardcode a single-mode color).
   - Empty, loading, and error states designed, not left as afterthoughts.

5. **Aim for a portfolio-quality result** — the kind of clean, cohesive mobile UI a strong design-focused build would produce, tailored to the brand. Avoid generic/templated defaults.

6. **Before finishing UI work,** briefly self-review against the above: hierarchy, spacing, safe areas, responsiveness, states, accessibility, and brand consistency. Fix anything that reads as unpolished.

## UI Build Workflow — Design in a Zero-Constraint Sandbox First

For ANY task involving new UI or redesigning existing UI, follow this two-phase workflow every time, automatically, without me restating it:

### Phase 1 — Greenfield design (zero legacy constraints)
- Create the component fresh in an isolated sandbox file outside the router, e.g. `src/_design-sandbox/<ComponentName>.preview.tsx` (kept out of `src/app/` so expo-router never routes it, and git-ignored).
- Design it as if the existing screens don't exist. Do NOT read or mimic the old screen's structure or styling decisions in this phase. Start from a clean slate.
- Use mock/placeholder data so nothing external constrains the layout.
- Preview it by temporarily rendering the component from a scratch dev route (delete the scratch route before committing), running on device/simulator via Expo.
- Focus purely on visual quality: layout, hierarchy, spacing, typography, color, states (default/pressed/focus/loading/empty/error), responsiveness, safe areas, accessibility.
- The ONLY things carried over from the real project are the brand tokens from `@/theme` (navy `#083A85`, pink `#F20C8F`, and the spacing/radii/type scales). Everything else is a fresh design decision.

### Phase 2 — Integrate
- Once the sandbox component looks excellent, THEN adapt it into the real app: move it to its feature folder (`src/features/<domain>/…`) or route (`src/app/…`), swap mock data for real hooks + `@/api` endpoint calls, wire expo-router navigation, and align to the project's file conventions.
- Preserve the sandbox's visual design during integration — do not let old patterns pull it back toward the previous look. If the real codebase forces a compromise, tell me explicitly rather than silently reverting to the old style.
- After integrating, you may delete or keep the sandbox file — ask me which I prefer.

### Rules
- Never patch UI in place as a first move. Always design fresh, then integrate.
- If I say "small tweak only," skip Phase 1 and edit directly — otherwise always run both phases.
- Treat every UI task as a design deliverable, not a code edit. Aim for portfolio-quality output that stands on its own.

The greenfield sandbox lives at `src/_design-sandbox/` and is git-ignored, so previews never clutter commits.

## Web/Mobile parity

This app must stay in feature parity with the web dashboard/landing. When a feature is built or changed on either side, mirror it here (same behavior, same `backend.connekyt.com` API contract), and vice-versa. Call out explicitly when a change needs mirroring rather than shipping one platform silently.
