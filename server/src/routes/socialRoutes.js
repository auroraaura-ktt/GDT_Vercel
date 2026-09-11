import { Router } from 'express';
import multer from 'multer';

import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  createSocialPost,
  getSocialFollows,
  saveSocialFollows,
  listAllSocialPosts,
  deleteSocialPostById,
  updateSocialPostById,
  toggleSocialPostLike,
  addSocialPostComment,
  togglePostLikeOnPost,
  addCommentToPost,
  getVisiblePosts,
  applyUserPostWeightedShuffle,
} from '../utils/socialStore.js';
import { listPageRecords } from '../utils/pagePersistence.js';
import { deleteSocialPostFromDatabases, listSocialPostsFromMongo, persistSocialPost } from '../utils/socialPersistence.js';
import { getUserFromMongo, listVerifiedUserIds } from '../utils/userPersistence.js';
import { createReport, deleteReportById, listReports, updateReportById } from '../utils/reportStore.js';
import { storeImage, getStoredFile, inferContentType } from '../utils/imageStore.js';

const router = Router();
// Persistent image storage now lives in MongoDB (see imageStore.js). A 15 MB
// limit keeps us safely under MongoDB's 16 MB document maximum while still
// being generous for social-media images.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

async function enrichPostAuthors(posts = []) {
  let pages = []
  try {
    pages = await listPageRecords()
  } catch (error) {
    console.warn('Failed to resolve page authors for posts:', error.message)
  }
  const authorsById = new Map()

  for (const page of pages || []) {
    for (const key of [page?.id, page?.ownerId]) {
      if (key !== undefined && key !== null && key !== '') {
        authorsById.set(String(key), page)
      }
    }
  }

  const userCache = new Map()
  return Promise.all((posts || []).map(async (post) => {
    if (!post) return post

    const authorId = String(post.userId || '')
    const page = authorsById.get(authorId)
    if (page) {
      const pageName = page.pageName || post.pageName || post.username
      return {
        ...post,
        source: 'page',
        postType: 'page',
        authorType: 'page',
        pageName,
        author: pageName,
        username: pageName,
        profilePicture: post.profilePicture || page.coverImage || null,
        pageOwnerId: page.ownerId || null,
      }
    }

    if (!post.username || post.username === 'MiitVerse member' || !post.profilePicture) {
      if (!userCache.has(authorId)) {
        userCache.set(authorId, authorId ? getUserFromMongo(authorId).catch(() => null) : Promise.resolve(null))
      }
      const userRecord = await userCache.get(authorId)
      if (userRecord) {
        return {
          ...post,
          author: post.author || userRecord.username,
          username: post.username && post.username !== 'MiitVerse member' ? post.username : userRecord.username,
          profilePicture: post.profilePicture || userRecord.avatarUrl || null,
        }
      }
    }

    return { ...post, author: post.author || post.username }
  }))
}

router.post('/uploads', authMiddleware, upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  const fileName = `${Date.now()}-${file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'upload'}`;
  try {
    await storeImage(file.buffer, fileName, file.mimetype);
  } catch (error) {
    console.error('[POST /api/social/uploads] image store failed:', error.message);
    return res.status(503).json({ message: 'Image could not be saved. Please try again.' });
  }

  const imageUrl = `/api/social/uploads/${fileName}`;
  res.json({ imageUrl });
});

// Public inline media endpoint for images only. This lets feed `<img>` tags
// render post photos/avatars without sending a JWT. Any non-image attachment
// is refused here — it must be downloaded through the authenticated
// /download/:fileName endpoint so protected files are never reachable simply
// by knowing their storage URL.
router.get('/uploads/:fileName', async (req, res) => {
  const stored = await getStoredFile(req.params.fileName)
  if (!stored) {
    return res.status(404).json({ message: 'File not found' })
  }
  const contentType = stored.contentType || ''
  const isInlineImage =
    contentType.startsWith('image/') ||
    /\\.(png|jpe?g|gif|webp|bmp|svg|avif|webp)$/i.test(String(req.params.fileName || ''))
  if (!isInlineImage) {
    return res.status(403).json({ message: 'This file requires an authenticated download request.' })
  }

  res.set('Content-Type', contentType)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  return res.send(stored.data)
});

