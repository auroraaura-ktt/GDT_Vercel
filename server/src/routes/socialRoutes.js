import { Router } from 'express';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  createSocialPost,
  getSocialFollows,
  listSocialPosts,
  saveSocialFollows,
  listAllSocialPosts,
  deleteSocialPostById,
  updateSocialPostById,
  listSocialPostsByUserId,
  toggleSocialPostLike,
} from '../utils/socialStore.js';
import { listPageRecords } from '../utils/pagePersistence.js';
import { persistSocialPost } from '../utils/socialPersistence.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadDir = resolve(__dirname, '..', '..', 'data', 'uploads');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/uploads', authMiddleware, upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  const fileName = `${Date.now()}-${file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'upload'}`;
  mkdirSync(uploadDir, { recursive: true });
  const filePath = resolve(uploadDir, fileName);
  writeFileSync(filePath, file.buffer);

  const imageUrl = `/api/social/uploads/${fileName}`;
  res.json({ imageUrl });
});

router.get('/uploads/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = resolve(uploadDir, fileName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ message: 'Image not found' });
  }

  const mimeType = fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[1];
  const contentType = mimeType ? `image/${mimeType.replace('jpg', 'jpeg')}` : 'application/octet-stream';
  const fileBuffer = readFileSync(filePath);

  res.set('Content-Type', contentType);
  res.send(fileBuffer);
});

router.get('/posts', authMiddleware, async (req, res) => {
  const { userId } = req.query || {}
  if (userId) {
    const posts = listSocialPostsByUserId(userId)
    return res.json({ posts })
  }

  const following = getSocialFollows(req.user.id);
  let pagePostUserIds = []

  try {
    const pages = await listPageRecords()
    pagePostUserIds = (pages || []).map((page) => page.ownerId || page.id).filter(Boolean)
  } catch (error) {
    console.error('Failed to load page records for feed ordering:', error.message)
  }

  const posts = listSocialPosts(req.user.id, following, { pagePostUserIds });
  res.json({ posts });
});

router.post('/posts', authMiddleware, upload.single('image'), async (req, res) => {
  const displayName = req.body?.username || req.user?.username || req.body?.user?.username || 'MiitVerse member';
  const content = req.body?.content || req.body?.message || '';
  const imageUrl = typeof req.body?.image === 'string' && req.body.image.trim()
    ? req.body.image
    : null;

  let resolvedImageUrl = imageUrl;

  if (req.file) {
    const fileName = `${Date.now()}-${req.file.originalname?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'upload'}`;
    mkdirSync(uploadDir, { recursive: true });
    const filePath = resolve(uploadDir, fileName);
    writeFileSync(filePath, req.file.buffer);
    resolvedImageUrl = `/api/social/uploads/${fileName}`;
  }

  if (!content.trim()) {
    return res.status(400).json({ message: 'Post content is required' });
  }

  const post = createSocialPost({
    ...req.body,
    content,
    image: resolvedImageUrl,
    userId: req.user.id,
    username: displayName,
    suspended: false,
  });

  try {
    const persistence = await persistSocialPost(post);
    res.status(201).json({ post, persistence });
  } catch (error) {
    // Keep Neo4j mandatory: do not report success if the graph write failed.
    console.error('Neo4j post persistence failed:', error.message);
    deleteSocialPostById(post.id);
    res.status(503).json({ message: 'Post could not be saved to Neo4j. Please try again.' });
  }
});

router.post('/posts/:id/likes', authMiddleware, (req, res) => {
  const result = toggleSocialPostLike(req.params.id, {
    id: req.user.id,
    username: req.user.username,
  })

  if (!result) {
    return res.status(404).json({ message: 'Post not found' })
  }

  res.json(result)
})

// Admin: list all posts
router.get('/posts/all', authMiddleware, requireRole('admin'), (req, res) => {
  const posts = listAllSocialPosts()
  res.json({ posts })
})

// Admin: delete a post by id
router.delete('/posts/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params || {}
  const ok = deleteSocialPostById(id)
  if (!ok) return res.status(404).json({ message: 'Post not found' })
  res.json({ message: 'Deleted' })
})

// Admin: update a post (e.g., suspend/unsuspend)
router.patch('/posts/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params || {}
  const patch = req.body || {}
  const updated = updateSocialPostById(id, patch)
  if (!updated) return res.status(404).json({ message: 'Post not found' })
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
