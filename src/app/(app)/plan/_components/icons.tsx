import type { ReactElement } from 'react'
import { Icon } from '@/components/ui/icon'

// Drawn on the server and handed to the planner's client islands as elements, so the
// full symbol map never reaches the browser.

export function planIcons() {
    return {
        add: <Icon name="add" />,
        previous: <Icon name="chevron_left" />,
        next: <Icon name="chevron_right" />,
        more: <Icon name="more_vert" />,
        cook: <Icon name="skillet" />,
        cart: <Icon name="add_shopping_cart" />,
        copy: <Icon name="content_copy" />,
        clear: <Icon name="delete_sweep" />,
        open: <Icon name="menu_book" />,
        move: <Icon name="event_repeat" />,
        meal: <Icon name="restaurant" />,
        servings: <Icon name="group" />,
        remove: <Icon name="delete" />,
        note: <Icon name="sticky_note_2" />,
        eatOut: <Icon name="takeout_dining" />,
        check: <Icon name="check" />,
        search: <Icon name="search" />,
        link: <Icon name="link" />,
        today: <Icon name="today" />,
        calendar: <Icon name="calendar_month" />,
        planAdd: <Icon name="calendar_add_on" />,
    } satisfies Record<string, ReactElement>
}

export type PlanIcons = ReturnType<typeof planIcons>
