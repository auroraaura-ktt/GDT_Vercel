import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPagePost, normalizePagePosts } from '../src/lib/pagePosts.js';

test('buildPagePost trims content and adds default fields', () => {
  const post = buildPagePost({
    content: '  Hello from the page  ',
    slug: 'miitverse',
    authorName: 'MiitVerse',
    userId: 'page-1',
  });

  assert.equal(post.content, 'Hello from the page');
  assert.equal(post.slug, 'miitverse');
  assert.equal(post.authorName, 'MiitVerse');
  assert.equal(post.likes, 0);
  assert.equal(post.comments, 0);
});

test('normalizePagePosts sorts newest posts first', () => {
  const posts = normalizePagePosts([
    { id: 'old', createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'new', createdAt: '2024-01-02T00:00:00.000Z' },
  ]);

  assert.deepEqual(posts.map((post) => post.id), ['new', 'old']);
});
