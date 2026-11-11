import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { StatusScreen } from '../../../_status/status-screen'

export default function CollectionNotFound() {
    return (
        <StatusScreen
            shape="clover8"
            icon={<Icon name="collections_bookmark" />}
            title="Collection Not Found"
            action={
                <Button variant="tonal" render={<Link href="/collections" />} nativeButton={false}>
                    Collections
                </Button>
            }
        />
    )
}
