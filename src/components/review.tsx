import React from 'react'
import styles from '@/styles/Components.module.scss'
import { Rating } from './rating'

interface ComponentProps {
    rating: number
    review: string
}

export class Review extends React.Component<ComponentProps & React.HTMLProps<HTMLDivElement>, {}> {
    render() {
        return (
            <div className={styles.review} {...this.props}>
                <div className={styles.reviewInfo}>
                    <div className={styles.reviewProfileRating}>
                        <Rating rating={this.props.rating} />
                        <span className={styles.reviewProfileRatingCount}>{this.props.rating}</span>
                    </div>
                </div>
                <p className={styles.theReview}>{this.props.review}</p>
            </div>
        )
    }
}