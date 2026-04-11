import Link from 'next/link'
import Image from 'next/image'
import { urlFor } from '@/lib/sanity/image'

type ProductReferenceCardProps = {
    value: {
        label?: string
        note?: string
        product?: {
            title: string
            slug: string
            price?: number
            thumbnail?: {
                asset: unknown
                alt?: string
            }
        }
    }
}

export function ProductReferenceCard({ value }: ProductReferenceCardProps) {
    const product = value.product
    if (!product) return null

    return (
        <div className="not-prose my-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
            <Link
                href={`/products/${product.slug}`}
                className="grid gap-4 p-4 sm:grid-cols-[120px_1fr]"
            >
                {product.thumbnail?.asset != null ? (
                    <Image
                        src={urlFor(product.thumbnail.asset).width(240).height(240).quality(85).url()}
                        alt={product.thumbnail.alt || product.title}
                        width={120}
                        height={120}
                        className="h-30 w-30 rounded-xl object-cover"
                    />
                ) : (
                    <div className="h-30 w-30 rounded-xl bg-gray-100 dark:bg-gray-800" />
                )}

                <div>
                    <p className="text-sm uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        {value.label || 'Featured piece'}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                        {product.title}
                    </h3>
                    {typeof product.price === 'number' ? (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            ${product.price.toFixed(2)}
                        </p>
                    ) : null}
                    {value.note ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {value.note}
                        </p>
                    ) : null}
                </div>
            </Link>
        </div>
    )
}