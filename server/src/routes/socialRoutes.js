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
import { storeImage, serveImageFromStorage } from '../utils/imageStore.js';

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

router.get('/uploads/:fileName', async (req, res) => {
  await serveImageFromStorage(req, res);
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

router.post('/posts', authMiddleware, upload.single('image'), async (req, res) => {
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
    hasFile: Boolean(req.file),
    fileField: req.file?.fieldname,
    fileName: req.file?.originalname,
    mimeType: req.file?.mimetype,
    fileSize: req.file?.size,
  })

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

  console.log('[POST /api/social/posts] stored image URL:', resolvedImageUrl)

  if (!content.trim() && !resolvedImageUrl) {
    return res.status(400).json({ message: 'Post content or an image is required' });
  }

  const post = createSocialPost({
    ...req.body,
    content,
    image: resolvedImageUrl,
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
