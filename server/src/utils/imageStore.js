import mongoose from 'mongoose'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { connectMongoDB } from '../config/mongodb.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localUploadDir = resolve(__dirname, '..', '..', 'data', 'uploads')

const MAX_MONGO_IMAGE_SIZE = 15 * 1024 * 1024 // 15 MB — stays under MongoDB's 16 MB doc limit
const isVercelRuntime = Boolean(process.env.VERCEL)

const imageSchema = new mongoose.Schema(
  {
    imageId: { type: String, required: true, unique: true, index: true },
    contentType: { type: String, required: true },
    originalName: { type: String, default: null },
    data: { type: Buffer, required: true },
    uploadedAt: { type: Date, default: Date.now, index: true },
  },
  { strictQuery: true }
)

export const ImageModel =
  mongoose.models.SocialImage || mongoose.model('SocialImage', imageSchema)

/**
 * Returns true when a usable MongoDB connection is established.
 * On Vercel this is always the case (MongoDB Atlas is configured). In local
 * development without MongoDB, images fall back to the local filesystem.
 */
export function isMongoConnected() {
  return mongoose.connection.readyState === 1
}

function isProductionRuntime() {
  return isVercelRuntime || process.env.NODE_ENV === 'production'
}

/**
 * The HTTP server starts before MongoDB finishes connecting. Wait for (or
 * trigger) that connection so Vercel does not silently write images to an
 * ephemeral container disk and then 404 them on the next request.
 */
export async function ensureMongoForImages() {
  if (isMongoConnected()) return true

  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      const finish = () => {
        mongoose.connection.off('connected', finish)
        mongoose.connection.off('error', finish)
        resolve()
      }
      mongoose.connection.once('connected', finish)
      mongoose.connection.once('error', finish)
      setTimeout(finish, 10000)
    })
    return isMongoConnected()
  }

  // Local tests and `npm run dev` keep the disk fallback. Production (Vercel)
  // must connect instead of writing to an ephemeral container filesystem.
  if (!isProductionRuntime()) {
    return false
  }

  try {
    await connectMongoDB()
  } catch (error) {
    console.warn('MongoDB image store could not connect:', error.message)
  }

  return isMongoConnected()
}

function sanitizeFileName(fileName) {
  // Prevent path traversal: reject any path separators or parent segments
  // before keeping only the basename.
  const raw = String(fileName || '')
  if (!raw || raw.includes('..') || raw.includes('/') || raw.includes('\\')) {
    return null
  }
  const base = basename(raw)
  if (!base || base.startsWith('.')) {
    return null
  }
  return base
}

export function inferContentType(fileName) {
  const ext = fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[1]
  if (!ext) return 'application/octet-stream'
  return `image/${ext.toLowerCase().replace('jpg', 'jpeg')}`
}

/**
 * Persist an image buffer.
 *
 * On Vercel (and any environment with MongoDB) the binary is stored inside the
 * SocialImage collection so it survives container restarts and is shared
 * across instances. When MongoDB is unavailable the image is written to the
 * local uploads directory instead (local-development convenience).
 *
 * Returns the URL path component under which the image should be served.
 */
export async function storeImage(buffer, fileName, contentType = 'application/octet-stream') {
  const safeName = sanitizeFileName(fileName) || `${Date.now()}-upload`
  const mongoReady = await ensureMongoForImages()

  // Prefer MongoDB — it is the persistent, shared store on Vercel.
  if (mongoReady) {
    if (Buffer.isBuffer(buffer) && buffer.length > MAX_MONGO_IMAGE_SIZE) {
      throw new Error(
        `Image is larger than the ${MAX_MONGO_IMAGE_SIZE / 1024 / 1024} MB MongoDB storage limit.`
      )
    }
    try {
      await ImageModel.findOneAndUpdate(
        { imageId: safeName },
        {
          imageId: safeName,
          contentType: contentType || inferContentType(safeName),
          originalName: safeName,
          data: buffer,
        },
        { upsert: true, new: true }
      )
      console.log('[imageStore] saved to MongoDB', { imageId: safeName, bytes: buffer?.length, contentType })
      return safeName
    } catch (error) {
      console.warn('MongoDB image store failed:', error.message)
      if (isProductionRuntime()) {
        throw error
      }
    }
  } else if (isProductionRuntime()) {
    throw new Error('MongoDB is not connected; cannot store images in production.')
  }

  // Fallback: local filesystem (local development / degraded mode).
  mkdirSync(localUploadDir, { recursive: true })
  const filePath = resolve(localUploadDir, safeName)
  writeFileSync(filePath, buffer)
  return safeName
}

export function extractBuffer(doc) {
  if (!doc) return null
  const raw = doc.data
  if (!raw) return null
  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof Uint8Array) return Buffer.from(raw)
  // Mongoose .lean() / BSON Binary can arrive as several object shapes.
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (Buffer.isBuffer(raw.buffer)) return raw.buffer
    if (raw.buffer instanceof Uint8Array) return Buffer.from(raw.buffer)
    if (Array.isArray(raw.data)) return Buffer.from(raw.data)
    if (raw.data instanceof Uint8Array || Buffer.isBuffer(raw.data)) return Buffer.from(raw.data)
    if (typeof raw.base64 === 'string') return Buffer.from(raw.base64, 'base64')
  }
  if (Array.isArray(raw)) return Buffer.from(raw)
  return null
}

/**
 * Express route handler for GET /api/social/uploads/:fileName.
 *
 * Tries MongoDB first (persistent storage that works on Vercel). If the image
 * is not in MongoDB, falls back to reading from the local uploads directory
 * so that existing local-development data keeps working.
 */
export async function serveImageFromStorage(req, res) {
  const fileName = sanitizeFileName(req.params.fileName)
  if (!fileName) {
    return res.status(400).json({ message: 'Invalid image name' })
  }

  // 1. Try MongoDB (persistent — works on Vercel).
  const mongoReady = await ensureMongoForImages()
  if (mongoReady) {
    try {
      const doc = await ImageModel.findOne({ imageId: fileName }).lean()
      const imageData = extractBuffer(doc)
      if (imageData && imageData.length > 0) {
        res.set('Content-Type', doc.contentType || inferContentType(fileName))
        res.set('Cache-Control', 'public, max-age=31536000, immutable')
        return res.send(imageData)
      }
      console.warn('[imageStore] MongoDB miss for image', { imageId: fileName, hasDoc: Boolean(doc), bytes: imageData?.length || 0 })
    } catch (error) {
      console.warn('Failed to read image from MongoDB, trying local disk:', error.message)
    }
  }

  // 2. Fallback: local filesystem.
  const filePath = resolve(localUploadDir, fileName)
  if (!existsSync(filePath)) {
    return res.status(404).json({ message: 'Image not found' })
  }

  const contentType = inferContentType(fileName)
  const fileBuffer = readFileSync(filePath)
  res.set('Content-Type', contentType)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.send(fileBuffer)
}
