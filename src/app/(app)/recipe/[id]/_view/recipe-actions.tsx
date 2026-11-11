'use client'

import Link from 'next/link'
import { type ReactNode, useOptimistic, useState, useTransition } from 'react'
import { deleteRecipe, duplicateRecipe, setFavorite } from '@/actions/recipes'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogClose, AlertDialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useSnackbar } from '@/components/ui/snackbar'
import { Tooltip } from '@/components/ui/tooltip'
import { useViewTransitionRouter } from '@/components/ui/view-transition'
import { recipeText } from '@/lib/cook/content'
import { recipeScale } from '@/lib/cook/recipe-state'
import { AddToPlanSheet } from '../../../plan/_components/add-to-plan-sheet'
import { CollectionsDialog } from './collections-dialog'
import { SendToDisplay } from './send-to-display'
import type { CollectionOption, DisplayOption } from './types'

type IconKey =
    | 'favorite'
    | 'favoriteFilled'
    | 'cast'
    | 'castConnected'
    | 'more'
    | 'edit'
    | 'copy'
    | 'folder'
    | 'share'
    | 'print'
    | 'delete'
    | 'add'
    | 'tv'
    | 'plan'

export interface ActionRecipe {
    id: string
    title: string
    favorite: boolean
    collectionIds: string[]
    sourceUrl: string | null
    servings: string
    ingredients: string[]
    instructions: string[]
    notes: string
}

/** Favorite, Send to display and the overflow menu, with the dialogs they open. */
export function RecipeActions({
    recipe,
    displays,
    collections,
    icons,
    castSlot,
}: {
    recipe: ActionRecipe
    displays: DisplayOption[]
    collections: CollectionOption[]
    icons: Record<IconKey, ReactNode>
    castSlot?: ReactNode
}) {
    const router = useViewTransitionRouter()
    const snackbar = useSnackbar()
    const [favorite, setOptimisticFavorite] = useOptimistic(recipe.favorite)
    const [, startFavorite] = useTransition()
    const [busy, startBusy] = useTransition()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [collectionsOpen, setCollectionsOpen] = useState(false)
    // A fresh key per opening resets the dialog's picks while keeping its exit animation.
    const [collectionsKey, setCollectionsKey] = useState(0)
    const [planOpen, setPlanOpen] = useState(false)
    const [planKey, setPlanKey] = useState(0)

    const toggleFavorite = (value: boolean) => {
        startFavorite(async () => {
            setOptimisticFavorite(value)
            const result = await setFavorite(recipe.id, value)
            if (!result.ok) snackbar({ message: "Couldn't update favorites. Try again.", urgent: true })
        })
    }

    const duplicate = () => {
        startBusy(async () => {
            const result = await duplicateRecipe(recipe.id)
            if (!result.ok) {
                snackbar({ message: result.error, urgent: true })
                return
            }
            router.push(`/recipe/${result.data}`, 'forward')
            snackbar('Duplicated')
        })
    }

    const share = async () => {
        const text = recipeText(recipe, recipeScale.get(recipe.id))
        const data: ShareData = recipe.sourceUrl
            ? { title: recipe.title, url: recipe.sourceUrl }
            : { title: recipe.title, text }
        try {
            if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
                await navigator.share(data)
                return
            }
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return
        }
        try {
            await navigator.clipboard.writeText(recipe.sourceUrl ? `${recipe.title}\n${recipe.sourceUrl}` : text)
            snackbar('Copied')
        } catch {
            snackbar({ message: "Couldn't share. Try copying the page address.", urgent: true })
        }
    }

    const remove = () => {
        setConfirmDelete(false)
        // Leave first, so this page never renders its own not-found state.
        router.replace('/', 'back')
        void deleteRecipe(recipe.id).then((result) => {
            snackbar(result.ok ? 'Recipe deleted' : { message: result.error, urgent: true })
        })
    }

    return (
        <>
            <Tooltip content={favorite ? 'Remove from favorites' : 'Add to favorites'}>
                <IconButton
                    label="Favorite"
                    icon={icons.favorite}
                    selectedIcon={icons.favoriteFilled}
                    selected={favorite}
                    onSelectedChange={toggleFavorite}
                />
            </Tooltip>
            <SendToDisplay
                recipeId={recipe.id}
                displays={displays}
                icons={{ cast: icons.cast, castConnected: icons.castConnected, tv: icons.tv }}
                castSlot={castSlot}
            />
            <Menu>
                <MenuTrigger
                    render={<IconButton label="More options" icon={icons.more} aria-busy={busy || undefined} />}
                />
                <MenuContent align="end">
                    <MenuLinkItem icon={icons.edit} render={<Link href={`/recipe/${recipe.id}/edit`} />}>
                        Edit
                    </MenuLinkItem>
                    <MenuItem icon={icons.copy} onClick={duplicate} disabled={busy}>
                        Duplicate
                    </MenuItem>
                    <MenuItem
                        icon={icons.folder}
                        onClick={() => {
                            setCollectionsKey((k) => k + 1)
                            setCollectionsOpen(true)
                        }}
                    >
                        Add to collection
                    </MenuItem>
                    <MenuItem
                        icon={icons.plan}
                        onClick={() => {
                            setPlanKey((k) => k + 1)
                            setPlanOpen(true)
                        }}
                    >
                        Add to plan
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem icon={icons.share} onClick={share}>
                        Share
                    </MenuItem>
                    <MenuItem icon={icons.print} onClick={() => window.print()}>
                        Print
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem icon={icons.delete} onClick={() => setConfirmDelete(true)}>
                        Delete
                    </MenuItem>
                </MenuContent>
            </Menu>
            {collectionsKey > 0 && (
                <CollectionsDialog
                    key={collectionsKey}
                    open={collectionsOpen}
                    onOpenChange={setCollectionsOpen}
                    recipeId={recipe.id}
                    initial={recipe.collectionIds}
                    collections={collections}
                    addIcon={icons.add}
                />
            )}
            {planKey > 0 && (
                <AddToPlanSheet
                    key={planKey}
                    open={planOpen}
                    onOpenChange={setPlanOpen}
                    recipe={recipe}
                    scale={recipeScale.get(recipe.id)}
                />
            )}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent
                    headline="Delete Recipe?"
                    actions={
                        <>
                            <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                            <Button variant="text" onClick={remove}>
                                Delete
                            </Button>
                        </>
                    }
                >
                    {`“${recipe.title}” and its photo will be removed from your library.`}
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
