import type { ReactElement } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'

// Rendered on the server and passed down, so client bundles never carry the icon map.
const NAMES = {
    add: 'add',
    addPhoto: 'add_a_photo',
    camera: 'photo_camera',
    close: 'close',
    collection: 'collections_bookmark',
    delete: 'delete',
    down: 'arrow_downward',
    drag: 'drag_indicator',
    edit: 'edit',
    heading: 'label',
    image: 'photo_library',
    link: 'link',
    addLink: 'add_link',
    more: 'more_vert',
    paste: 'content_paste',
    tag: 'sell',
    up: 'arrow_upward',
    step: 'format_list_numbered',
    ingredient: 'format_list_bulleted',
    openInNew: 'open_in_new',
    refresh: 'refresh',
    notes: 'notes',
    schedule: 'schedule',
    servings: 'restaurant',
    library: 'library_books',
    offline: 'cloud_off',
    blocked: 'lock',
    searchOff: 'search_off',
    bookmark: 'bookmark_add',
    error: 'error',
    check: 'check',
    write: 'edit',
    text: 'sticky_note_2',
} as const satisfies Record<string, IconName>

export type EditorIcons = { -readonly [K in keyof typeof NAMES]: ReactElement }

export function editorIcons(): EditorIcons {
    return Object.fromEntries(
        Object.entries(NAMES).map(([key, name]) => [key, <Icon key={key} name={name} />]),
    ) as EditorIcons
}
