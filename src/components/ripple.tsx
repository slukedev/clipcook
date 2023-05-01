import React from 'react'
import styles from '@/styles/Components.module.scss'

interface ComponentProps {
    feather?: string
    speedms?: number
    color?: string
    unbounded?: boolean
    dontfade?: boolean
}

export class Ripple extends React.Component<ComponentProps & React.HTMLProps<HTMLDivElement>, {}> {
    render() {
        const feather = this.props.feather;
        const speed = this.props.speedms;
        const color = this.props.color;
        const unbounded = this.props.unbounded;
        const dontFade = this.props.dontfade;

        function createRipple(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
            const target = event.currentTarget;
            const rect = target.getBoundingClientRect();
            const ripple = document.createElement("span");

            ripple.className = styles.ripple;

            const diameter = Math.max(target.clientWidth, target.clientHeight);
            const radius = diameter / 2;

            ripple.style.width = ripple.style.height = `${diameter}px`;

            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (unbounded) {
                ripple.style.top = `0`;
                ripple.style.left = `0`;
                ripple.style.transform = `translate(-50%, -50%)`;
            } else {
                ripple.style.top = `${y - radius}px`;
                ripple.style.left = `${x - radius}px`;
            }

            ripple.classList.add(styles.rippleActive);

            if (feather) {
                ripple.style.filter = "blur(" + feather + ")";
            }

            if (speed) {
                ripple.style.animationDuration = speed + "ms";
            }

            if (color) {
                ripple.style.backgroundColor = color;
            }


            if (dontFade) {
                ripple.style.opacity = "1 !important";
            }

            target.appendChild(ripple);

            if (dontFade) {
                setTimeout(() => {
                    document.addEventListener("click", (e) => {
                        if (e.target !== target) {
                            ripple.remove();
                        }
                    });
                }, speed || 600);
            } else {
                setTimeout(() => {
                    ripple.remove();
                }, speed || 600);
            }
        }

        return (
            <div onMouseDown={createRipple} {...this.props} className={`${styles.ripplecontainer} ${this.props.className}`}>
                {this.props.children}
            </div>
        )
    }
}