// True when the signed-in user is allowed to see (and therefore download files
// from) the request. We resolve rendered file names to the posts that own them
// using the same visibility rules as the feed, so changing a post id, file id,
// or filename cannot bypass the check.
async function canUserAccessFile(user, fileName) {
  if (!user?.id || !fileName) return false

  const normalizedFileName = String(fileName)
  const following = getSocialFollows(user.id)
  const posts = await listSocialPostsFromMongo({ suspended: { $ne: true } })
  const visiblePosts = getVisiblePosts(posts, user.id, following)

  const referencesFile = (post) => {
    const media = Array.isArray(post?.media) ? post.media : []
    return media.some((item) => {
      const url = typeof item === 'string' ? item : item?.url
      return typeof url === 'string' && String(url.split('/').pop() || '') === normalizedFileName
    })
  }

  return visiblePosts.some(referencesFile)
}

// Secure, authenticated file download with enforced authorization. Unauthorized
// requests (no/invalid token -> 401, not allowed to view the source post -> 403)
// never receive the file bytes. The storage key is sanitized to prevent path
// traversal and no server filesystem path is ever revealed.
router.get('/download/:fileName', authMiddleware, async (req, res, next) => {
  try {
    const fileName = String(req.params.fileName || '').split('/').pop()
    const allowed = await canUserAccessFile(req.user, fileName)
    if (!allowed) {
      return res.status(403).json({ message: 'You are not allowed to download this file.' })
    }

    const stored = await getStoredFile(fileName)
    if (!stored) {
      return res.status(404).json({ message: 'File not found' })
    }

    const suggestedName =
      typeof req.query?.name === 'string' && req.query.name.trim()
        ? req.query.name.trim().replace(/["\\\r\n]/g, '').slice(0, 200)
        : stored.originalName || fileName

    res.setHeader('Content-Type', stored.contentType || 'application/octet-stream')
    res.setHeader('Content-Length', String(stored.data?.length || 0))
    res.setHeader('Content-Disposition', `attachment; filename="${suggestedName}"`)
    return res.send(stored.data)
  } catch (error) {
    return next(error)
  }
});

router.get('/verified-authors', authMiddleware, async (req, res) => {
  try {
    const ids = await listVerifiedUserIds();
    // Page accounts carry their own blue mark on the page record (not the user
    // record), so merge verified page ids in as well. Every post card resolves
    // the badge against this set, so the change applies immediately to old,
    // current, and future posts without touching any post.
    try {
      const pages = await listPageRecords();
      for (const page of pages || []) {
        if (!page || page.verified === false) continue;
        for (const key of [page.ownerId, page.id]) {
          if (key !== undefined && key !== null && key !== '') {
            ids.add(String(key));
          }
        }
      }
    } catch (pageError) {
      console.warn('Failed to resolve verified page accounts:', pageError.message);
    }
    return res.json({ verifiedAuthorIds: [...ids] });
  } catch (error) {
    console.error('Failed to load verified accounts:', error.message);
    return res.status(500).json({ message: 'Failed to load verified accounts' });
  }
});

router.get('/posts', authMiddleware, async (req, res) => {
  const { userId, cursor: rawCursor } = req.query || {}
  const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 8))
  let cursor = null
  if (rawCursor) {
    try {
      cursor = JSON.parse(Buffer.from(String(rawCursor), 'base64url').toString('utf8'))
    } catch {
      return res.status(400).json({ message: 'Invalid feed cursor' })
    }
  }

  if (userId) {
    let verifiedAuthorIds = new Set()
    try {
      verifiedAuthorIds = await listVerifiedUserIds()
    } catch (error) {
      console.warn('Failed to resolve verified accounts for user posts:', error.message)
    }

    const posts = (await enrichPostAuthors(await listSocialPostsFromMongo({ userId: String(userId), suspended: { $ne: true } })))
      .map((post) => (
        post ? { ...post, isVerified: verifiedAuthorIds.has(String(post.userId)) } : post
      ))

    return res.json({ posts })
  }

  const following = getSocialFollows(req.user.id);
  let pagePostUserIds = []
  const pageFullNames = new Map()
  const pageVerified = new Map()

  try {
    const pages = await listPageRecords()
    // A page post is authored with the page id, while older records may use
    // the owner id. Keep both identifiers so either shape is recognized.
    pagePostUserIds = (pages || []).flatMap((page) => [page?.id, page?.ownerId]).filter(Boolean)

    for (const page of pages || []) {
      if (!page?.pageName) continue
      const keys = [page.id, page.ownerId].filter((value) => value != null && value !== '')
      for (const key of keys) {
        const normalizedKey = String(key)
        if (!pageFullNames.has(normalizedKey)) {
          pageFullNames.set(normalizedKey, page.pageName)
          pageVerified.set(normalizedKey, Boolean(page.verified))
        }
      }
    }
  } catch (error) {
    console.error('Failed to load page records for feed ordering:', error.message)
  }

  let verifiedAuthorIds = new Set()
  try {
    verifiedAuthorIds = await listVerifiedUserIds()
  } catch (error) {
    console.warn('Failed to resolve verified accounts for feed:', error.message)
  }

  // MongoDB is the shared source for both Feed and Admin. The JSON store is
  // retained only as a local mirror for compatibility, never as a feed source.
  const databasePosts = await listSocialPostsFromMongo({ suspended: { $ne: true } })
  const visiblePosts = applyUserPostWeightedShuffle(getVisiblePosts(databasePosts, req.user.id, following), { pagePostUserIds })

  const startIndex = cursor
    ? visiblePosts.findIndex((post) => String(post.id) === String(cursor.id)) + 1
    : 0
  const safeStartIndex = startIndex > 0 ? startIndex : 0
  const pagePosts = visiblePosts.slice(safeStartIndex, safeStartIndex + limit)
  const hasMore = safeStartIndex + pagePosts.length < visiblePosts.length
  const lastPost = pagePosts.at(-1)

  const posts = await enrichPostAuthors(pagePosts || [])
  const enrichedPosts = posts.map((post) => {
    if (!post) return post
    const authorId = String(post.userId)
    const pageName = post.pageName || pageFullNames.get(authorId)
    if (pageName) {
      return {
        ...post,
        source: 'page',
        postType: 'page',
        authorType: 'page',
        pageName,
        author: pageName,
        username: pageName,
        isVerified: pageVerified.get(authorId) ?? verifiedAuthorIds.has(authorId) ?? false,
      }
    }

    return { ...post, source: post.source || 'user', postType: post.postType || 'user', authorType: post.authorType || 'user', isVerified: verifiedAuthorIds.has(authorId) }
  });
  const nextCursor = hasMore && lastPost
    ? Buffer.from(JSON.stringify({ id: lastPost.id, createdAt: lastPost.createdAt })).toString('base64url')
    : null
  res.json({ posts: enrichedPosts, hasMore, nextCursor });
});

