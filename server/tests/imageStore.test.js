import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  extractBuffer,
  inferContentType,
  isMongoConnected,
  storeImage,
  serveImageFromStorage,
} from '../src/utils/imageStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const testUploadDir = resolve(__dirname, '..', 'data', 'uploads')

test('inferContentType returns correct MIME types for common extensions', () => {
  assert.equal(inferContentType('photo.png'), 'image/png')
  assert.equal(inferContentType('photo.jpg'), 'image/jpeg')
  assert.equal(inferContentType('photo.jpeg'), 'image/jpeg')
  assert.equal(inferContentType('photo.gif'), 'image/gif')
  assert.equal(inferContentType('photo.webp'), 'image/webp')
  assert.equal(inferContentType('photo.svg'), 'image/svg')
  assert.equal(inferContentType('photo.PNG'), 'image/png')
  assert.equal(inferContentType('photo.JPG'), 'image/jpeg')
  assert.equal(inferContentType('document.pdf'), 'application/octet-stream')
  assert.equal(inferContentType('noextension'), 'application/octet-stream')
})

test('isMongoConnected returns false when no database is connected', () => {
  assert.equal(isMongoConnected(), false)
})

test('storeImage falls back to local disk when MongoDB is not connected', async () => {
  const fileName = `test-fallback-${Date.now()}.png`
  const buffer = Buffer.from('fake-image-data')

  const result = await storeImage(buffer, fileName, 'image/png')
  assert.equal(result, fileName)

  const filePath = resolve(testUploadDir, fileName)
  assert.ok(existsSync(filePath), 'Image file should exist on local disk')
  assert.equal(readFileSync(filePath).toString(), 'fake-image-data')

  // Cleanup
  rmSync(filePath, { force: true })
})

test('serveImageFromStorage serves from local disk fallback', async () => {
  const fileName = `test-serve-${Date.now()}.png`
  const buffer = Buffer.from('serve-test-data')
  await storeImage(buffer, fileName, 'image/png')

  // Mock Express req/res
  const req = { params: { fileName } }
  let sentBody = null
  let sentStatus = null
  const headers = {}
  const res = {
    set(key, value) {
      headers[key] = value
      return this
    },
    status(code) {
      sentStatus = code
      return this
    },
    send(body) {
      sentBody = body
    },
    json(payload) {
      sentBody = payload
    },
  }

  await serveImageFromStorage(req, res)

  assert.equal(sentStatus, null, 'Should not set an error status')
  assert.equal(Buffer.isBuffer(sentBody), true, 'Should send a Buffer')
  assert.equal(sentBody.toString(), 'serve-test-data')
  assert.equal(headers['Content-Type'], 'image/png')

  // Cleanup
  rmSync(resolve(testUploadDir, fileName), { force: true })
})

test('serveImageFromStorage returns 404 for missing images', async () => {
  const req = { params: { fileName: 'nonexistent-xyz.png' } }
  let sentStatus = null
  const res = {
    set() {
      return this
    },
    status(code) {
      sentStatus = code
      return this
    },
    send() {},
    json() {},
  }

  await serveImageFromStorage(req, res)
  assert.equal(sentStatus, 404)
})

test('extractBuffer accepts BSON Binary, Buffer JSON, and Uint8Array shapes', () => {
  const bytes = Buffer.from('hello-image')

  assert.equal(extractBuffer({ data: bytes }).toString(), 'hello-image')
  assert.equal(extractBuffer({ data: Uint8Array.from(bytes) }).toString(), 'hello-image')
  assert.equal(extractBuffer({ data: { type: 'Buffer', data: [...bytes] } }).toString(), 'hello-image')
  assert.equal(extractBuffer({ data: { buffer: Uint8Array.from(bytes) } }).toString(), 'hello-image')
  assert.equal(extractBuffer({ data: { base64: bytes.toString('base64') } }).toString(), 'hello-image')
  assert.equal(extractBuffer({ data: null }), null)
})

test('serveImageFromStorage rejects path traversal attempts', async () => {
  const req = { params: { fileName: '../../etc/passwd' } }
  let sentStatus = null
  const res = {
    set() {
      return this
    },
    status(code) {
      sentStatus = code
      return this
    },
    send() {},
    json() {},
  }

  await serveImageFromStorage(req, res)
  assert.equal(sentStatus, 400)
})
