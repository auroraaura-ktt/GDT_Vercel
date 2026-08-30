import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const serverRoot = resolve(projectRoot, 'server')
const viteScript = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const nodemonScript = resolve(serverRoot, 'node_modules', 'nodemon', 'bin', 'nodemon.js')

function start(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    windowsHide: false,
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`)
      process.exit(code)
    }
  })

  return child
}

const client = start('client', process.execPath, [viteScript], projectRoot)
const server = start('server', process.execPath, [nodemonScript, 'src/server.js'], serverRoot)

function shutdown() {
  client.kill()
  server.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)