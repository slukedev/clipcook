'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import styles from '@/styles/Components.module.scss'
import { Button } from './button'
import { signOutAction } from '@/app/login/actions'

interface TopnavProps {
    photoUrl?: string
    useSvgLogo?: boolean
}

export function Topnav({ photoUrl, useSvgLogo }: TopnavProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const buttonRef = useRef<HTMLButtonElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!menuOpen) return
        function onDocClick(e: MouseEvent) {
            const target = e.target as Node | null
            if (!target) return
            if (buttonRef.current?.contains(target)) return
            if (menuRef.current?.contains(target)) return
            setMenuOpen(false)
        }
        document.addEventListener('click', onDocClick)
        return () => document.removeEventListener('click', onDocClick)
    }, [menuOpen])

    function onSignOut() {
        startTransition(() => {
            void signOutAction()
        })
    }

    return (
        <>
            <div className={styles.header}>
                <Link href="/" className={styles.title} passHref>
                    <div>
                        {useSvgLogo ? (
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="32" height="32" rx="16" fill="var(--primary)" />
                                <path
                                    d="M15.9757 6.0625C17.6239 6.0625 19.0625 8.0486 19.0625 10.6221C19.0625 12.8041 18.015 14.1747 16.6601 14.5524L17.4423 25.7557C17.4423 25.7557 16.8417 25.9375 15.9897 25.9375C15.1377 25.9375 14.6907 25.7417 14.6907 25.7417C15.2075 20.161 15.2913 15.0979 15.3053 14.5524C13.9505 14.2167 12.875 12.846 12.875 10.6221C12.875 8.0486 14.3276 6.0625 15.9757 6.0625Z"
                                    fill="var(--primary-container)"
                                />
                            </svg>
                        ) : (
                            <Image src="/logo.webp" alt="ClipCook" width={32} height={32} priority />
                        )}
                        <span>ClipCook</span>
                    </div>
                </Link>
                {photoUrl ? (
                    <button
                        ref={buttonRef}
                        id="profileButton"
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((v) => !v)}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            id="profilePicture"
                            style={{ borderRadius: '100%' }}
                            width={32}
                            height={32}
                            src={photoUrl}
                            alt="avatar"
                            referrerPolicy="no-referrer"
                        />
                    </button>
                ) : null}
            </div>
            <AnimatePresence>
                {menuOpen ? (
                    <motion.div
                        ref={menuRef}
                        key="signout"
                        className={styles.headerSignout}
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ ease: 'easeInOut', duration: 0.1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Button disabled={isPending} onClick={onSignOut}>
                            {isPending ? 'Signing out…' : 'Sign Out'}
                        </Button>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    )
}
