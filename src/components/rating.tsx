import React from 'react'
import styles from '@/styles/Components.module.scss'
import { Icon } from "@/components/icon"

interface ComponentProps {
    rating: number
}

export class Rating extends React.Component<ComponentProps & React.HTMLProps<HTMLInputElement>, {}> {
    render() {
        const rating = this.props.rating;
        const ratingRounded = Math.round(rating / 0.5) * 0.5;
        var ratingLeft = ratingRounded;

        return (
            <div>
                {
                    [...Array(5)].map((_, i) => {

                        ratingLeft--;

                        if (ratingLeft == -0.5) {
                            return <Icon key={i} className={styles.icon} name="star_half" fill="1" iconsize="18" />
                        }

                        return <Icon key={i} className={styles.icon} name="star" fill={rating > i ? "1" : "0"} iconsize="18" />
                    })
                }
            </div>
        )
    }
}