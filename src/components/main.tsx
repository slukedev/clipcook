'use client'

import styles from '@/styles/Home.module.scss'
import { motion } from 'motion/react'

interface MainProps {
    pageName: string
    children: React.ReactNode
}

export function Main({ pageName, children }: MainProps) {
    return (
        <motion.main
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ease: 'easeInOut', duration: 0.3 }}
            exit={{ opacity: 0 }}
            key={pageName}
            className={`${styles.main} ${styles[pageName] ?? ''}`}
        >
            {children}
        </motion.main>
    )
}
