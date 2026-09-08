import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'

import authRoutes from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import socialRoutes from './routes/socialRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const staticPath = resolve(__dirname, '../public')

app.use(
  cors({
    origin: '*',
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ status: 'ok' })
})

app.get('/api', (req, res) => {
  res.json({
    message: 'MiitVerse API root',
    routes: ['/api/health', '/api/auth', '/api/users', '/api/social', '/api/feedback'],
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/feedback', feedbackRoutes)

// Serve frontend build assets
app.use(express.static(staticPath, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.set('Cache-Control', 'no-cache')
    }
  },
}))

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(resolve(staticPath, 'index.html'))
  }
  next()
})

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

export default app