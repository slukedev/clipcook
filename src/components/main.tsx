import React from 'react'
import styles from '@/styles/Home.module.scss'
import { Topnav } from './topnav'
import { motion } from 'framer-motion'

interface ComponentProps {
    pageName: string
    children: React.ReactNode
    photoUrl?: string
    useSvgLogo?: boolean
}

export class Main extends React.Component<ComponentProps> {
    render() {
        return (
            <>
                <Topnav photoUrl={this.props.photoUrl} useSvgLogo={this.props.useSvgLogo} />
                <motion.main initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }} key={this.props.pageName} className={`${styles.main} ${styles[this.props.pageName]}`}>
                    {this.props.children}
                </motion.main>
            </>
        )
    }
}