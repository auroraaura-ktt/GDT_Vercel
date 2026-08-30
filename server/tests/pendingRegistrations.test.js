import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createPendingRegistrationStore } from '../src/utils/pendingRegistrations.js'

test('pending registration store survives reloads', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'miit-pending-'))
  const storePath = path.join(tempDir, 'pending-registrations.json')

  try {
    const store = createPendingRegistrationStore(storePath)
    store.set('demo@miit.edu.mm', {
      email: 'demo@miit.edu.mm',
      username: 'demo',
      verificationCode: '12345678',
      verificationExpires: Date.now() + 60_000,
    })

    const reloadedStore = createPendingRegistrationStore(storePath)
    const pending = reloadedStore.get('demo@miit.edu.mm')

    assert.ok(pending)
    assert.equal(pending.verificationCode, '12345678')
    assert.equal(pending.username, 'demo')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
