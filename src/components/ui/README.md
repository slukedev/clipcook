# ClipCook design system

Material 3 Expressive on Base UI primitives, SCSS modules and M3 tokens. Every component lives at its own path. Import from that path, never from the barrel (`@/components/ui`), so a client bundle only carries what it uses:

```tsx
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
```

The live gallery is `/dev/gallery` (development only). It has theme, contrast, motion scheme and recipe color controls.

## Ground rules

- **Icons are elements.** Components take `icon={<Icon name="add" />}` and never a name string. `Icon` holds the full Material Symbols map (about 37 KB gzipped), so render it in server components and pass the element down. Client components that draw their own glyphs use `Glyph` (check, close, arrows; a few KB).
- **Links.** Base UI components take `render={<Link href="/x" />} nativeButton={false}`. `Card`, `ListItem`, `NavigationBarItem` and `NavigationRailItem` take `href` directly.
- **className** is always a string and always passes through. State is exposed as data attributes (`data-pressed`, `data-selected`, `data-size`...).
- **Server or client.** These are server-safe: `Icon`, `Shape`, `Card`, `List`/`ListItem`, `Divider`, `Skeleton`, `EmptyState`, `Badge`, `Kbd`, `VisuallyHidden`, `PageTransition`, `SharedElement`. Everything else is `'use client'` at the leaf.
- **Touch targets** are 48dp or more even on the XS and S sizes.

## Tokens

| Area      | Where                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color     | `src/styles/theme/color.css` (generated)                                                                     | `--md-sys-color-*`, every M3 role including `*-dim` and fixed roles. Light, dark (`prefers-color-scheme` unless `data-theme`), and `data-contrast="medium" / "high"`.                                                                                                                                                                                    |
| Type      | `src/styles/theme/typescale.css`, `@use 'styles/mixins/typography' as type`                                  | `@include type.role(title-large)`; `type.role(display-small, $emphasized: true)` adds weight and Google Sans Flex ROND. `@include type.numeric` or class `cc-tabular` for quantities and timers. `@include type.subhead` for section subheads inside ingredient and step lists ("For the marinade"): title-small emphasized, primary, no inset.          |
| Shape     | `src/styles/theme/shape.css`                                                                                 | `--md-sys-shape-corner-{none,extra-small,small,medium,large,large-increased,extra-large,extra-large-increased,extra-extra-large,full}`                                                                                                                                                                                                                   |
| Motion    | `src/styles/theme/motion.css` (generated), `src/lib/motion.ts`                                               | `--md-sys-motion-spring-{spatial,effects}-{fast,default,slow}` plus `-duration`. They are `linear()` traces of the M3 springs. Expressive is the default; `<html data-motion="standard">` switches. Reduced motion zeroes the spatial durations and keeps the effects fades. `@include motion.springs((transform: spatial-fast, opacity: effects-fast))` |
| Elevation | `--md-sys-elevation-level0..5`                                                                               | Prefer surface-container roles; shadows are for floating things.                                                                                                                                                                                                                                                                                         |
| State     | `--md-sys-state-*-state-layer-opacity`, `@include state-layer.host`                                          | Hover 8%, focus and press 10%, drag 16%.                                                                                                                                                                                                                                                                                                                 |
| Layout    | `--md-sys-layout-margin` (16 then 24 at 600px), `--md-sys-space-*`, `--safe-*`, `@use 'styles/mixins/media'` | Window classes: `compact`, `medium-up` (600), `expanded-up` (840), `large-up` (1200), `extra-large-up` (1600).                                                                                                                                                                                                                                           |
| Focus     | `@include focus-ring.ring` / `focus-ring.inward`                                                             | 3px secondary ring at a 2px offset that grows to 8px and settles.                                                                                                                                                                                                                                                                                        |

Helpers in `globals.scss`: `.cc-auto-visibility` (content-visibility for long lists) and `.cc-tabular`.

## Color decisions

