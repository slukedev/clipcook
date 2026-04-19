'use client'

import { useEffect } from 'react'
import styles from '@/styles/Components.module.scss'
import { AnimatePresence, motion } from 'motion/react'

interface ModalProps {
    opened: boolean
    title: string
    closefunction: () => void
    children?: React.ReactNode
}

export function Modal({ opened, title, closefunction, children }: ModalProps) {
    useEffect(() => {
        if (!opened) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') closefunction()
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = previous
            document.removeEventListener('keydown', onKey)
        }
    }, [opened, closefunction])

    return (
        <AnimatePresence>
            {opened ? (
                <>
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ ease: 'easeInOut', duration: 0.3 }}
                        key="modal"
                        className={styles.modal}
                    >
                        <h1 className={styles.title}>{title}</h1>
                        <div className={styles.content}>{children}</div>
                    </motion.div>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        exit={{ opacity: 0 }}
                        onClick={closefunction}
                        className={styles.backdrop}
                        transition={{ ease: 'linear', duration: 0.3 }}
                    />
                </>
            ) : null}
        </AnimatePresence>
    )
}
