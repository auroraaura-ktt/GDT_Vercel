import test from 'node:test'
import assert from 'node:assert/strict'

import { buildLoginResponseUser } from '../src/controllers/authController.js'

const mockGetPageRecordByOwner = async (ownerId) => {
  if (ownerId === 'page-123') {
    return { slug: 'campus-news' }
  }
  return null
}

const mockCreatePageRecord = async (pageData) => {
  return { slug: pageData.slug || 'generated-page-slug' }
}

test('buildLoginResponseUser includes pageSlug for page accounts', async () => {
  const pageUser = {
    id: 'page-123',
    username: 'campusnews',
    email: 'page@miitverse.com',
    role: 'page',
  }

  const response = await buildLoginResponseUser(pageUser, mockGetPageRecordByOwner)

  assert.equal(response.id, pageUser.id)
  assert.equal(response.role, 'page')
  assert.equal(response.pageSlug, 'campus-news')
})

test('buildLoginResponseUser creates a page record and returns pageSlug when missing', async () => {
  const pageUser = {
    id: 'page-456',
    username: 'Campus News',
    email: 'page@miitverse.com',
    role: 'page',
  }

  const response = await buildLoginResponseUser(pageUser, async () => null, mockCreatePageRecord)

  assert.equal(response.id, pageUser.id)
  assert.equal(response.role, 'page')
  assert.equal(response.pageSlug, 'campus-news')
})


test('buildLoginResponseUser does not include pageSlug for non-page accounts', async () => {
  const user = {
    id: 'user-123',
    username: 'student',
    email: 'student@miit.edu.mm',
    role: 'user',
  }

  const response = await buildLoginResponseUser(user, mockGetPageRecordByOwner)

  assert.equal(response.id, user.id)
  assert.equal(response.role, 'user')
  assert.equal(response.pageSlug, undefined)
})
