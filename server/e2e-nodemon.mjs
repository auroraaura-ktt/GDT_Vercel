import { spawn } from 'node:child_process'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import 'dotenv/config'
import { writeFileSync, readFileSync } from 'node:fs'

const PORT = 3060
const base = 'd:/GDT_2 - Vercel Version - Copy/server'
const dataFile = path.join(base, 'data/social-posts.json')
const dataBackup = readFileSync(dataFile, 'utf8')

const serverEnv = { ...process.env, PORT: String(PORT) }
const child = spawn(process.execPath, [path.join(base, 'node_modules/nodemon/bin/nodemon.js'), 'src/server.js'], {
  cwd: base,
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let out = ''
child.stdout.on('data', (d) => {
  out += String(d)
})
child.stderr.on('data', (d) => {
  out += String(d)
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitHealth() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await sleep(250)
  }
  throw new Error('server did not come up')
}

const secret = process.env.JWT_SECRET || 'change-this-in-development'

function pageToken(id, name) {
  return jwt.sign({ id, role: 'page', username: name, email: `${name}@miitverse.com` }, secret, { expiresIn: '1h' })
}

async function cleanupPost(id) {
  if (!id) return

  try {
    const currentPosts = JSON.parse(readFileSync(dataFile, 'utf8'))
    const nextPosts = currentPosts.filter((post) => String(post?.id) !== String(id))
    writeFileSync(dataFile, JSON.stringify(nextPosts, null, 2), 'utf8')
  } catch {
    // best-effort cleanup only
  }
}

async function main() {
  await waitHealth()
  console.log('SERVE_UP')

  const body = new FormData()
  body.append('content', 'E2E test page dash post')

  const res = await fetch(`http://127.0.0.1:${PORT}/api/social/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pageToken('e2e-ui-1', 'e2e')}` },
    body,
  })

  const text = await res.text()
  console.log('PAGE_POST status=', res.status)
  console.log('PAGE_POST body=', text.slice(0, 180))

  if (res.status !== 201) {
    throw new Error(`page post FAILED with ${res.status}`)
  }

  let createdId = null
  try {
    createdId = JSON.parse(text).post.id
  } catch {
    createdId = null
  }

  console.log('PAGE_POST created id=', createdId)
  console.log('restartOcurrences=', (out.match(/restarting due to changes/gi) || []).length)

  await cleanupPost(createdId)

  if (child.exitCode === null) {
    child.kill()
    await sleep(300)
  }
}

try {
  await main()
  console.log('E2E_OK')
  process.exit(0)
} catch (err) {
  console.error('E2E_FAIL:', err.message)
  try {
    writeFileSync(dataFile, dataBackup, 'utf8')
    console.log('restored json store from backup')
  } catch {
    // ignore restore errors
  }
  process.exit(1)
} finally {
  if (child.exitCode === null) {
    child.kill()
  }
}