router.post('/posts', authMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },   // existing single-photo clients
  { name: 'images', maxCount: 10 }, // new multiple-photo clients
]), async (req, res) => {
  let postUserId = req.user.id;
  let displayName = req.body?.username || req.user?.username || req.body?.user?.username || 'MiitVerse member';
  let publishedOnBehalfOfPage = null;

  // Admin accounts must not publish posts under their own identity. They may
  // only publish through a page dashboard, where the post belongs to the page.
  if (req.user.role === 'admin') {
    const behalfPageId = req.body?.onBehalfOfPageId;
    if (!behalfPageId) {
      return res.status(403).json({ message: 'Admin accounts cannot publish posts. Publish from a page dashboard instead.' });
    }

    try {
      const pages = await listPageRecords();
      const page = (pages || []).find(
        (item) => String(item?.id) === String(behalfPageId) || String(item?.ownerId) === String(behalfPageId)
      );
      if (!page) {
        return res.status(403).json({ message: 'You can only publish on behalf of an existing page.' });
      }
      postUserId = page.id;
      displayName = page.pageName || displayName;
      publishedOnBehalfOfPage = page;
    } catch (error) {
      console.error('Failed to resolve page record for admin post:', error.message);
      return res.status(500).json({ message: 'Failed to resolve page for publishing' });
    }
  }

  const content = req.body?.content || req.body?.message || '';
  const imageUrl = typeof req.body?.image === 'string' && req.body.image.trim()
    ? req.body.image
    : null;

  let resolvedImageUrl = imageUrl;

  console.log('[POST /api/social/posts] create', {
    hasBodyText: Boolean(content),
    bodyImage: typeof req.body?.image === 'string' ? req.body.image : null,
    hasFile: Boolean((req.files?.image || []).length || (req.files?.images || []).length),
    fileField: req.file?.fieldname,
    fileName: req.file?.originalname,
    mimeType: req.file?.mimetype,
    fileSize: req.file?.size,
  })

  // Multiple-photo support: every uploaded file for this submission belongs to
  // ONE post. All files are stored with the existing imageStore (MongoDB on
  // Vercel, local disk fallback in dev) and returned as usable server URLs.
  const uploadedFiles = [...(req.files?.images || []), ...(req.files?.image || [])];
  const mediaItems = [];

  for (const file of uploadedFiles) {
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'upload'}`;
    try {
      await storeImage(file.buffer, fileName, file.mimetype);
      mediaItems.push({
        url: `/api/social/uploads/${fileName}`,
        type: file.mimetype || null,
        name: file.originalname || null,
        size: Number(file.size) || null,
      });
    } catch (error) {
      console.error('[POST /api/social/posts] image store failed:', error.message);
      return res.status(503).json({ message: 'Image could not be saved. Please try again.' });
    }
  }

  if (req.file) {
    const fileName = `${Date.now()}-${req.file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'upload'}`;
    try {
      await storeImage(req.file.buffer, fileName, req.file.mimetype);
      resolvedImageUrl = `/api/social/uploads/${fileName}`;
    } catch (error) {
      console.error('[POST /api/social/posts] image store failed:', error.message);
      return res.status(503).json({ message: 'Image could not be saved. Please try again.' });
    }
  }

  // Keep the legacy single-image field working while exposing the full media
  // list. A single uploaded photo also populates `image` so old readers (Admin,
  // existing cards) keep rendering it unchanged.
  if (!resolvedImageUrl && mediaItems.length > 0) {
    resolvedImageUrl = mediaItems[0].url;
  }

  console.log('[POST /api/social/posts] stored image URL:', resolvedImageUrl, 'media count:', mediaItems.length)

  if (!content.trim() && !resolvedImageUrl) {
    return res.status(400).json({ message: 'Post content or an image is required' });
  }

  const post = createSocialPost({
    ...req.body,
    content,
    image: resolvedImageUrl,
    media: mediaItems,
    userId: postUserId,
    username: displayName,
    // Persist the author type with the post. Feed reads can then render page
    // updates even when page-record lookup is unavailable or stale.
    ...(publishedOnBehalfOfPage
      ? { source: 'page', postType: 'page', authorType: 'page', pageName: displayName }
      : { source: 'user', postType: 'user', authorType: 'user', profilePicture: req.body?.profilePicture || null }),
    suspended: false,
  });

  try {
    const persistence = await persistSocialPost(post);

    // The blue mark belongs to the account. Resolve it for the freshly created
    // post so the author's own new post shows the badge without waiting for the
    // next feed refresh. It is never persisted on the post itself.
    let authorVerified = false;
    if (publishedOnBehalfOfPage) {
      authorVerified = Boolean(publishedOnBehalfOfPage.verified);
    } else {
      try {
        authorVerified = (await listVerifiedUserIds()).has(String(postUserId));
      } catch (error) {
        console.warn('Failed to resolve author verification for new post:', error.message);
      }
    }

    return res.status(201).json({ post: { ...post, isVerified: authorVerified }, persistence });
  } catch (error) {
    // Keep Neo4j mandatory: do not report success if the graph write failed.
    console.error('Neo4j post persistence failed:', error.message);
    deleteSocialPostById(post.id);
    res.status(503).json({ message: 'Post could not be saved to Neo4j. Please try again.' });
  }
});

router.post('/posts/:id/likes', authMiddleware, async (req, res) => {
  const account = {
    id: req.user.id,
    username: req.user.username,
  }
  let result = toggleSocialPostLike(req.params.id, account)

  if (!result) {
    const [databasePost] = await listSocialPostsFromMongo({ id: String(req.params.id), includeSuspended: true })
    result = togglePostLikeOnPost(databasePost, account)
  }

  if (!result) {
    return res.status(404).json({ message: 'Post not found' })
  }

  try {
    await persistSocialPost(result.post)
  } catch (error) {
    console.error('Like persistence failed:', error.message)
  }

  res.json(result)
})

router.post('/posts/:id/comments', authMiddleware, async (req, res) => {
  const content = String(req.body?.content || '').trim()
  if (!content) return res.status(400).json({ message: 'Comment cannot be empty' })
  if (content.length > 500) return res.status(400).json({ message: 'Comment must be 500 characters or fewer' })

  const comment = {
    userId: req.user.id,
    username: req.user.username,
    content,
  }
  let result = addSocialPostComment(req.params.id, comment)

  if (!result) {
    const [databasePost] = await listSocialPostsFromMongo({ id: String(req.params.id), includeSuspended: true })
    result = addCommentToPost(databasePost, comment)
  }
  if (!result) return res.status(404).json({ message: 'Post not found' })

  try {
    await persistSocialPost(result.post)
  } catch (error) {
    console.error('Comment persistence failed:', error.message)
  }
  return res.status(201).json(result)
})

router.post('/posts/:id/reports', authMiddleware, (req, res) => {
  const post = listAllSocialPosts().find((item) => String(item?.id) === String(req.params.id));
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const { type, details } = req.body || {};
  const result = createReport({
    postId: post.id,
    reporterId: req.user.id,
    reporter: req.user.username || req.user.email,
    type,
    details,
    target: post.content?.slice(0, 120) || 'Reported post',
    author: post.pageName || post.username || post.author || 'Unknown author',
  });

  if (result.duplicate) {
    return res.status(409).json({ message: 'You have already reported this post.', report: result.report });
  }

  return res.status(201).json({ report: result.report });
});

async function findOwnedPost(req, postId) {
  const [post] = await listSocialPostsFromMongo({ id: String(postId), includeSuspended: true })
  if (!post) return null

  if (String(post.userId) === String(req.user.id) || req.user.role === 'admin') return post

  // Page posts are published on behalf of a page. The page owner (and the
  // existing page administrator) may manage those posts, but other users may
  // not use the post id to mutate them.
  if (post.source === 'page' || post.postType === 'page') {
    const pages = await listPageRecords()
    const page = (pages || []).find((item) => String(item?.id) === String(post.userId))
    if (String(page?.ownerId) === String(req.user.id)) return post
  }

  return null
}

function normalizeMediaEntry(item) {
  const url = typeof item === 'string' ? item : item?.url
  if (typeof url !== 'string' || !url.trim()) return null
  return {
    url,
    type: (typeof item === 'object' && item && item.type) || null,
    name: (typeof item === 'object' && item && item.name) || null,
    size: (typeof item === 'object' && item && item.size) ? Number(item.size) : null,
  }
}

function mediaStorageToken(url) {
  return String(url || '').split('/').filter(Boolean).pop() || ''
}

function isImageLike(url, type) {
  if (typeof type === 'string' && type.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(String(url || ''))
}

// Edit a post's text and/or media. Authorization is enforced via findOwnedPost
// (owner, admin, or page owner — otherwise 403). Users can KEEP, REMOVE, and
// ADD existing/new images and files independently, but removal is matched
// strictly against THIS post's own stored media entries, so supplying another
// post's media id or an arbitrary file name can never delete unrelated media.
router.patch('/posts/:id', authMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
]), async (req, res, next) => {
  try {
    const post = await findOwnedPost(req, req.params.id)
    if (!post) return res.status(403).json({ message: 'You can only edit your own posts.' })

    const content = String(req.body?.content ?? post.content ?? '').trim()
    if (content.length > 5000) return res.status(400).json({ message: 'Post content must be 5000 characters or fewer' })

    // User-chosen media to drop. Sent as a JSON array (application/json body)
    // or a JSON-encoded string (multipart body). Validated against this post
    // below — unmatched entries are simply ignored.
    let removeMedia = []
    const rawRemove = req.body?.removeMedia
    if (Array.isArray(rawRemove)) {
      removeMedia = rawRemove
    } else if (typeof rawRemove === 'string' && rawRemove.trim()) {
      try { removeMedia = JSON.parse(rawRemove) } catch { removeMedia = [] }
    }

    // New uploads ride the same existing upload path used for creation. Both
    // photos and ordinary files are stored through imageStore (MongoDB on
    // Render/Vercel, local disk fallback in dev).
    const uploadedFiles = [...(req.files?.images || []), ...(req.files?.image || [])]
    const newMedia = []
    for (const file of uploadedFiles) {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'upload'}`
      try {
        await storeImage(file.buffer, fileName, file.mimetype)
        newMedia.push({
          url: `/api/social/uploads/${fileName}`,
          type: file.mimetype || null,
          name: file.originalname || null,
          size: Number(file.size) || null,
        })
      } catch (error) {
        console.error('[PATCH /api/social/posts] media store failed:', error.message)
        return res.status(503).json({ message: 'Media could not be saved. Please try again.' })
      }
    }

    // Rebuild this post's media list from its own existing entries. A legacy
    // single `image` value (old posts) is folded in so it too can be kept or
    // removed, keeping old posts backward compatible.
    const existingMedia = (Array.isArray(post.media) ? post.media : []).map(normalizeMediaEntry).filter(Boolean)
    const hasLegacyImage = typeof post.image === 'string' && post.image && !existingMedia.some((entry) => entry.url === post.image)
    if (hasLegacyImage) {
      existingMedia.unshift({
        url: post.image,
        type: inferContentType(post.image.split('/').filter(Boolean).pop() || ''),
        name: null,
        size: null,
      })
    }

    const removeTokens = new Set(removeMedia.map(mediaStorageToken).filter(Boolean))
    const keptMedia = existingMedia.filter((entry) => !removeTokens.has(mediaStorageToken(entry.url)))
    const media = [...keptMedia, ...newMedia]

    const firstImage = media.find((entry) => isImageLike(entry.url, entry.type))
    const image = firstImage ? firstImage.url : (media.length > 0 ? media[0].url : null)

    if (!content && !image && media.length === 0) {
      return res.status(400).json({ message: 'Post content or media is required' })
    }

    // Build the updated post explicitly from the persisted record so editing
    // text/media never overwrites author, timestamps, reactions, comments,
    // verification-related or moderation fields.
    const updated = { ...post, content, image, media }

    await persistSocialPost(updated)
    updateSocialPostById(post.id, { content, image, media })
    return res.json({ post: updated })
  } catch (error) {
    return next(error)
  }
})

