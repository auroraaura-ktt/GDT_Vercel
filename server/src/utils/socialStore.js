import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { persistSocialPost, deleteSocialPostFromMongo } from './socialPersistence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', '..', 'data');
const postsFile = resolve(dataDir, 'social-posts.json');
const followsFile = resolve(dataDir, 'social-follows.json');
const uploadsDir = resolve(dataDir, 'uploads');

function ensureDataStore() {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(uploadsDir, { recursive: true });
}

function readJson(filePath, fallbackValue) {
  if (!existsSync(filePath)) return fallbackValue;

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  ensureDataStore();
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function getVisiblePosts(posts = [], currentUserId = null, following = []) {
  const followingIds = new Set((following || []).map((entry) => entry?.id ?? entry));

  return (posts || []).filter((post) => {
    if (!post) return false;
    if (post.visibility === 'public') return true;
    if (!currentUserId) return false;
    if (post.userId === currentUserId) return true;
    if (post.visibility === 'followers' && followingIds.has(post.userId)) return true;
    return false;
  });
}

export function getPostReactionCount(post = {}) {
  const likes = Math.max(Number(post.likes || 0), Array.isArray(post.likedBy) ? post.likedBy.length : 0);
  const comments = Array.isArray(post.comments) ? post.comments.length : Number(post.comments || 0);
  const reposts = Number(post.reposts ?? post.shares ?? 0);

  return Math.max(0, likes + comments + reposts);
}

export function isPagePost(post = {}, pagePostUserIds = []) {
  if (!post) return false;
  if (post.source === 'page' || post.postType === 'page') return true;

  const pageIds = pagePostUserIds instanceof Set ? pagePostUserIds : new Set(pagePostUserIds || []);
  return pageIds.has(post.userId) || pageIds.has(String(post.userId));
}

export function shuffleUserPostsByReactions(posts = [], random = Math.random) {
  return [...(posts || [])]
    .map((post, index) => {
      const reactionWeight = Math.log1p(getPostReactionCount(post)) + 1;
      const randomValue = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, random()));
      return {
        post,
        index,
        priority: randomValue ** (1 / reactionWeight),
      };
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      return left.index - right.index;
    })
    .map((entry) => entry.post);
}

function sortPostsByLatest(posts = []) {
  return [...(posts || [])].sort((left, right) => {
    const rightTime = Date.parse(right.createdAt || '');
    const leftTime = Date.parse(left.createdAt || '');
    if (Number.isNaN(rightTime) && Number.isNaN(leftTime)) return 0;
    if (Number.isNaN(rightTime)) return 1;
    if (Number.isNaN(leftTime)) return -1;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return String(right.id || '').localeCompare(String(left.id || ''));
  });
}

export function applyUserPostWeightedShuffle(posts = [], options = {}) {
  return sortPostsByLatest(posts);
}

export function toggleFollowRelationship(currentFollowing = [], targetUser = null) {
  if (!targetUser) return currentFollowing;

  const targetId = targetUser.id ?? targetUser.userId ?? targetUser.username;
  if (!targetId) return currentFollowing;

  const exists = currentFollowing.some((entry) => (entry?.id ?? entry?.userId ?? entry?.username) === targetId);

  if (exists) {
    return currentFollowing.filter((entry) => (entry?.id ?? entry?.userId ?? entry?.username) !== targetId);
  }

  return [...currentFollowing, { id: targetId, username: targetUser.username || 'User' }];
}

export function listSocialPosts(currentUserId = null, following = [], options = {}) {
  const posts = readJson(postsFile, []);
  return applyUserPostWeightedShuffle(getVisiblePosts(posts, currentUserId, following), options);
}

export function listSocialPostsPage(currentUserId = null, following = [], options = {}) {
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 8));
  const cursor = options.cursor || null;
  const visiblePosts = applyUserPostWeightedShuffle(getVisiblePosts(readJson(postsFile, []), currentUserId, following));
  const startIndex = cursor
    ? visiblePosts.findIndex((post) => String(post.id) === String(cursor.id)) + 1
    : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const posts = visiblePosts.slice(safeStartIndex, safeStartIndex + limit);
  const hasMore = safeStartIndex + posts.length < visiblePosts.length;
  const lastPost = posts.at(-1);

  return {
    posts,
    hasMore,
    nextCursor: hasMore && lastPost
      ? { id: lastPost.id, createdAt: lastPost.createdAt }
      : null,
  };
}

export function listAllSocialPosts() {
  return readJson(postsFile, []);
}

export function listSocialPostsByUserId(userId) {
  if (!userId) return [];
  const posts = readJson(postsFile, []);
  return sortPostsByLatest(
    (posts || []).filter((p) => p && (p.userId === userId || p.userId === String(userId)))
  );
}

export function deleteSocialPostById(postId) {
  if (!postId) return false;
  const posts = readJson(postsFile, []);
  const updated = (posts || []).filter((p) => p && String(p.id) !== String(postId));
  writeJson(postsFile, updated);
  void deleteSocialPostFromMongo(postId).catch((error) => {
    console.warn('MongoDB post delete failed:', error.message);
  });
  return true;
}

