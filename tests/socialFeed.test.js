import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyUserPostWeightedShuffle,
  getVisiblePosts,
  isPagePost,
  shouldPersistSocialPost,
  shuffleUserPostsByReactions,
  toggleFollowRelationship,
} from '../src/lib/socialFeed.js';

test('getVisiblePosts keeps public posts visible to everyone', () => {
  const posts = [
    { id: 1, userId: 'me', visibility: 'public' },
    { id: 2, userId: 'other', visibility: 'private' },
    { id: 3, userId: 'friend', visibility: 'followers' },
  ];

  const visible = getVisiblePosts(posts, 'me', ['friend'], { random: () => 0.5 });

  assert.deepEqual(visible.map((post) => post.id), [1, 3]);
});

test('toggleFollowRelationship adds or removes a follow target', () => {
  const initial = [{ id: 'friend', username: 'Friend' }];

  const added = toggleFollowRelationship(initial, { id: 'new', username: 'New' });
  assert.equal(added.length, 2);
  assert.equal(added[1].id, 'new');

  const removed = toggleFollowRelationship(added, { id: 'new', username: 'New' });
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, 'friend');
});

test('shouldPersistSocialPost uses server persistence when an auth token is present', () => {
  const result = shouldPersistSocialPost({
    user: null,
    ready: false,
    authToken: '{"token":"abc"}',
  });

  assert.equal(result, true);
});

test('shouldPersistSocialPost stays local-only for unauthenticated users', () => {
  const result = shouldPersistSocialPost({
    user: null,
    ready: true,
    authToken: '',
  });

  assert.equal(result, false);
});

test('shuffleUserPostsByReactions gives higher-reaction user posts more priority with equal randomness', () => {
  const posts = [
    { id: 'low', likes: 5 },
    { id: 'high', likes: 100 },
    { id: 'middle', likes: 50 },
  ];

  const shuffled = shuffleUserPostsByReactions(posts, () => 0.5);

  assert.deepEqual(shuffled.map((post) => post.id), ['high', 'middle', 'low']);
});

test('shuffleUserPostsByReactions still randomizes user posts', () => {
  const posts = [
    { id: 'first', likes: 10 },
    { id: 'second', likes: 10 },
    { id: 'third', likes: 10 },
  ];
  const randomValues = [0.1, 0.9, 0.8];

  const shuffled = shuffleUserPostsByReactions(posts, () => randomValues.shift());

  assert.deepEqual(shuffled.map((post) => post.id), ['second', 'third', 'first']);
});

test('applyUserPostWeightedShuffle sorts user and page posts by latest time', () => {
  const posts = [
    { id: 'user-old', userId: 'user-1', likes: 1, createdAt: '2026-08-18T12:00:00.000Z' },
    { id: 'page-new', userId: 'page-1', likes: 0, createdAt: '2026-08-20T12:00:00.000Z' },
    { id: 'user-new', userId: 'user-2', likes: 100, createdAt: '2026-08-19T12:00:00.000Z' },
    { id: 'page-old', userId: 'page-2', likes: 0, createdAt: '2026-08-17T12:00:00.000Z' },
  ];

  const shuffled = applyUserPostWeightedShuffle(posts, {
    pagePostUserIds: ['page-1', 'page-2'],
  });

  assert.deepEqual(shuffled.map((post) => post.id), ['page-new', 'user-new', 'user-old', 'page-old']);
});

test('getVisiblePosts keeps all visible posts in latest-first order', () => {
  const posts = [
    { id: 'user-old', userId: 'user-1', likes: 1, visibility: 'public', createdAt: '2026-08-18T12:00:00.000Z' },
    { id: 'page-new', userId: 'page-1', likes: 0, visibility: 'public', source: 'page', createdAt: '2026-08-19T12:00:00.000Z' },
    { id: 'user-new', userId: 'user-2', likes: 1, visibility: 'public', createdAt: '2026-08-20T12:00:00.000Z' },
  ];

  const visible = getVisiblePosts(posts, 'me', [], {
  });

  assert.deepEqual(visible.map((post) => post.id), ['user-new', 'page-new', 'user-old']);
});

test('isPagePost separates page posts from normal user posts', () => {
  const posts = [
    { id: 'user-1', userId: 'u1', source: 'user' },
    { id: 'page-1', userId: 'p1', source: 'page', pageName: 'Page One' },
    { id: 'page-2', userId: 'p2', postType: 'page' },
    { id: 'user-2', userId: 'u2' },
  ];

  const pagePosts = posts.filter((post) => isPagePost(post));
  const userPosts = posts.filter((post) => !isPagePost(post));

  assert.deepEqual(pagePosts.map((post) => post.id), ['page-1', 'page-2']);
  assert.deepEqual(userPosts.map((post) => post.id), ['user-1', 'user-2']);
});

test('isPagePost identifies page posts by userId when a page list is provided', () => {
  const posts = [
    { id: 'page-3', userId: 'p3' },
    { id: 'user-3', userId: 'u3' },
  ];

  const pagePosts = posts.filter((post) => isPagePost(post, ['p3']));
  assert.deepEqual(pagePosts.map((post) => post.id), ['page-3']);
});
