import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

import { addSocialPostComment, listAllSocialPosts } from '../src/utils/socialStore.js';

const postsFile = join('data', 'social-posts.json');
const backupFile = join('data', 'social-posts.json.bak');

// Fixture with TWO posts so the .map iterates twice. The targeted post must NOT
// be the last one — reproducing the original failure where the broken
// destructuring-assignment-as-first-statement pattern threw "post is not a
// function" on the second iteration's `return post`.
const fixture = [
  { id: 'post-target', userId: 'u1', username: 'tester', authorType: 'user', content: 'target post', comments: [], createdAt: new Date().toISOString(), visibility: 'public' },
  { id: 'post-other', userId: 'u2', username: 'other', authorType: 'user', content: 'other post', comments: [], createdAt: new Date().toISOString(), visibility: 'public' },
];

test('addSocialPostComment persists a comment without throwing (regression for .map destructuring bug)', () => {
  // Back up real data so the test is side-effect free.
  if (existsSync(postsFile)) copyFileSync(postsFile, backupFile);
  writeFileSync(postsFile, JSON.stringify(fixture, null, 2));

  try {
    const comment = { id: 'c1', userId: 'u-comment', username: 'commenter', content: 'Hello world' };
    const result = addSocialPostComment('post-target', comment);

    assert.ok(result, 'expected addSocialPostComment to return a result, got null (would mean comment was dropped)');
    assert.ok(result.post, 'expected result.post to be present');
    assert.equal(result.post.id, 'post-target');

    const persistedComments = Array.isArray(result.post.comments) ? result.post.comments : [];
    assert.equal(persistedComments.length, 1, 'comment should be persisted on the returned post');
    assert.equal(persistedComments[0].content, 'Hello world');

    // The other post must be untouched, proving .map did not corrupt the array.
    const all = listAllSocialPosts();
    const other = all.find((p) => p.id === 'post-other');
    assert.ok(other, 'other post should still exist');
    assert.equal(Array.isArray(other.comments) ? other.comments.length : other.comments, 0);
  } finally {
    // Restore real data.
    if (existsSync(backupFile)) {
      copyFileSync(backupFile, postsFile);
    }
  }
});

