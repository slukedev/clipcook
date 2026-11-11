import type { ReactElement } from 'react'
import { Icon } from '@/components/ui/icon'
import { PrintIcon } from './print-icon'

// Icons are drawn on the server and handed to client components as elements, so the
// full Material Symbols map never reaches the browser.

export function recipeIcons() {
    return {
        back: <Icon name="arrow_back" />,
        close: <Icon name="close" />,
        favorite: <Icon name="favorite" />,
        favoriteFilled: <Icon name="favorite" filled />,
        cast: <Icon name="cast" />,
        castConnected: <Icon name="cast_connected" />,
        more: <Icon name="more_vert" />,
        edit: <Icon name="edit" />,
        copy: <Icon name="content_copy" />,
        folder: <Icon name="folder" />,
        share: <Icon name="share" />,
        print: <PrintIcon />,
        delete: <Icon name="delete" />,
        cart: <Icon name="add_shopping_cart" />,
        timer: <Icon name="timer" />,
        play: <Icon name="play_arrow" filled />,
        pause: <Icon name="pause" filled />,
        check: <Icon name="check" />,
        add: <Icon name="add" />,
        cook: <Icon name="skillet" />,
        tv: <Icon name="tv" />,
        list: <Icon name="checklist" />,
        mic: <Icon name="mic" />,
        micOff: <Icon name="mic_off" />,
        volume: <Icon name="volume_up" />,
        next: <Icon name="arrow_forward" />,
        done: <Icon name="done_all" />,
        restart: <Icon name="restart_alt" />,
    } satisfies Record<string, ReactElement>
}

export type RecipeIcons = ReturnType<typeof recipeIcons>