router.delete('/posts/:id', authMiddleware, async (req, res, next) => {
  try {
    const post = await findOwnedPost(req, req.params.id)
    if (!post) return res.status(403).json({ message: 'You can only delete your own posts.' })

    await deleteSocialPostFromDatabases(post.id)
    deleteSocialPostById(post.id)
    return res.json({ message: 'Deleted', id: post.id })
  } catch (error) {
    return next(error)
  }
})

router.get('/reports', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ reports: listReports() });
});

router.patch('/reports/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const status = req.body?.status;
  if (!['Open', 'Investigating', 'Resolved'].includes(status)) {
    return res.status(400).json({ message: 'Invalid report status' });
  }

  const report = updateReportById(req.params.id, { status });
  if (!report) return res.status(404).json({ message: 'Report not found' });
  return res.json({ report });
});

router.delete('/reports/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const deleted = deleteReportById(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Report not found' });
  return res.json({ message: 'Report deleted' });
});

// Admin: list all posts
router.get('/posts/all', authMiddleware, requireRole('admin'), async (req, res) => {
  const posts = await enrichPostAuthors(await listSocialPostsFromMongo({ includeSuspended: true }))
  res.json({ posts })
})

// Admin: delete a post by id
router.delete('/posts/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params || {}
  const exists = (await listSocialPostsFromMongo({ includeSuspended: true })).some((post) => String(post?.id) === String(id))
  if (!exists) return res.status(404).json({ message: 'Post not found' })
  try {
    await deleteSocialPostFromDatabases(id)
    deleteSocialPostById(id)
    return res.json({ message: 'Deleted' })
  } catch (error) {
    console.error('Post deletion failed:', error.message)
    return res.status(503).json({ message: 'Post could not be deleted from the database.' })
  }
})

