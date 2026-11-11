import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Shape } from '@/components/ui/shape'
import styles from './displays.module.scss'

interface Props {
    host: string
    castEnabled: boolean
    icons: { link: ReactNode; echo: ReactNode; nest: ReactNode; tablet: ReactNode }
}

/** How to pair: two steps, then one line per kind of device. */
export function AddDisplaySteps({ host, castEnabled, icons }: Props) {
    const address = `${host}/display`
    return (
        <div className={styles.steps}>
            <ol className={styles.stepList}>
                <li className={styles.step}>
                    <span className={styles.stepBadge} aria-hidden>
                        <Shape name="cookie4" className={styles.stepShape} />
                        <span>1</span>
                    </span>
                    <div className={styles.stepBody}>
                        <p>On the display, open</p>
                        <p className={styles.address}>{address}</p>
                    </div>
                </li>
                <li className={styles.step}>
                    <span className={styles.stepBadge} aria-hidden>
                        <Shape name="clover4" className={styles.stepShape} />
                        <span>2</span>
                    </span>
                    <div className={styles.stepBody}>
                        <p>Enter the code it shows</p>
                        <Button
                            variant="tonal"
                            icon={icons.link}
                            render={<Link href="/link" />}
                            nativeButton={false}
                            className={styles.stepAction}
                        >
                            Enter code
                        </Button>
                    </div>
                </li>
            </ol>
            <ul className={styles.hints}>
                <li className={styles.hint}>
                    <span className={styles.hintIcon} aria-hidden>
                        {icons.echo}
                    </span>
                    <p>
                        <strong>Echo Show</strong> Say “Alexa, open Silk”, then go to {address}
                    </p>
                </li>
                {castEnabled && (
                    <li className={styles.hint}>
                        <span className={styles.hintIcon} aria-hidden>
                            {icons.nest}
                        </span>
                        <p>
                            <strong>Nest Hub</strong> Open a recipe in Chrome and tap Cast
                        </p>
                    </li>
                )}
                <li className={styles.hint}>
                    <span className={styles.hintIcon} aria-hidden>
                        {icons.tablet}
                    </span>
                    <p>
                        <strong>Tablet or TV</strong> Open the address, then add it to the home screen
                    </p>
                </li>
            </ul>
        </div>
    )
}