- **Brand (app chrome):** seed `#C2502A` (paprika) with `SchemeTonalSpot` spec 2025. The primary palette is held at chroma 60 (`BRAND_PRIMARY_CHROMA`). Plain TonalSpot caps primary chroma near 32, which turned every tomato and paprika seed cocoa brown. Vibrant 2025 was fresh but brought a purple tertiary and blood-red dark surfaces. The hybrid keeps TonalSpot's warm neutrals and its saffron tertiary. Primary is `#A63C17` in light and `#FFB59E` in dark, and on-primary contrast is 6:1.
- **Recipe pages:** `SchemeContent` from the photo seed. It was compared with TonalSpot 2025 and Vibrant 2025 on tomato, basil, curry, chocolate, blueberry and bread seeds. TonalSpot flattens every photo into the same pinkish brown. Vibrant shifts hues (tomato gets a purple tertiary, curry turns highlighter yellow). Content keeps each dish's own color and stays calm enough for long reading. MCU only applies spec 2025 to TonalSpot, Neutral, Vibrant and Expressive, so Content renders with the 2021 tones.
- Regenerate the brand tokens with `npm run generate:theme`.

```ts
import { dynamicColorCss, schemeFromSeed } from '@/lib/theme/scheme' // server-safe, no DOM
import { getThemePreference } from '@/lib/theme/server' // server only

const { contrast } = await getThemePreference()
const css = dynamicColorCss(`[data-recipe="${id}"]`, recipe.seedColor, { contrast }) // variant defaults to 'content'
// <style>{css}</style><article data-recipe={id}>...</article>
schemeFromSeed('#C8321E', { dark: true, contrast: 'high', variant: 'content' }) // { primary: '#...', ... }
```

## Theme preference

- `getThemePreference()` (server, `@/lib/theme/server`) returns `{ theme: 'system' | 'light' | 'dark', contrast: 'standard' | 'medium' | 'high', motion: 'expressive' | 'standard' }` from cookies.
- `useThemePreference()` (client, `@/components/theme/theme-provider`) returns `{ theme, contrast, motion, resolvedTheme, setTheme, setContrast, setMotion }`. Changes write the cookie; theme and contrast crossfade with a view transition.
- The root layout sets `data-theme`, `data-contrast` and `data-motion` during SSR, and a nonce'd inline script repeats that before paint for cached HTML. System mode needs no script.

## Motion in JS

```ts
import { spring, useSpring, useSpringSpec, useMotionScheme, useReducedMotion, vtName } from '@/lib/motion'
<motion.div animate={{ transform: 'translateY(0)' }} transition={useSpring('spatial-default')} />
```

`useSpring` follows the active scheme and returns an instant transition for spatial tokens under reduced motion. `spring.spatialFast` and the others are fixed Expressive transitions.

## View transitions

React 19.3 `<ViewTransition>` with Next 16.4 router support. No flag is needed.

```tsx
import { PageTransition, SharedElement, TransitionLink, useViewTransitionRouter, vtName } from '@/components/ui/view-transition'

// page.tsx
<PageTransition>...page...</PageTransition>
// list item and detail page, same name on both:
<SharedElement name={vtName('recipe-photo', id)}><img .../></SharedElement>
<TransitionLink href={`/recipe/${id}`} direction="forward">...</TransitionLink>
const router = useViewTransitionRouter(); router.push('/grocery', 'fade')
```

`forward` and `back` use M3 shared axis X and `fade` fades through. An untyped commit (a Suspense reveal) crossfades, so wrap a route's `loading.tsx` skeleton in `<PageTransition>` too and it hands over to the page without a gap. Styles live in `src/styles/_view-transitions.scss`.

- **Land in one step.** A shared element only morphs when the destination renders in the same commit, so prefetch whole pages: `<Link prefetch>` for a few fixed links, `prefetchPage(router, href)` on intent, and `useWarmOnView(ref, warm)` (`@/lib/navigation`) for list items that rest on screen.
- **Prefetch fetches data, not code.** A client component a route uses for the first time is downloaded on navigation, and the page suspends into its skeleton meanwhile. Prefer server components and CSS for small behaviors on pages that should land in one step.
- **Shared elements pair only on navigation.** `SharedElement` shares for `nav-*` types, so a list re-rendering in place (a filter, the grid and list toggle) never flings photos across the page.
- **Chrome is anchored.** The navigation bar, rails and FAB carry global `cc-vt-*` classes that name them, so they sit above the page snapshots and never move. Name things in global CSS, not CSS modules: modules hash `view-transition-name` values.
- **History.** Browser back and forward render inside popstate, which React does not animate. `goBackWithMorph(id, back, options)` runs one by hand for in-app back buttons; mark both halves with `morphTarget(kind, id)`.

