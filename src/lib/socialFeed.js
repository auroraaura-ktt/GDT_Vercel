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

function sortPagePostsByLatest(posts = []) {
  return [...(posts || [])].sort((left, right) => {
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });
}

export function applyUserPostWeightedShuffle(posts = [], options = {}) {
  const pagePostUserIds = options.pagePostUserIds || options.pageUserIds || [];
  const random = options.random || Math.random;
  const pagePosts = [];
  const userPosts = [];

  for (const post of posts || []) {
    if (isPagePost(post, pagePostUserIds)) pagePosts.push(post);
    else userPosts.push(post);
  }

  const shuffledUserPosts = shuffleUserPostsByReactions(userPosts, random);
  return [...sortPagePostsByLatest(pagePosts), ...shuffledUserPosts];
}

export function getVisiblePosts(posts = [], currentUserId = null, following = [], options = {}) {
  const followingIds = new Set((following || []).map((entry) => entry?.id ?? entry));

  const visiblePosts = (posts || []).filter((post) => {
    if (!post) return false;

    if (post.visibility === 'public') return true;
    if (!currentUserId) return false;
    if (post.userId === currentUserId) return true;
    if (post.visibility === 'followers' && followingIds.has(post.userId)) return true;
    if (post.visibility === 'private') return false;
    return true;
  });

  return applyUserPostWeightedShuffle(visiblePosts, options);
}

export function shouldPersistSocialPost({ user, ready, authToken }) {
  if (typeof authToken === 'string' && authToken.trim()) {
    return true;
  }

  return ready && Boolean(user?.id);
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
