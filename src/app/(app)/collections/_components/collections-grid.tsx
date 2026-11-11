'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { PageTransition, TransitionLink, useViewTransitionRouter } from '@/components/ui/view-transition'
import type { Collection } from '@/lib/domain/types'
import { CollectionNameDialog, DeleteCollectionDialog, type NameDialogTarget } from './collection-dialogs'
import { CollectionMosaic } from './collection-mosaic'
import styles from './collections-grid.module.scss'

interface CollectionsGridProps {
    collections: Collection[]
    icons: { add: ReactNode; more: ReactNode; edit: ReactNode; delete: ReactNode; empty: ReactNode }
}

const countLabel = (n: number) => (n === 1 ? '1 recipe' : `${n} recipes`)

export function CollectionsGrid({ collections, icons }: CollectionsGridProps) {
    const router = useViewTransitionRouter()
    const [nameTarget, setNameTarget] = useState<NameDialogTarget | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
    const create = () => setNameTarget({ mode: 'create', key: Date.now() })
    const sorted = collections.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    return (
        <PageTransition>
            <div className={styles.page}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Collections</h1>
                    {collections.length > 0 && (
                        <Button variant="tonal" icon={icons.add} onClick={create}>
                            New collection
                        </Button>
                    )}
                </header>

                {sorted.length === 0 ? (
                    <EmptyState
                        className={styles.empty}
                        shape="clover8"
                        icon={icons.empty}
                        title="No collections yet"
                        titleAs="h2"
                        action={
                            <Button icon={icons.add} onClick={create}>
                                New collection
                            </Button>
                        }
                    />
                ) : (
                    <ul className={styles.grid} aria-label="Collections">
                        {sorted.map((c) => (
                            <li key={c.id} className={styles.card}>
                                <CollectionMosaic name={c.name} thumbnails={c.coverThumbnails} />
                                <div className={styles.text}>
                                    <h2 className={styles.name}>
                                        <TransitionLink href={`/collections/${c.id}`} className={styles.link}>
                                            {c.name}
                                        </TransitionLink>
                                    </h2>
                                    <p className={styles.count}>{countLabel(c.recipeCount)}</p>
                                </div>
                                <Menu>
                                    <MenuTrigger
                                        render={
                                            <IconButton
                                                className={styles.more}
                                                label={`More for ${c.name}`}
                                                size="xs"
                                                icon={icons.more}
                                            />
                                        }
                                    />
                                    <MenuContent align="end">
                                        <MenuItem
                                            icon={icons.edit}
                                            onClick={() =>
                                                setNameTarget({
                                                    mode: 'rename',
                                                    key: Date.now(),
                                                    id: c.id,
                                                    name: c.name,
                                                })
                                            }
                                        >
                                            Rename
                                        </MenuItem>
                                        <MenuItem
                                            icon={icons.delete}
                                            onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                                        >
                                            Delete
                                        </MenuItem>
                                    </MenuContent>
                                </Menu>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <CollectionNameDialog
                target={nameTarget}
                onClose={() => setNameTarget(null)}
                onCreated={(id) => router.push(`/collections/${id}`)}
            />
            <DeleteCollectionDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
        </PageTransition>
    )
}
