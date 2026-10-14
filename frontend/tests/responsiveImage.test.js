import assert from 'node:assert/strict'
import test from 'node:test'
import { responsiveImage } from '../src/utils/responsiveImage.js'

test('returns responsive Unsplash variants at the requested widths', () => {
  const result = responsiveImage(
    'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3&w=800',
    [320, 640, 960],
  )

  assert.equal(
    result.src,
    'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3&w=960&auto=format&fit=crop&q=72',
  )
  assert.deepEqual(
    result.srcSet.split(', '),
    [
      'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3&w=320&auto=format&fit=crop&q=72 320w',
      'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3&w=640&auto=format&fit=crop&q=72 640w',
      'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3&w=960&auto=format&fit=crop&q=72 960w',
    ],
  )
})

test('preserves image sources that are not hosted by Unsplash', () => {
  const source = 'https://cdn.example.com/product.jpg?width=800'

  assert.deepEqual(responsiveImage(source, [320, 640]), { src: source })
})

test('returns an empty source unchanged', () => {
  assert.deepEqual(responsiveImage('', [320, 640]), { src: '' })
})

test('preserves invalid URLs unchanged', () => {
  const source = 'https://[invalid'

  assert.deepEqual(responsiveImage(source, [320, 640]), { src: source })
})
