import React from 'react'
import styles from '@/styles/Components.module.scss'
import Link from 'next/link';
import Image from 'next/image';
import { Button } from './button';
import { AnimatePresence, motion } from 'framer-motion';
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

interface ComponentProps {
    photoUrl?: string
    useSvgLogo?: boolean
}

export class Topnav extends React.Component<ComponentProps & React.HTMLProps<HTMLDivElement>, { signOutVisible: boolean }> {
    constructor(props: ComponentProps & React.HTMLProps<HTMLDivElement>) {
        super(props);
        this.state = {
            signOutVisible: false
        }
    }

    render() {
        const firebaseConfig = {
            apiKey: "AIzaSyAlg5bcO368inwAQwIBNlespVC3mPfs8Qw",
            authDomain: "clipcook-59c6b.firebaseapp.com",
            projectId: "clipcook-59c6b",
            storageBucket: "clipcook-59c6b.appspot.com",
            messagingSenderId: "958728612297",
            appId: "1:958728612297:web:04335a54632029b2726018"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth();

        async function signOut() {
            await auth.signOut();
            location.href = "/continue";
        }

        if (typeof document != "undefined") {
            document.addEventListener("click", (e: MouseEvent) => {
                if (this.state.signOutVisible && (e.target as HTMLElement).id != "profileButton" && (e.target as HTMLElement).id != "profilePicture") {
                    this.setState({ signOutVisible: false });
                }
            })
        }

        return (
            <>
                <div className={styles.header}>
                    <Link href="/" className={styles.title} passHref>
                        <div>
                            {
                                this.props.useSvgLogo ? (
                                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="32" height="32" rx="16" fill="var(--primary)" />
                                        <path d="M15.9757 6.0625C17.6239 6.0625 19.0625 8.0486 19.0625 10.6221C19.0625 12.8041 18.015 14.1747 16.6601 14.5524L17.4423 25.7557C17.4423 25.7557 16.8417 25.9375 15.9897 25.9375C15.1377 25.9375 14.6907 25.7417 14.6907 25.7417C15.2075 20.161 15.2913 15.0979 15.3053 14.5524C13.9505 14.2167 12.875 12.846 12.875 10.6221C12.875 8.0486 14.3276 6.0625 15.9757 6.0625Z" fill="var(--primary-container)" />
                                    </svg>
                                ) : <Image src="/logo.webp" alt="FoodMate" width={32} height={32} />
                            }
                            <span>ClipCook</span>
                        </div>
                    </Link>
                    {this.props.photoUrl ? (
                        <button id="profileButton" onClick={() => this.setState({ signOutVisible: !this.state.signOutVisible })}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img id="profilePicture" style={{ borderRadius: "100%" }} width={32} height={32} src={this.props.photoUrl || ""} alt="avatar" />
                        </button>
                    ) : null}
                </div>
                <AnimatePresence>
                    {
                        this.state.signOutVisible ? (
                            <motion.div key="signout" className={styles.headerSignout} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.1 }} exit={{ opacity: 0 }}>
                                <Button onClick={signOut}>Sign Out</Button>
                            </motion.div>
                        ) : null
                    }
                </AnimatePresence>
            </>
        )
    }
}