---

## Components

### Button `@/components/ui/button`

`variant`: filled | tonal | outlined | elevated | text. `size`: xs | s | m | l | xl (32/40/56/96/136). `shape`: round | square. `icon`, `trailingIcon`, `loading`. Pressing squares the corners off. Passing `selected` / `defaultSelected` / `onSelectedChange` makes it a toggle (round to square, plus `selectedIcon`).

```tsx
<Button icon={<Icon name="add_link" />}>Clip</Button>
<Button variant="tonal" size="m" loading={pending}>Save</Button>
<Button variant="outlined" selected={fav} onSelectedChange={setFav} icon={<Icon name="favorite" />} selectedIcon={<Icon name="favorite" filled />}>Favorite</Button>
```

### IconButton `@/components/ui/icon-button`

`label` (required), `icon`, `selectedIcon`, `variant`: standard | filled | tonal | outlined, `size` xs to xl, `width`: narrow | default | wide, `shape`, toggle props as on Button.

```tsx
;<IconButton label="More" icon={<Icon name="more_vert" />} />
```

### ButtonGroup, ConnectedButtonGroup `@/components/ui/button-group`

`ButtonGroup` (`size`, `label`) holds separate buttons; a pressed button takes 15% width from its neighbors. `ConnectedButtonGroup` (Base UI ToggleGroup: `value: string[]`, `onValueChange`, `multiple`, `variant`: tonal | filled | outlined, `fill`, `size`) holds `ConnectedButtonGroupItem` (`value`, `icon`, `check`, `size`). Use it instead of segmented buttons.

```tsx
;<ConnectedButtonGroup label="Sort" value={[sort]} onValueChange={(v) => v[0] && setSort(v[0])}>
    <ConnectedButtonGroupItem value="recent">Recent</ConnectedButtonGroupItem>
</ConnectedButtonGroup>
```

### SplitButton `@/components/ui/split-button`

`children` (label), `icon`, `variant`, `size`, `menuLabel`, `menu` (MenuItems), plus button props for the main action.

### Fab, ExtendedFab, FabMenu `@/components/ui/fab`

`Fab`: `label`, `icon`, `size`: small | default | medium | large, `color`: primary | secondary | tertiary, `vibrant`, `lowered`. `ExtendedFab`: `children`, `icon`, `size`: small | medium | large, `collapsed`, `collapseOnScroll`. `FabMenu`: `label`, `icon` holding `FabMenuItem` (`icon`, `onClick`). The toggle morphs into a close button and items stagger out.

### LoadingIndicator `@/components/ui/loading-indicator`

`contained`, `size` (48), `value` (0 to 1 for determinate), `label`. Morphing MaterialShapes; use it for waits under 5 seconds.

### LinearProgress, CircularProgress `@/components/ui/progress`

`value` (0 to 1; omit for indeterminate), `wavy`, `label`; CircularProgress also takes `size`. Track gap, stop dot and wave amplitude follow WavyProgressIndicator.

### Toolbar `@/components/ui/toolbar`

`label`, `variant`: floating | docked, `color`: standard | vibrant, `orientation`, `fab`, `fixed` (pinned bottom center), `hideOnScroll`. Children: `ToolbarButton` (IconButton props), `ToolbarSeparator`, `ToolbarGroup`.

### NavigationBar `@/components/ui/navigation-bar`

`NavigationBar` (`label`) holds 3 to 5 `NavigationBarItem` (`href`, `icon`, `selectedIcon`, `label`, `badge`, `selected`). Selection follows the pathname unless `selected` is set. Compact windows stack the icon over the label; 600px and up put them side by side.

### NavigationRail `@/components/ui/navigation-rail`

`expanded` / `defaultExpanded` / `onExpandedChange`, `modal` (expanded rail floats with a scrim), `expandable`, `fab` (use `RailFab` with `icon`, `label`, `href` | `onClick`; it collapses with the rail). Items: `NavigationRailItem` (same props as NavigationBarItem). `useRailExpanded()`. The modal expanded rail traps focus, closes on Escape, the scrim or a destination, and returns focus to the menu button. Counts move to the end of the pill while expanded.

