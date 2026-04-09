type CalloutTone = 'info' | 'tip' | 'warning' | 'luxury'

type CalloutProps = {
    value: {
        tone?: CalloutTone
        title?: string
        body: string
    }
}

const toneClasses: Record<CalloutTone, string> = {
    info: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900',
    tip: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    luxury: 'border-emerald-300 bg-stone-50 dark:border-emerald-700 dark:bg-stone-900',
}

export function Callout({ value }: CalloutProps) {
    const tone = value.tone ?? 'info'

    return (
        <div className={`my-8 rounded-2xl border p-5 ${toneClasses[tone]}`}>
            {value.title ? (
                <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                    {value.title}
                </p>
            ) : null}
            <p className="leading-7 text-gray-700 dark:text-gray-300">{value.body}</p>
        </div>
    )
}