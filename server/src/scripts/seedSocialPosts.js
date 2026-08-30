import { createSocialPost } from '../utils/socialStore.js';

const samplePosts = [
  {
    id: 'sample-public-1',
    userId: 'miitverse',
    username: 'MiitVerse',
    content: 'Welcome to the public community feed. Share updates, stories, and ideas with everyone.',
    visibility: 'public',
    likes: 18,
    comments: [],
    reposts: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-public-2',
    userId: 'aung',
    username: 'Aung',
    content: 'New creators are joining every day. Follow the people you want to see more from.',
    visibility: 'public',
    likes: 11,
    comments: [],
    reposts: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-public-3',
    userId: 'sara',
    username: 'Sara',
    content: 'Public posts make it easy to discover fresh conversations from the wider community.',
    visibility: 'public',
    likes: 9,
    comments: [],
    reposts: 2,
    createdAt: new Date().toISOString(),
  },
];

for (const post of samplePosts) {
  createSocialPost(post);
}

console.log(`Seeded ${samplePosts.length} public sample posts`);
