import { Skeleton } from '@/components/ui/skeleton'
import styles from './editor-skeleton.module.scss'
import editor from './recipe-editor.module.scss'

const ROWS = ['a', 'b', 'c', 'd']
const LISTS = ['Ingredients', 'Steps']

/** Matches the editor layout while the route loads. */
export function EditorSkeleton({ heading }: { heading: string }) {
    return (
        <section className={editor.editor} aria-busy="true" aria-label={heading}>
            <div className={styles.bar}>
                <Skeleton shape="circle" width={40} height={40} />
                <span className={styles.heading}>{heading}</span>
                <Skeleton shape="pill" width={76} height={40} />
            </div>
            <div className={editor.body}>
                <div className={editor.core}>
                    <Skeleton shape="extra-large" className={styles.photo} />
                    <Skeleton shape="small" height={56} />
                    <Skeleton shape="small" height={80} />
                    <div className={editor.times}>
                        {ROWS.map((k) => (
                            <Skeleton key={k} shape="small" height={56} />
                        ))}
                    </div>
                </div>
                <div className={editor.lists}>
                    {LISTS.map((title) => (
                        <div key={title} className={styles.list}>
                            <span className={styles.title}>{title}</span>
                            {ROWS.map((k) => (
                                <Skeleton key={k} shape="medium" height={56} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
