import { Button, EmptyState } from '@/components/ui'

export default function NotFound() {
    return (
        <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
            <EmptyState
                icon="pets"
                headline="This page wandered off"
                body="Like Belle at dinnertime, it's probably somewhere near the kitchen. (404)"
            >
                <Button href="/">Back to your recipes</Button>
            </EmptyState>
        </main>
    )
}
