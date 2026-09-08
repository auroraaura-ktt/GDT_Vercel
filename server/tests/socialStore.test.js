import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyUserPostWeightedShuffle,
  createSocialPost,
  deleteSocialPostById,
  getVisiblePosts,
  listAllSocialPosts,
  listSocialPostsByUserId,
  shuffleUserPostsByReactions,
  toggleFollowRelationship,
} from '../src/utils/socialStore.js';

test('server-side visibility logic keeps public posts visible and followers-only posts gated', () => {
  const posts = [
    { id: 'p1', userId: 'me', visibility: 'public' },
    { id: 'p2', userId: 'friend', visibility: 'followers' },
    { id: 'p3', userId: 'other', visibility: 'private' },
  ];

  const visible = getVisiblePosts(posts, 'me', ['friend']);
  assert.deepEqual(visible.map((post) => post.id), ['p1', 'p2']);
});

test('server-side follow toggling adds and removes exact targets', () => {
  const initial = [{ id: 'friend', username: 'Friend' }];
  const added = toggleFollowRelationship(initial, { id: 'new', username: 'New' });
  assert.equal(added.length, 2);
  assert.equal(added[1].id, 'new');

  const removed = toggleFollowRelationship(added, { id: 'new', username: 'New' });
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, 'friend');
});

test('createSocialPost persists an image URL in the shared post store', () => {
  const created = createSocialPost({
    userId: 'tester',
    username: 'Tester',
    content: 'Image post',
    image: '/api/social/uploads/demo.png',
  });

  const posts = listAllSocialPosts();
  const saved = posts.find((post) => post.id === created.id);

  assert.ok(saved);
  assert.equal(saved.image, '/api/social/uploads/demo.png');

  deleteSocialPostById(created.id);
});

test('page post refresh returns posts newest first', () => {
  const testUserId = `page-refresh-test-${Date.now()}`;
  const older = createSocialPost({
    userId: testUserId,
    username: 'Test Page',
    content: 'Older page post',
    createdAt: '2026-08-18T12:00:00.000Z',
  });
  const newer = createSocialPost({
    userId: testUserId,
    username: 'Test Page',
    content: 'Newer page post',
    createdAt: '2026-08-19T12:00:00.000Z',
  });

  const refreshed = listSocialPostsByUserId(testUserId);

  assert.deepEqual(refreshed.map((post) => post.id), [newer.id, older.id]);

  deleteSocialPostById(older.id);
  deleteSocialPostById(newer.id);
});

test('server weighted shuffle prioritizes higher-reaction user posts without removing randomness', () => {
  const posts = [
    { id: 'low', likes: 1 },
    { id: 'high', likes: 75 },
    { id: 'middle', likes: 25 },
  ];

  const priorityOrder = shuffleUserPostsByReactions(posts, () => 0.5);
  assert.deepEqual(priorityOrder.map((post) => post.id), ['high', 'middle', 'low']);

  const randomValues = [0.95, 0.2, 0.6];
  const randomOrder = shuffleUserPostsByReactions(posts, () => randomValues.shift());
  assert.notDeepEqual(randomOrder.map((post) => post.id), ['high', 'middle', 'low']);
});

test('server feed sorts user and page posts by latest time', () => {
  const posts = [
    { id: 'user-old', userId: 'user-1', likes: 0, createdAt: '2026-08-16T12:00:00.000Z' },
    { id: 'page-a', userId: 'page-1', likes: 1000, createdAt: '2026-08-19T12:00:00.000Z' },
    { id: 'user-new', userId: 'user-2', likes: 100, createdAt: '2026-08-20T12:00:00.000Z' },
    { id: 'page-b', userId: 'page-2', likes: 1000, createdAt: '2026-08-18T12:00:00.000Z' },
  ];

  const shuffled = applyUserPostWeightedShuffle(posts, {
    pagePostUserIds: ['page-1', 'page-2'],
  });

  assert.deepEqual(shuffled.map((post) => post.id), [
    'user-new',
    'page-a',
    'page-b',
    'user-old',
  ]);
});
