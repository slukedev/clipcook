import React from 'react'
import styles from '@/styles/Components.module.scss'

export class Spinner extends React.Component<React.HTMLProps<HTMLDivElement>, {}> {
    render() {
        return (
            <div className={styles.spinner} {...this.props}>
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="20" />
                </svg>
            </div>
        )
    }
}