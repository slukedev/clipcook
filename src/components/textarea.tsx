import React from 'react'
import styles from '@/styles/Components.module.scss'
import { Icon } from "@/components/icon"

interface ComponentProps {
    label: string
    name: string
    defaultValue?: string
    icon?: string
    fullwidth?: boolean
}

export class Textarea extends React.Component<ComponentProps & React.HTMLProps<HTMLTextAreaElement>, {}> {
    render() {
        return (
            <div className={`${styles.input} ${styles.textarea} ${this.props.icon ? styles.icon : ""} ${this.props.className}`} style={this.props.fullwidth ? { width: "100%" } : {}}>
                {this.props.icon ? <Icon name={this.props.icon} iconsize="24" className={styles.icon} /> : null}
                <textarea {...this.props} defaultValue={this.props.defaultValue} placeholder=" " required />
                <label htmlFor={this.props.name}>{this.props.label}</label>
            </div>
        )
    }
}