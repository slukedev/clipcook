import { Icon } from '@/components/ui/icon'

/**
 * Icons the library's client islands draw, rendered on the server so the client
 * bundle does not carry the whole symbol map.
 */
export function libraryIcons() {
    return {
        favorite: <Icon name="favorite" />,
        favoriteFilled: <Icon name="favorite" filled />,
        more: <Icon name="more_vert" />,
        sort: <Icon name="sort" />,
        grid: <Icon name="grid_view" />,
        list: <Icon name="view_agenda" />,
        tag: <Icon name="sell" />,
        collection: <Icon name="bookmark_add" />,
        copy: <Icon name="content_copy" />,
        delete: <Icon name="delete" />,
        select: <Icon name="check_circle" />,
        selectAll: <Icon name="done_all" />,
        close: <Icon name="close" />,
        remove: <Icon name="bookmark_remove" />,
        add: <Icon name="add" />,
        link: <Icon name="link" />,
        paste: <Icon name="content_paste" />,
        edit: <Icon name="edit" />,
        book: <Icon name="menu_book" />,
        searchOff: <Icon name="search_off" />,
        dish: <Icon name="restaurant" />,
        timer: <Icon name="schedule" />,
        history: <Icon name="history" />,
    }
}

export type LibraryIcons = ReturnType<typeof libraryIcons>
