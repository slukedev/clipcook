/**
 * Inlines the Material Symbols the app uses (Rounded, weight 400, outline and fill)
 * from @material-symbols/svg-400 into src/components/ui/icon/icon-paths.ts.
 *
 *   npm run generate:icons
 *
 * Inline paths cost a few bytes per icon; the variable icon font costs megabytes,
 * a render-blocking request and a flash of ligature text.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ICONS = [
    // Navigation and app structure
    'home',
    'library_books',
    'local_library',
    'collections_bookmark',
    'dashboard',
    'apps',
    'menu',
    'menu_open',
    'arrow_back',
    'arrow_forward',
    'arrow_upward',
    'arrow_downward',
    'arrow_drop_down',
    'chevron_left',
    'chevron_right',
    'keyboard_arrow_down',
    'keyboard_arrow_up',
    'unfold_more',
    'open_in_new',
    'open_in_browser',
    'fullscreen',
    'fullscreen_exit',
    'more_vert',
    'more_horiz',
    'close',
    'cancel',
    'search',
    'search_off',
    'travel_explore',
    'settings',
    'help',
    'history',
    // Actions
    'add',
    'remove',
    'check',
    'done_all',
    'edit',
    'delete',
    'delete_sweep',
    'undo',
    'redo',
    'refresh',
    'restart_alt',
    'send',
    'share',
    'ios_share',
    'print',
    'content_copy',
    'content_paste',
    'link',
    'add_link',
    'download',
    'upload',
    'sort',
    'filter_list',
    'tune',
    'grid_view',
    'view_agenda',
    'view_list',
    'drag_indicator',
    'drag_handle',
    'format_list_bulleted',
    'format_list_numbered',
    'note_add',
    'code',
    'bug_report',
    // Settings
    'animation',
    'description',
    'install_desktop',
    // Library organisation
    'bookmark',
    'bookmarks',
    'bookmark_add',
    'bookmark_remove',
    'favorite',
    'star',
    'label',
    'label_off',
    'new_label',
    'sell',
    'tag',
    'folder',
    'folder_open',
    'inventory_2',
    'playlist_add',
    'playlist_add_check',
    // Grocery
    'shopping_cart',
    'add_shopping_cart',
    'remove_shopping_cart',
    'shopping_basket',
    'grocery',
    'checklist',
    'cleaning_services',
    // Cooking
    'kitchen',
    'restaurant',
    'fork_spoon',
    'local_dining',
    'menu_book',
    'skillet',
    'oven_gen',
    'blender',
    'outdoor_grill',
    'soup_kitchen',
    'local_fire_department',
    'timer',
    'timer_off',
    'alarm',
    'hourglass_empty',
    'schedule',
    'speed',
    'scale',
    'straighten',
    'nutrition',
    'egg',
    'eco',
    'bakery_dining',
    'local_cafe',
    'ramen_dining',
    'cookie',
    'cake',
    'lunch_dining',
    'dinner_dining',
    'breakfast_dining',
    'tapas',
    'icecream',
    'liquor',
    'set_meal',
    'rice_bowl',
    'notes',
    'sticky_note_2',
    'bolt',
    // Playback and cook mode
    'play_arrow',
    'pause',
    'skip_next',
    'skip_previous',
    'mic',
    'mic_off',
    'volume_up',
    'lightbulb',
    // Displays and devices
    'cast',
    'cast_connected',
    'tv',
    'devices',
    'devices_other',
    'smart_display',
    'qr_code_2',
    'mobile',
    'tablet',
    'desktop_windows',
    // Media
    'image',
    'photo_library',
    'add_a_photo',
    'photo_camera',
    // Appearance and account
    'palette',
    'contrast',
    'dark_mode',
    'light_mode',
    'brightness_auto',
    'language',
    'person',
    'person_add',
    'account_circle',
    'logout',
    'lock',
    'visibility',
    'visibility_off',
    'public',
    // Status
    'info',
    'warning',
    'error',
    'check_circle',
    'radio_button_checked',
    'circle',
    'cloud_off',
    'wifi_off',
] as const

/** Familiar names that Material Symbols spells differently. */
const ALIASES: Record<string, (typeof ICONS)[number]> = {
    expand_more: 'keyboard_arrow_down',
    expand_less: 'keyboard_arrow_up',
    library: 'library_books',
    restaurant_menu: 'menu_book',
    local_grocery_store: 'shopping_basket',
    phone_iphone: 'mobile',
    wake: 'lightbulb',
}

const dir = join(process.cwd(), 'node_modules', '@material-symbols', 'svg-400', 'rounded')

// One decimal in a 960-unit box is a fortieth of a pixel at 24px; the source
// carries two, which doubles the bytes for nothing visible.
function compact(d: string): string {
    return d
        .replace(/-?\d*\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10))
        .replace(/(\d)\s+(-)/g, '$1$2')
        .replace(/([A-Za-z])\s+/g, '$1')
        .replace(/0\.(\d)/g, (m, d1, offset, all) => (/[\d.]/.test(all[offset - 1] ?? '') ? m : `.${d1}`))
}

function pathOf(file: string): string {
    const svg = readFileSync(join(dir, file), 'utf8')
    const paths = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => compact(m[1] ?? ''))
    if (paths.length === 0) throw new Error(`No path data in ${file}`)
    return paths.join(' ')
}

const entry = (key: string, name: string) =>
    `    ${key}: ['${pathOf(`${name}.svg`)}', '${pathOf(`${name}-fill.svg`)}'],`
const lines = ICONS.map((name) => entry(name, name))
for (const [alias, target] of Object.entries(ALIASES)) lines.push(entry(alias, target))

const out = `// Generated by scripts/generate-icons.ts. Do not edit by hand.
// Material Symbols Rounded, weight 400, Apache-2.0, Google. viewBox 0 -960 960 960.
// Each entry is [outline, fill].

export const ICON_PATHS = {
${lines.join('\n')}
} as const satisfies Record<string, readonly [string, string]>

export type IconName = keyof typeof ICON_PATHS
`

const outFile = join(process.cwd(), 'src', 'components', 'ui', 'icon', 'icon-paths.ts')
writeFileSync(outFile, out)

// The handful of glyphs client components draw themselves, so they never pull in the full map.
const GLYPHS = [
    'check',
    'close',
    'add',
    'remove',
    'arrow_drop_down',
    'keyboard_arrow_down',
    'chevron_right',
    'menu',
    'menu_open',
    'search',
    'arrow_back',
    'more_vert',
] as const
const glyphs = `// Generated by scripts/generate-icons.ts. Do not edit by hand.
// Outline paths for glyphs drawn inside client components. viewBox 0 -960 960 960.

export const GLYPHS = {
${GLYPHS.map((name) => `    ${name}: '${pathOf(`${name}.svg`)}',`).join('\n')}
} as const

export type GlyphName = keyof typeof GLYPHS
`
writeFileSync(join(process.cwd(), 'src', 'components', 'ui', 'icon', 'glyphs.ts'), glyphs)
console.log(`Wrote ${outFile} (${ICONS.length} icons, ${Object.keys(ALIASES).length} aliases)`)
