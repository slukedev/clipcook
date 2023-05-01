import React from 'react'

interface ComponentProps {
    name: string
    fill?: "0" | "1"
    weight?: "100" | "200" | "300" | "400" | "500" | "600" | "700"
    grade?: string
    iconsize?: string
    color?: string
}

export class Icon extends React.Component<ComponentProps & React.HTMLProps<HTMLSpanElement>, {}> {
    render() {
        return (
            <span style={{ fontVariationSettings: `'FILL' ${this.props.fill || 0}, 'wght' ${this.props.weight || 400},'GRAD' ${this.props.grade || 0}, 'opsz' ${this.props.iconsize || 48}`, fontSize: `${this.props.iconsize || 48}px`, color: this.props.color }} {...this.props} className={`material-symbols-outlined ${this.props.className}`}>
                {this.props.name}
            </span>
        )
    }
}