### TopAppBar `@/components/ui/top-app-bar`

`title`, `subtitle`, `variant`: small | medium | large, `centered`, `leading`, `trailing`, `titleAs` (h1 default). Without `leading`, the title starts at `--md-sys-layout-margin` so it lines up with the page body. The row pins while the medium and large titles scroll away under it. This is a scroll-driven animation on window scroll, with a JS fallback.

### Search, SearchBar `@/components/ui/search`

`SearchBar`: an inline filter field in the bar shape (`value`, `onValueChange`, `onSubmit`, `placeholder`, `leading`, `trailing`). `Search`: a bar that opens a search view, full screen below 840px and docked above. Takes the same props plus `children` (suggestions or results), `open`, `onOpenChange`.

### Chips `@/components/ui/chip`

`AssistChip`, `SuggestionChip` (`icon`, `elevated`, button props), `FilterChip` (`selected` / `defaultSelected` / `onSelectedChange`, `icon`, `trailing`; a check grows in), `InputChip` (`avatar`, `icon`, `onRemove`, `removeLabel`, `selected`). `ChipSet` (`label`, `scroll` for one row with fading edges, `bleed` with `scroll` to run the row into the page margin while the first chip stays on the content edge; the margin is `--md-sys-layout-margin` unless `--md-chip-set-bleed` is set). Every chip has a 48dp touch target.

### Card `@/components/ui/card`

`variant`: elevated | filled | outlined. With `href` it is a link, with `onClick` a button (state layer, ripple, focus ring); otherwise `as`: div | article | section | li.

```tsx
<Card href={`/recipe/${id}`} variant="filled"><img .../><div>...</div></Card>
```

### List, ListItem `@/components/ui/list`

`List` (`segmented`, `label`). `ListItem`: `headline`, `supporting`, `overline`, `leading`, `trailing`, `trailingText`, `lines`, `selected`, `disabled`, and one of `href` | `onClick` | `as="label"` (with `htmlFor`). Segmented rows have 2dp gaps and 16dp outer corners and round off on hover, press and select. Set `--md-list-item-container` to change the row fill.

```tsx
;<List segmented>
    <ListItem as="label" headline="2 eggs" leading={<Checkbox aria-label="2 eggs" />} />
</List>
```

### Checkbox, Radio, Switch

`@/components/ui/checkbox`: `label`, `invalid`, plus Base UI Checkbox props (`checked`, `onCheckedChange`, `indeterminate`, `name`). `@/components/ui/radio`: `RadioGroup` (`label`, `value`, `onValueChange`) holds `Radio` (`value`, `label`). `@/components/ui/switch`: `label`, `icons`, plus `checked` / `onCheckedChange`.

### Slider `@/components/ui/slider`

`label` (required), `value` / `defaultValue` / `onValueChange` / `onValueCommitted`, `min`, `max`, `step`, `size` xs to xl, `icon` (inset; m and up), `format` (bubble and aria value text). Single value.

### TextField `@/components/ui/text-field`

`label`, `variant`: filled | outlined, `supportingText`, `error`, `prefix`, `suffix`, `leadingIcon`, `trailingIcon`, `multiline` (`rows`, `maxRows`, auto-grow), `counter` (needs `maxLength`), `surfaceColor` (outlined label cutout on a non-surface background), plus input props. The label floats in CSS on focus and on any value, so `autoFocus` and browser autofill float it before hydration.

### NumberStepper `@/components/ui/number-stepper`

`label`, `labelHidden`, `size`: s | m | l, `valueWidth`, plus Base UI NumberField props (`value`, `onValueChange`, `min`, `max`, `step`, `format`).

### Select `@/components/ui/select`

`label`, `options: { value, label, icon?, disabled? }[]`, `value` / `defaultValue` / `onValueChange`, `placeholder`, `variant`, `name`.

### Menu `@/components/ui/menu`