// Admin: update a post (e.g., suspend/unsuspend)
router.patch('/posts/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params || {}
  const patch = req.body || {}
  const updated = updateSocialPostById(id, patch)
  if (!updated) return res.status(404).json({ message: 'Post not found' })
  try {
    await persistSocialPost(updated)
  } catch (error) {
    console.warn('Admin post update persistence failed:', error.message)
  }
  res.json({ post: updated })
})

router.get('/follows', authMiddleware, (req, res) => {
  res.json({ following: getSocialFollows(req.user.id) });
});

router.post('/follows', authMiddleware, (req, res) => {
  const { targetUser } = req.body || {};
  const currentFollowing = getSocialFollows(req.user.id);
  const nextFollowing = currentFollowing.some((entry) => (entry?.id ?? entry?.userId ?? entry?.username) === (targetUser?.id ?? targetUser?.userId ?? targetUser?.username))
    ? currentFollowing.filter((entry) => (entry?.id ?? entry?.userId ?? entry?.username) !== (targetUser?.id ?? targetUser?.userId ?? targetUser?.username))
    : [...currentFollowing, { id: targetUser?.id ?? targetUser?.userId ?? targetUser?.username, username: targetUser?.username || 'User' }];

  saveSocialFollows(req.user.id, nextFollowing);
  res.json({ following: nextFollowing });
});

export default router;
