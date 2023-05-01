import React from 'react'
import styles from '@/styles/Components.module.scss'

interface ComponentProps {
    inputid: string
}

export class Checkbox extends React.Component<ComponentProps & React.HTMLProps<HTMLInputElement>, {}> {
    render() {
        return (
            <div className={styles.checkboxContainer}>
                <input type="checkbox" id={this.props.inputid} {...this.props} />
                <label htmlFor={this.props.inputid}>
                    <svg viewBox="0 0 24 24">
                        <path fill="none" stroke="white" d="M1.73,12.91 8.1,19.28 22.79,4.59"></path>
                    </svg>
                </label>
            </div>
        )
    }
}