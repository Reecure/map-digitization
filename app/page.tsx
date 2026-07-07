'use client'

import dynamic from 'next/dynamic'

const MarkingsEditor = dynamic(() => import('@/src/shared/components/MarkingsEditor'), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 grid place-items-center bg-[#0a0c12] text-slate-500 text-sm">
            Завантаження редактора…
        </div>
    ),
})

export default function Page() {
    return <MarkingsEditor/>
}