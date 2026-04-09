import {defineField, defineType} from 'sanity'

export const productReferenceType = defineType({
  name: 'productReference',
  title: 'Product Reference',
  type: 'object',
  fields: [
    defineField({
      name: 'product',
      title: 'Product',
      type: 'reference',
      to: [{type: 'product'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'label',
      title: 'Custom label',
      type: 'string',
    }),
    defineField({
      name: 'note',
      title: 'Optional note',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      title: 'label',
      productTitle: 'product.title',
    },
    prepare({title, productTitle}) {
      return {
        title: title || productTitle || 'Product reference',
      }
    },
  },
})
