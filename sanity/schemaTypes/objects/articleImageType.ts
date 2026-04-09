import {defineField, defineType} from 'sanity'

export const articleImageType = defineType({
  name: 'articleImage',
  title: 'Article Image',
  type: 'image',
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      validation: (Rule) => Rule.required().max(150),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
    defineField({
      name: 'layout',
      title: 'Layout',
      type: 'string',
      options: {
        list: [
          {title: 'Inline', value: 'inline'},
          {title: 'Wide', value: 'wide'},
          {title: 'Full width', value: 'full'},
        ],
        layout: 'radio',
      },
      initialValue: 'wide',
    }),
  ],
  preview: {
    select: {
      title: 'caption',
      media: 'asset',
      subtitle: 'alt',
    },
    prepare({title, media, subtitle}) {
      return {
        title: title || 'Article image',
        subtitle,
        media,
      }
    },
  },
})
