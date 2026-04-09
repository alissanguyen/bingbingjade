type PullQuoteProps = {
    value: {
        quote: string
        attribution?: string
    }
}

export function PullQuote({ value }: PullQuoteProps) {
    return (
        <figure className="my-10 border-l-4 border-emerald-700 pl-6">
            <blockquote className="text-xl leading-8 text-gray-900 dark:text-white italic">
                “{value.quote}”
            </blockquote>
            {value.attribution ? (
                <figcaption className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    — {value.attribution}
                </figcaption>
            ) : null}
        </figure>
    )
}