`Menu` (Base UI Root) holds `MenuTrigger` (`render={<IconButton .../>}`) and `MenuContent` (`side`, `align`). Items: `MenuItem` (`icon`, `trailing`, `selected`, `onClick`), `MenuLinkItem`, `MenuCheckboxItem`, `MenuRadioGroup` + `MenuRadioItem`, `MenuGroup` (`label`), `MenuSeparator`, `Submenu` (`label`, `icon`).

### Dialog, AlertDialog `@/components/ui/dialog`

`Dialog` + `DialogTrigger` + `DialogContent` (`headline`, `icon`, `actions`, `fullScreen`, `fullScreenAction`) + `DialogClose`. `AlertDialog` + `AlertDialogTrigger` + `AlertDialogContent` (`headline`, `icon`, `actions`) + `AlertDialogClose`. Controlled with `open` / `onOpenChange` on the root.

```tsx
;<AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogContent
        headline="Delete recipe?"
        actions={
            <>
                <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                <Button variant="text" onClick={remove}>
                    Delete
                </Button>
            </>
        }
    />
</AlertDialog>
```

### BottomSheet, SideSheet

`@/components/ui/bottom-sheet`: `BottomSheet` (Base UI Drawer root: `open`, `onOpenChange`, `modal`, `snapPoints`, `snapPoint`) holds `BottomSheetTrigger` and `BottomSheetContent` (`title`, `hideTitle`, `standard`). Dragging dismisses with velocity. `@/components/ui/side-sheet`: `SideSheet`, `SideSheetTrigger`, `SideSheetContent` (`title`, `actions`).

### Snackbar `@/components/ui/snackbar`

`SnackbarProvider` is mounted in the root layout. `const snackbar = useSnackbar()` takes either a string or an options object: `snackbar('Saved')` or `snackbar({ message, action, onAction, onClose, closable, duration, urgent })`. Pressing the action runs `onAction` and dismisses the snackbar. `onClose(reason)` runs once with `'timeout' | 'action' | 'dismiss' | 'swipe'`. Snackbars queue and show one at a time. Swipe dismisses them. Timers pause on hover, focus and a hidden tab. Lift them above a bottom bar with `--md-snackbar-offset`.

### Tooltip, RichTooltip `@/components/ui/tooltip`

`<Tooltip content="Share"><IconButton .../></Tooltip>`. After the first tooltip opens, its neighbors open instantly. `RichTooltip` takes `subhead`, `text` and `actions`; it is a popover that opens on hover or press.

### Tabs `@/components/ui/tabs`

`Tabs` (`value` / `defaultValue` / `onValueChange`) holds `TabList` (`variant`: primary | secondary, `scrollable`, `label`), `Tab` (`value`, `icon`) and `TabPanel` (`value`). The indicator slides on the default spatial spring.

### Carousel `@/components/ui/carousel`

`label`, `variant`: multi-browse | hero | uncontained. Each child is one item. It uses scroll snapping, focus plus arrow keys, and prev/next buttons on pointer devices. Sizing: `--md-carousel-height`, `--md-carousel-inset`, `--md-carousel-item-width`.

### Shape, MorphShape `@/components/ui/shape`

`<Shape name="cookie9" size={96} />` draws one of all 35 MaterialShapes (`SHAPES`) in currentColor. Give it children to mask them to the shape: `<Shape name="clover4" size={56}><img/></Shape>`. `shapeMask(name)` returns a CSS mask value. `<MorphShape shape={name} spring="spatial-default" />` springs to each new shape.

### Badge, Avatar, Divider, Skeleton, EmptyState, Kbd, VisuallyHidden, Ripple

- `Badge`: `value`, `max`, `label`. A dot without `value`.
- `Avatar`: `src`, `name`, `size`, `shape` (any MaterialShape).
- `Divider`: `vertical`, `inset`. Full width only.
- `Skeleton`: `width`, `height`, `shape`: text | rect | circle | pill | small | medium | large | extra-large, `lines`. Mark the loading region `aria-busy`.
- `EmptyState`: `shape`, `icon`, `title`, `description`, `action`, `titleAs` (h1, h2 default, h3, p).
- `Kbd`, `VisuallyHidden`.
- `Ripple`: drop it in any `position: relative` interactive element for the M3 press ripple. It also sets `data-ripple-pressed` on that element.
