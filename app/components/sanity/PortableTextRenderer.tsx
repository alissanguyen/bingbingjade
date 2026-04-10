'use client'

import Link from 'next/link'
import { PortableText, type PortableTextComponents, type PortableTextBlock } from '@portabletext/react'
import { BlogImage } from './BlogImage'
import { PullQuote } from './PullQuote'
import { Callout } from './Callout'
import { ProductReferenceCard } from './ProductReferenceCard'


const components: PortableTextComponents = {
    types: {
        articleImage: ({ value }) => <BlogImage value={value} />,
        pullQuote: ({ value }) => <PullQuote value={value} />,
        callout: ({ value }) => <Callout value={value} />,
        productReference: ({ value }) => <ProductReferenceCard value={value} />,
    },
    block: {
        h2: ({ children }) => (
            <h2 className="mt-12 mb-4 text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">
                {children}
            </h2>
        ),
        h3: ({ children }) => (
            <h3 className="mt-10 sm:mb-4 text-xl sm:text-2xl font-semibold text-emerald-700 dark:text-emerald-600">
                {children}
            </h3>
        ),
        h4: ({ children }) => (
            <h4 className="mt-8 mb-3 text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {children}
            </h4>
        ),
        normal: ({ children }) => (
            <p className="text-[16px] sm:text-base my-5 leading-6.5 sm:leading-8 text-gray-700 dark:text-gray-300">{children}</p>
        ),
        blockquote: ({ children }) => (
            <blockquote className="my-8 border-l-4 border-emerald-700 pl-5 italic text-gray-700 dark:text-gray-300">
                {children}
            </blockquote>
        ),
    },
    marks: {
        link: ({ children, value }) => {
            const href = value?.href || '#'
            const external = /^https?:\/\//.test(href)

            if (external) {
                return (
                    <a
                        href={href}
                        target={value?.openInNewTab ? '_blank' : undefined}
                        rel={value?.openInNewTab ? 'noopener noreferrer' : undefined}
                        className="text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
                    >
                        {children}
                    </a>
                )
            }

            return (
                <Link
                    href={href}
                    className="text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
                >
                    {children}
                </Link>
            )
        },
        code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">
                {children}
            </code>
        ),
    },
    list: {
        bullet: ({ children }) => (
            <ul className="text-[16px] sm:text-base my-5 ml-6 list-disc space-y-2 text-gray-700 dark:text-gray-300">
                {children}
            </ul>
        ),
        number: ({ children }) => (
            <ol className="text-[16px] sm:text-base my-5 ml-6 list-decimal space-y-2 text-gray-700 dark:text-gray-300">
                {children}
            </ol>
        ),
    },
}

export function PortableTextRenderer({ value }: { value: PortableTextBlock[] }) {
    return <PortableText value={value} components={components} />
}