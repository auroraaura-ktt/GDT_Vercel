export function buildPagePost(input = {}) {
  const content = String(input.content || '').trim();

  return {
    id: input.id || `page-post-${Date.now()}`,
    slug: input.slug || 'page',
    userId: input.userId || 'page',
    username: input.username || input.author || input.pageName || input.authorName || 'Page',
    author: input.author || input.pageName || input.authorName || input.username || 'Page',
    pageName: input.pageName || input.authorName || input.username || 'Page',
    content,
    image: input.image || null,
    createdAt: input.createdAt || new Date().toISOString(),
    likes: Number(input.likes || 0),
    comments: Number(input.comments || 0),
    shares: Number(input.shares || 0),
  };
}

export function normalizePagePosts(posts = []) {
  return [...posts].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}
