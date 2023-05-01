import { Component } from "react";
import styles from '@/styles/Components.module.scss'
import { motion, AnimatePresence } from "framer-motion";

interface ComponentProps {
    opened: boolean
    title: string
    closefunction: () => void
}

export class Modal extends Component<ComponentProps & React.HTMLProps<HTMLDivElement>, {}> {
    render() {
        if (typeof window !== "undefined") {
            if (this.props.opened) {
                document.body.style.overflow = "hidden";
                document.addEventListener("keydown", (e) => {
                    if (this.props.opened && this.props.closefunction) {
                        if (e.key === "Escape") {
                            this.props.closefunction();
                        }
                    }
                });
            } else {
                document.body.style.overflow = "auto";
            }
        }

        return (
            <AnimatePresence>
                {
                    this.props.opened ? (
                        <>
                            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ ease: "easeInOut", duration: 0.3 }} key={`modal${Math.random()}`} className={styles.modal} >
                                <h1 className={styles.title}>{this.props.title}</h1>
                                <div className={styles.content}>
                                    {this.props.children}
                                </div>
                            </motion.div>
                            <motion.div key={`backdrop${Math.random()}`} initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }} onClick={this.props.closefunction} className={styles.backdrop} transition={{ ease: "linear", duration: 0.3 }}></motion.div>
                        </>
                    ) : null
                }
            </AnimatePresence>
        )
    }
}