import {defineField, defineType} from 'sanity'

export const pullQuoteType = defineType({
  name: 'pullQuote',
  title: 'Pull Quote',
  type: 'object',
  fields: [
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'attribution',
      title: 'Attribution',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      title: 'quote',
      subtitle: 'attribution',
    },
    prepare({title, subtitle}) {
      return {
        title: title ? `“${title}”` : 'Pull quote',
        subtitle,
      }
    },
  },
})
