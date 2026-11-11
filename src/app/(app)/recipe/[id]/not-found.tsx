import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'
import styles from './_view/not-found.module.scss'

/** A recipe that does not exist or belongs to someone else. Renders inside the app shell's main. */
export default function RecipeNotFound() {
    return (
        <div className={styles.root}>
            <EmptyState
                shape="soft-burst"
                icon={<Icon name="search_off" />}
                title="Recipe not found"
                titleAs="h1"
                description="It may have been deleted."
                action={
                    <Button icon={<Icon name="arrow_back" />} render={<Link href="/" />} nativeButton={false}>
                        Back to library
                    </Button>
                }
            />
        </div>
    )
}
