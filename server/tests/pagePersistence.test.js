import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizePageSlug } from '../src/utils/pagePersistence.js'

test('normalizes page names into stable slugs', () => {
  assert.equal(normalizePageSlug('MiitVerse BlueMark'), 'miitverse-bluemark')
  assert.equal(normalizePageSlug('  My Page  '), 'my-page')
  assert.equal(normalizePageSlug('Page & Stories'), 'page-stories')
})
