'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { PageTransition, TransitionLink, useViewTransitionRouter } from '@/components/ui/view-transition'
import type { RecipeSummary } from '@/lib/domain/types'
import { writeCookie } from '../../_shell/preferences'
import type { CollectionRef } from '../../_library/collection-dialog'
import type { LibraryIcons } from '../../_library/icons'
import { LIBRARY_COOKIE, type LibraryPrefs, serializeLibraryPrefs, sortRecipes } from '../../_library/library-data'
import { RecipeBrowser } from '../../_library/recipe-browser'
import { useLibraryRecipes } from '../../_library/use-library-recipes'
import { CollectionNameDialog, DeleteCollectionDialog, type NameDialogTarget } from './collection-dialogs'
import { RecipePicker, type PickerTarget } from './recipe-picker'
import styles from './collection-view.module.scss'

interface CollectionViewProps {
    collection: CollectionRef
    /** The whole library: members render here, the rest feed the picker. */
    recipes: RecipeSummary[]
    collections: CollectionRef[]
    prefs: LibraryPrefs
    icons: LibraryIcons
    backIcon: ReactNode
    searchIcon: ReactNode
}

export function CollectionView({
    collection,
    recipes: serverRecipes,
    collections,
    prefs: initialPrefs,
    icons,
    backIcon,
    searchIcon,
}: CollectionViewProps) {
    const router = useViewTransitionRouter()
    const { recipes, toggleFavorite } = useLibraryRecipes(serverRecipes)
    const [prefs, setPrefs] = useState(initialPrefs)
    const [nameTarget, setNameTarget] = useState<NameDialogTarget | null>(null)
    const [deleting, setDeleting] = useState<CollectionRef | null>(null)
    const [picker, setPicker] = useState<PickerTarget | null>(null)
    const members = sortRecipes(
        recipes.filter((r) => r.collectionIds.includes(collection.id)),
        prefs.sort,
    )
    const openPicker = () => setPicker({ key: Date.now() })

    const toggleView = () => {
        const next = { ...prefs, view: prefs.view === 'grid' ? ('list' as const) : ('grid' as const) }
        setPrefs(next)
        writeCookie(LIBRARY_COOKIE, serializeLibraryPrefs(next))
    }

    return (
        <PageTransition>
            <div className={styles.page}>
                <header className={styles.header}>
                    <IconButton
                        className={styles.back}
                        label="Collections"
                        icon={backIcon}
                        render={<TransitionLink href="/collections" direction="back" />}
                        nativeButton={false}
                    />
                    <h1 className={styles.title}>{collection.name}</h1>
                    <div className={styles.actions}>
                        {members.length > 0 && (
                            <Button variant="tonal" icon={icons.add} onClick={openPicker} className={styles.addButton}>
                                Add recipes
                            </Button>
                        )}
                        {members.length > 0 && (
                            <IconButton
                                label={prefs.view === 'grid' ? 'Show as list' : 'Show as grid'}
                                icon={prefs.view === 'grid' ? icons.list : icons.grid}
                                onClick={toggleView}
                            />
                        )}
                        <Menu>
                            <MenuTrigger render={<IconButton label="More" icon={icons.more} />} />
                            <MenuContent align="end">
                                {members.length > 0 && (
                                    <MenuItem icon={icons.add} onClick={openPicker} className={styles.menuAdd}>
                                        Add recipes
                                    </MenuItem>
                                )}
                                <MenuItem
                                    icon={icons.edit}
                                    onClick={() =>
                                        setNameTarget({
                                            mode: 'rename',
                                            key: Date.now(),
                                            id: collection.id,
                                            name: collection.name,
                                        })
                                    }
                                >
                                    Rename
                                </MenuItem>
                                <MenuItem icon={icons.delete} onClick={() => setDeleting(collection)}>
                                    Delete
                                </MenuItem>
                            </MenuContent>
                        </Menu>
                    </div>
                </header>

                {members.length > 0 ? (
                    <RecipeBrowser
                        recipes={members}
                        view={prefs.view}
                        tokens={[]}
                        icons={icons}
                        collections={collections}
                        collection={collection}
                        onFavorite={toggleFavorite}
                        label={collection.name}
                    />
                ) : (
                    <EmptyState
                        className={styles.empty}
                        shape="flower"
                        icon={icons.book}
                        title="Nothing here yet"
                        titleAs="h2"
                        action={
                            <Button icon={icons.add} onClick={openPicker} disabled={recipes.length === 0}>
                                Add recipes
                            </Button>
                        }
                    />
                )}
            </div>
            <RecipePicker
                target={picker}
                onClose={() => setPicker(null)}
                collection={collection}
                recipes={recipes}
                searchIcon={searchIcon}
            />
            <CollectionNameDialog target={nameTarget} onClose={() => setNameTarget(null)} />
            <DeleteCollectionDialog
                target={deleting}
                onClose={() => setDeleting(null)}
                onDeleted={() => router.replace('/collections', 'back')}
            />
        </PageTransition>
    )
}
