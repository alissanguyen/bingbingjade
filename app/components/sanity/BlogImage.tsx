import Image from 'next/image'
import { urlFor } from '@/lib/sanity/image'
import { SanityImageSource } from '@sanity/image-url'

type BlogImageProps = {
    value: {
        asset: SanityImageSource
        alt?: string
        caption?: string
        layout?: 'inline' | 'wide' | 'full'
    }
}

export function BlogImage({ value }: BlogImageProps) {
    const layout = value.layout ?? 'wide'

    const className =
        layout === 'full'
            ? 'not-prose my-8 w-screen max-w-none relative left-1/2 right-1/2 -translate-x-1/2'
            : layout === 'inline'
                ? 'my-6 max-w-xl'
                : 'my-8'

    return (
        <figure className={className}>
            <Image
                src={urlFor(value.asset).width(1400).quality(85).url()}
                alt={value.alt || ''}
                width={1400}
                height={900}
                className="h-auto w-full rounded-2xl object-cover"
            />
            {value.caption ? (
                <figcaption className="mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">
                    {value.caption}
                </figcaption>
            ) : null}
        </figure>
    )
}