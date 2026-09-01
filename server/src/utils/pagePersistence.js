import mongoose from 'mongoose'

const pageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    pageName: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, default: 'page' },
    verified: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    ownerId: { type: String, default: '' },
    description: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    posts: [{ type: Object, default: [] }],
  },
  { timestamps: true }
)

export const PageModel = mongoose.models.Page || mongoose.model('Page', pageSchema)

export function normalizePageSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isRetryableMongoWriteError(error) {
  return error?.hasErrorLabel?.('RetryableWriteError') ||
    error?.errorLabelSet?.has?.('RetryableWriteError') ||
    ['NotWritablePrimary', 'PrimarySteppedDown', 'InterruptedDueToReplStateChange'].includes(error?.codeName)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createPageRecord(pageData = {}) {
  const pageName = String(pageData.pageName || '').trim()
  const email = String(pageData.email || '').trim().toLowerCase()
  const baseSlug = normalizePageSlug(pageData.slug || pageName || (email.split('@')[0] || 'page'))

  if (!pageName || !email || !baseSlug) {
    throw new Error('Page name, email, and slug are required')
  }

  let slug = baseSlug
  let slugAttempt = 0
  let writeAttempt = 0

  while (true) {
    const document = {
      id: pageData.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      pageName,
      slug,
      email,
      role: 'page',
      verified: true,
      ownerId: pageData.ownerId || '',
      description: pageData.description || '',
      coverImage: pageData.coverImage || '',
      posts: Array.isArray(pageData.posts) ? pageData.posts : [],
    }

    try {
      return await PageModel.findOneAndUpdate(
        { email },
        { $setOnInsert: document },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      ).lean()
    } catch (error) {
      const isDuplicateSlug = error?.code === 11000 && (error.keyPattern?.slug || String(error.message).includes('slug'))

      if (isDuplicateSlug && slugAttempt < 4) {
        slugAttempt += 1
        slug = `${baseSlug}-${slugAttempt}`
        continue
      }

      if (isRetryableMongoWriteError(error) && writeAttempt < 3) {
        writeAttempt += 1
        await wait(writeAttempt * 200)
        continue
      }

      if (!isDuplicateSlug || slugAttempt >= 4) {
        throw error
      }
    }
  }
}

export async function listPageRecords() {
  return PageModel.find({}).sort({ createdAt: -1 }).lean()
}

export async function getPageRecordBySlug(slug) {
  return PageModel.findOne({ slug: normalizePageSlug(slug) }).lean()
}

export async function getPageRecordByOwner(ownerId) {
  if (!ownerId) return null
  return PageModel.findOne({ ownerId: String(ownerId) }).lean()
}

export async function setPageVerified(id, verified) {
  const target = String(id || '')
  if (!target) return null
  return PageModel.findOneAndUpdate(
    { $or: [{ id: target }, { ownerId: target }] },
    { $set: { verified: Boolean(verified) } },
    { returnDocument: 'after' }
  ).lean()
}
