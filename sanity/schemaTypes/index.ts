import {authorType} from './documents/authorType'
import {categoryType} from './documents/categoryType'
import {postType} from './documents/postType'
import {productType} from './documents/productType'

import {articleImageType} from './objects/articleImageType'
import {calloutType} from './objects/calloutType'
import {productReferenceType} from './objects/productReferenceType'
import {pullQuoteType} from './objects/pullQuoteType'
import {richTextType} from './objects/richTextType'
import {seoType} from './objects/seoType'
import {sourceReferenceType} from './objects/sourceReferenceType'

export const schemaTypes = [
  postType,
  authorType,
  categoryType,
  productType,
  seoType,
  richTextType,
  articleImageType,
  pullQuoteType,
  calloutType,
  productReferenceType,
  sourceReferenceType,
]
