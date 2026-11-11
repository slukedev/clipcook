# Design

ClipCook follows [Material 3 Expressive](https://m3.material.io) closely. Numbers come from Google's Compose and MDC sources where the spec site does not publish them. The component library lives in `src/components/ui` (API reference in its README), and `/dev/gallery` shows every component and state in development.

## Type

Google Sans Flex, variable, loaded with `next/font`. The full M3 baseline and emphasized type scales are tokens in `src/styles/theme/typescale.css` with SCSS mixins in `src/styles/mixins`. Emphasized display and headline styles use the ROND axis for the rounded Expressive look; body text stays calm. Quantities and timers use tabular figures. High contrast mode raises the GRAD axis.

## Color

Generated with Material Color Utilities (`npm run generate:theme`, source in `src/lib/theme`).

- **App:** seed `#C2502A` (paprika) through `SchemeTonalSpot` with the 2025 spec, with the primary palette held at chroma 60. Plain TonalSpot pulls warm reds toward brown; holding chroma keeps the primary appetizing while keeping TonalSpot's warm neutrals and saffron tertiary.
- **Recipes:** each recipe page and kitchen display view is re-themed from its photo's seed color with `SchemeContent`, rendered on the server so there is no flash. Content keeps each dish's own hue, which TonalSpot flattens.
- Light and dark follow the system unless overridden. Contrast has standard, medium and high levels. Preferences are cookies applied before first paint.

## Shape

The Expressive corner scale (none to full, including large-increased, extra-large-increased and extra-extra-large) and all 35 MaterialShapes as SVG (`@/components/ui/shape`). Shapes are used with intent: the loading indicator morphs through them, step numbers sit in them, photo-less recipes get a tinted shape, and the sign-in screen and success moments use them. Buttons morph from round to square when pressed or selected.

## Motion

The Expressive motion scheme by default, the Standard scheme as a setting.

| Spring                        | Damping         | Stiffness         |
| ----------------------------- | --------------- | ----------------- |
| Spatial fast / default / slow | 0.6 / 0.8 / 0.8 | 800 / 380 / 200   |
| Effects fast / default / slow | 1.0             | 3800 / 1600 / 800 |

Spatial springs move things (position, size, shape). Effects springs change color and opacity and never overshoot. JS motion uses `src/lib/motion.ts`; CSS uses `linear()` approximations of the same springs in `src/styles/theme/motion.css`. Route changes use React view transitions on M3 timing: the old page leaves in 90ms and the new one arrives over the next 210ms. Top-level destinations fade through, deeper pages use shared axis X, the recipe photo morphs from its library card (and back), and the Cook button grows into cook mode. The navigation bar and rail are anchored and never animate. Navigations should land in one step: destinations, on-screen recipe cards and the Cook button prefetch whole pages, so a skeleton only appears on a cold link, and then it crossfades into the page with no gap. Library filters crossfade the results; typing in search stays instant. Reduced motion removes movement and keeps short fades. A view-transition-name must never repeat between two transitions, because WebKit reuses the finished animations of a name it has seen and the snapshot stops animating: name boundaries with `SharedElement`, `PageTransition` or `useFreshVtName` (all in `src/components/ui/view-transition`), and give fixed snapshots like the root fades through `var(--cc-vt-fade-out)` and `var(--cc-vt-fade-in)`.

## Layout

M3 window classes: compact under 600px, medium 600 to 839, expanded 840 to 1199, large 1200 to 1599, extra-large 1600 and up. Compact gets a navigation bar and FAB menu, medium a collapsed rail, and wider screens an expanded rail. Every page centers its content in one of three page frames (`src/styles/mixins/_page.scss`): wide (1600px) for browsing grids and boards, medium (1280px) for a recipe, the editor and clip review, narrow (760px) for settings. A page's top app bar reads the same frame, so titles and actions sit on the content edge rather than the window edge, and nothing ends up pinned to one side of a large monitor. Recipe pages switch to two panes on wide screens, and steps never exceed a comfortable reading measure. The meal plan stacks the days on compact and medium windows; from expanded up it is a week board, seven day columns with a row for every meal (each day a CSS subgrid), so meals line up across the week the way hours do in a calendar. Dinner and any meal in use are open slots that grow with the window's height; meals not in use are slim outlined strips, and on windows under 720px tall they fold away so dinner stays above the fold. Today's column takes a tonal fill and its date a primary circle; past days recede. Kitchen display views are designed for 1024x600 and 1280x800 landscape screens first.

## Interaction

- State layers on every interactive surface, a 3px focus ring offset by 2px, and 10% pressed and focus layers.
- Targets are at least 48px, checklist rows at least 56px, display targets at least 64px.
- Optimistic updates for toggles, with undo for destructive actions.

## Copy

Labels are one to three plain words. Buttons name the action. Errors say what happened and what to do next in one sentence. No taglines, no exclamation marks, no em dashes.

Titles and headings use title case; buttons, labels and body text use sentence case.
