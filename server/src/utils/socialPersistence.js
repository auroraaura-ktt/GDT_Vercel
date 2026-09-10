import mongoose from 'mongoose'

import { driver } from '../config/neo4j.js'

const socialPostSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    source: { type: String, default: 'user' },
    postType: { type: String, default: 'user' },
    authorType: { type: String, enum: ['user', 'page'], default: 'user' },
    pageName: { type: String, default: null },
    profilePicture: { type: String, default: null },
    content: { type: String, default: '' },
    image: { type: String, default: null },
    // Multiple-photo support. Backward compatible: old posts simply have an
    // empty/null media array and keep rendering via `image`.
    media: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, required: true },
    likes: { type: Number, default: 0 },
    likedBy: { type: [mongoose.Schema.Types.Mixed], default: [] },
    comments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    reposts: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    visibility: { type: String, default: 'public' },
    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const SocialPostModel = mongoose.models.SocialPost || mongoose.model('SocialPost', socialPostSchema)

function toDatabasePost(post = {}) {
  return {
    id: String(post.id),
    userId: String(post.userId),
    username: post.username || 'MiitVerse member',
    source: post.source || 'user',
    postType: post.postType || (post.source === 'page' ? 'page' : 'user'),
    authorType: post.authorType || (post.source === 'page' ? 'page' : 'user'),
    pageName: post.pageName || null,
    profilePicture: post.profilePicture || null,
    content: post.content || '',
    image: post.image || null,
    media: Array.isArray(post.media) ? post.media : [],
    createdAt: new Date(post.createdAt || Date.now()),
    likes: Number(post.likes || 0),
    likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
    comments: Array.isArray(post.comments) ? post.comments : [],
    reposts: Number(post.reposts || 0),
    shares: Number(post.shares ?? post.reposts ?? 0),
    visibility: post.visibility || 'public',
    suspended: Boolean(post.suspended),
  }
}

export function normalizeDatabasePost(post = {}) {
  const authorType = post.authorType || (post.source === 'page' || post.postType === 'page' ? 'page' : 'user')
  const username = post.username || post.author || 'MiitVerse member'
  const content = post.content ?? post.message ?? ''
  const image = post.image ?? post.imageUrl ?? post.mediaUrl ?? null

  return {
    ...post,
    id: post.id != null ? String(post.id) : String(post._id || ''),
    userId: post.userId != null ? String(post.userId) : '',
    username,
    author: post.author || username,
    source: post.source || (authorType === 'page' ? 'page' : 'user'),
    postType: post.postType || (authorType === 'page' ? 'page' : 'user'),
    authorType,
    pageName: post.pageName || (authorType === 'page' ? username : null),
    profilePicture: post.profilePicture ?? post.avatarUrl ?? null,
    content,
    image,
    media: Array.isArray(post.media) ? post.media : [],
    likes: Number(post.likes || 0),
    likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
    comments: Array.isArray(post.comments) ? post.comments : [],
    reposts: Number(post.reposts || 0),
    shares: Number(post.shares ?? post.reposts ?? 0),
    visibility: post.visibility || 'public',
    suspended: Boolean(post.suspended),
  }
}

export async function writeSocialPostToMongo(post) {
  const databasePost = toDatabasePost(post)
  return SocialPostModel.findOneAndUpdate(
    { id: databasePost.id },
    { $set: databasePost },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
}

export async function deleteSocialPostFromMongo(postId) {
  const normalizedId = String(postId)
  if (!normalizedId) return false

  const result = await SocialPostModel.deleteOne({ id: normalizedId })
  return Boolean(result.deletedCount)
}

export async function deleteSocialPostFromNeo4j(postId) {
  const session = driver.session()
  try {
    await session.executeWrite((tx) => tx.run(
      'MATCH (post:Post { id: $id }) DETACH DELETE post',
      { id: String(postId) }
    ))
    return true
  } finally {
    await session.close()
  }
}

export async function deleteSocialPostFromDatabases(postId) {
  await deleteSocialPostFromNeo4j(postId)
  await deleteSocialPostFromMongo(postId)
  return true
}

export async function listSocialPostsFromMongo(filter = {}) {
  const query = { ...filter }
  const includeSuspended = query.includeSuspended === true
  delete query.includeSuspended
  if (!includeSuspended && !Object.prototype.hasOwnProperty.call(query, 'suspended')) {
    query.suspended = { $ne: true }
  }

  const find = typeof globalThis.__mongoFindMock === 'function'
    ? globalThis.__mongoFindMock
    : SocialPostModel.find.bind(SocialPostModel)

  let posts = await find(query)

  if (Array.isArray(posts)) {
    if (!includeSuspended) posts = posts.filter((post) => !post || post.suspended !== true)
    posts.sort((left, right) => {
      const leftTime = new Date(left?.createdAt || 0).getTime()
      const rightTime = new Date(right?.createdAt || 0).getTime()
      return rightTime - leftTime
    })
    return posts.map((post) => ({
      ...normalizeDatabasePost(post),
      createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    }))
  }

  if (posts && typeof posts.sort === 'function') {
    posts = posts.sort((left, right) => {
      const leftTime = new Date(left?.createdAt || 0).getTime()
      const rightTime = new Date(right?.createdAt || 0).getTime()
      return rightTime - leftTime
    })
  }

  const result = Array.isArray(posts) ? posts : []
  return result.map((post) => ({
    ...normalizeDatabasePost(post),
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
  }))
}

export async function writeSocialPostToNeo4j(post) {
  const databasePost = toDatabasePost(post)
  const session = driver.session()

  try {
    await session.executeWrite((tx) => tx.run(
      `
        MERGE (post:Post { id: $id })
        SET post.userId = $userId,
            post.username = $username,
            post.source = $source,
            post.postType = $postType,
            post.authorType = $authorType,
            post.pageName = $pageName,
            post.profilePicture = $profilePicture,
            post.content = $content,
            post.image = $image,
            post.media = $mediaJson,
            post.createdAt = $createdAt,
            post.likes = $likes,
            post.reposts = $reposts,
            post.shares = $shares,
            post.visibility = $visibility,
            post.suspended = $suspended
        WITH post
        OPTIONAL MATCH (author:User { id: $userId })
        FOREACH (_ IN CASE WHEN author IS NULL THEN [] ELSE [1] END |
          MERGE (author)-[:POSTED]->(post)
        )
        RETURN post
      `,
      {
        ...databasePost,
        createdAt: databasePost.createdAt.toISOString(),
        mediaJson: JSON.stringify(databasePost.media || []),
      }
    ))
    return true
  } finally {
    await session.close()
  }
}

// Neo4j is the system-of-record requirement for posts.  Do not silently accept
// a post when its graph write fails; the route returns an error instead.
export async function persistSocialPost(post, deps = {}) {
  const neo4jWriter = deps.neo4jWriter || writeSocialPostToNeo4j
  const mongoWriter = deps.mongoWriter || writeSocialPostToMongo

  await neo4jWriter(post)

  let mongoSaved = false
  try {
    await mongoWriter(post)
    mongoSaved = true
  } catch (error) {
    console.warn('MongoDB post persistence failed:', error.message)
  }

  return { neo4jSaved: true, mongoSaved }
}
