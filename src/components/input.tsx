import React from 'react'
import styles from '@/styles/Components.module.scss'
import { Icon } from "@/components/icon"

interface ComponentProps {
    label: string
    name: string
    type: string
    defaultValue?: string
    icon?: string
    fullwidth?: boolean
}

export class Input extends React.Component<ComponentProps & React.HTMLProps<HTMLInputElement>, {}> {
    render() {
        return (
            <div className={`${styles.input} ${this.props.icon ? styles.icon : ""} ${this.props.className}`} style={this.props.fullwidth ? { width: "100%" } : {}}>
                {this.props.icon ? <Icon name={this.props.icon} iconsize="24" className={styles.icon} /> : null}
                <input {...this.props} type={this.props.type} defaultValue={this.props.defaultValue} placeholder=" " required />
                <label htmlFor={this.props.name}>{this.props.label}</label>
            </div>
        )
    }
}