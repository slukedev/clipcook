import React from 'react'
import styles from '@/styles/Components.module.scss'
import Link from 'next/link'
import { Ripple } from './ripple'

interface ComponentProps {
    id: string
    image: string
    title: string
    boldindexes: number[]
}

export class Recipe extends React.Component<ComponentProps & React.HTMLProps<HTMLInputElement>, {}> {
    render() {
        const imagestyle = {
            backgroundImage: `url("${this.props.image}")`
        }

        return (
            <Ripple speedms={500} feather="20px" style={{ borderRadius: 12 }} className={styles.recipeContainer}>
                <Link style={{ width: 'fit-content', display: 'block' }} href={`/recipe/${this.props.id}`} passHref>
                    <div className={styles.recipe}>
                        <div className={styles.recipeImage} style={imagestyle}>
                        </div>
                        <div className={styles.recipeContent}>
                            <h2 className={styles.recipeTitle}>{
                                this.props.title.split('').map((char, index) => {
                                    if (this.props.boldindexes.includes(index)) {
                                        return <b style={{ color: "var(--md-sys-color-primary)" }} key={index}>{char}</b>
                                    } else {
                                        return char
                                    }
                                })
                            }</h2>
                        </div>
                    </div>
                </Link>
            </Ripple >
        )
    }
}