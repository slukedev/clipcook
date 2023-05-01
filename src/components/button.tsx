import React from 'react'
import styles from '@/styles/Components.module.scss'
import { Ripple } from './ripple'

interface ComponentProps {
    disabled?: boolean
}

export class Button extends React.Component<ComponentProps & React.HTMLAttributes<HTMLButtonElement>, {}> {
    render() {
        return (
            <Ripple feather="5px" style={{ borderRadius: 20 }}>
                <button className={styles.button} {...this.props}>
                    {this.props.children}
                </button>
            </Ripple>
        )
    }
}