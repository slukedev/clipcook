'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SvgIcon } from '@/components/ui/icon/svg'
import { CLOUD_OFF } from '../_status/glyphs'
import { StatusScreen } from '../_status/status-screen'

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])
    return (
        <StatusScreen
            shape="puffy"
            icon={<SvgIcon d={CLOUD_OFF} name="cloud_off" />}
            title="This Page Didn't Load"
            action={<Button onClick={() => retry()}>Try again</Button>}
        />
    )
}
