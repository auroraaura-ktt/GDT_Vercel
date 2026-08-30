import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function defaultStorePath() {
  return path.resolve(process.cwd(), 'data', 'pending-registrations.json')
}

export function createPendingRegistrationStore(filePath = defaultStorePath()) {
  const resolvedPath = path.resolve(filePath)
  const dir = path.dirname(resolvedPath)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  function readStore() {
    if (!existsSync(resolvedPath)) {
      return new Map()
    }

    try {
      const raw = readFileSync(resolvedPath, 'utf8')
      const parsed = raw ? JSON.parse(raw) : {}
      return new Map(Object.entries(parsed))
    } catch (error) {
      console.warn('Failed to read pending registrations store, starting empty.', error.message)
      return new Map()
    }
  }

  function writeStore(map) {
    try {
      writeFileSync(resolvedPath, JSON.stringify(Object.fromEntries(map), null, 2))
    } catch (error) {
      console.warn('Failed to persist pending registrations store.', error.message)
    }
  }

  const store = readStore()

  return {
    get(key) {
      return store.get(key)
    },
    set(key, value) {
      store.set(key, value)
      writeStore(store)
    },
    delete(key) {
      const result = store.delete(key)
      writeStore(store)
      return result
    },
    values() {
      return store.values()
    },
    clear() {
      store.clear()
      writeStore(store)
    },
    has(key) {
      return store.has(key)
    },
    size() {
      return store.size
    },
    toJSON() {
      return Object.fromEntries(store)
    },
  }
}

export const pendingRegistrationStore = createPendingRegistrationStore()