export function updateSocialPostById(postId, patch = {}) {
  if (!postId) return null;
  const posts = readJson(postsFile, []);
  let changed = null;
  const updated = (posts || []).map((p) => {
    if (!p || String(p.id) !== String(postId)) return p;
    const next = { ...p, ...patch };
    changed = next;
    return next;
  });
  writeJson(postsFile, updated);
  if (changed) {
    void persistSocialPost(changed).catch((error) => {
      console.warn('MongoDB post update failed:', error.message);
    });
  }
  return changed;
}

export function createSocialPost(post) {
  const posts = readJson(postsFile, []);
  let imagePath = null;

  if (post.imageFile) {
    const fileName = `${Date.now()}-${post.imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const destination = resolve(uploadsDir, fileName);
    copyFileSync(post.imageFile.path, destination);
    imagePath = `/api/social/uploads/${fileName}`;
  }

  const nextPost = {
    id: post.id || `post-${randomUUID()}`,
    userId: post.userId || 'guest',
    username: post.username || 'MiitVerse member',
    source: post.source || 'user',
    postType: post.postType || (post.source === 'page' ? 'page' : 'user'),
    authorType: post.authorType || (post.source === 'page' ? 'page' : 'user'),
    pageName: post.pageName || null,
    profilePicture: post.profilePicture || null,
    content: post.content || '',
    image: post.image || imagePath || null,
    media: Array.isArray(post.media) ? post.media : [],
    createdAt: post.createdAt || new Date().toISOString(),
    likes: Number(post.likes || 0),
    likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
    comments: Array.isArray(post.comments) ? post.comments : [],
    reposts: Number(post.reposts || 0),
    shares: Number(post.shares ?? post.reposts ?? 0),
    visibility: post.visibility || 'public',
  };

  const nextPosts = [nextPost, ...posts];
  writeJson(postsFile, nextPosts);
  return nextPost;
}

export function toggleSocialPostLike(postId, account) {
  if (!postId || !account?.id) return null

  const posts = readJson(postsFile, [])
  let result = null
  const updated = posts.map((post) => {
    if (!post || String(post.id) !== String(postId)) return post

    result = togglePostLikeOnPost(post, account)
    return result.post
  })

  if (!result) return null
  writeJson(postsFile, updated)
  void persistSocialPost(result.post).catch((error) => {
    console.warn('MongoDB like sync failed:', error.message)
  })
  return result
}

export function togglePostLikeOnPost(post, account) {
  if (!post || !account?.id) return null

  const likedBy = Array.isArray(post.likedBy) ? post.likedBy : []
  const existingIndex = likedBy.findIndex((entry) => String(entry?.userId) === String(account.id))
  const nextLikedBy = existingIndex >= 0
    ? likedBy.filter((_, index) => index !== existingIndex)
    : [...likedBy, { userId: String(account.id), username: account.username || 'MiitVerse member' }]
  const legacyLikes = Math.max(Number(post.likes || 0), likedBy.length)
  const nextPost = {
    ...post,
    likedBy: nextLikedBy,
    likes: existingIndex >= 0 ? Math.max(0, legacyLikes - 1) : legacyLikes + 1,
  }

  return { post: nextPost, reacted: existingIndex < 0 }
}

export function addSocialPostComment(postId, comment) {
  if (!postId || !comment?.userId || !String(comment.content || '').trim()) return null

  const posts = readJson(postsFile, [])
  let updatedPost = null
  const updated = posts.map((post) => {
    if (!post || String(post.id) !== String(postId)) return post

    const added = addCommentToPost(post, comment)
    if (!added) return post
    updatedPost = added.post
    return updatedPost
  })

  if (!updatedPost) return null
  writeJson(postsFile, updated)
  void persistSocialPost(updatedPost).catch((error) => {
    console.warn('MongoDB comment sync failed:', error.message)
  })
  return { post: updatedPost, comment: updatedPost.comments.at(-1) }
}

export function addCommentToPost(post, comment) {
  if (!post || !comment?.userId || !String(comment.content || '').trim()) return null

  const nextComment = {
    id: comment.id || `comment-${Date.now()}`,
    userId: String(comment.userId),
    username: comment.username || 'MiitVerse member',
    content: String(comment.content).trim().slice(0, 500),
    createdAt: comment.createdAt || new Date().toISOString(),
  }
  const updatedPost = {
    ...post,
    comments: [...(Array.isArray(post.comments) ? post.comments : []), nextComment],
  }

  return { post: updatedPost, comment: nextComment }
}

export function getSocialFollows(userId) {
  const follows = readJson(followsFile, {});
  return follows[userId] || [];
}

export function saveSocialFollows(userId, following) {
  const follows = readJson(followsFile, {});
  follows[userId] = following;
  writeJson(followsFile, follows);
  return following;
}
