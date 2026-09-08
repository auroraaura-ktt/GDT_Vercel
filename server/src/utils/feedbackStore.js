import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', '..', 'data');
const feedbackFile = resolve(dataDir, 'feedback.json');

function readFeedback() {
  if (!existsSync(feedbackFile)) return [];

  try {
    const feedback = JSON.parse(readFileSync(feedbackFile, 'utf8'));
    return Array.isArray(feedback) ? feedback : [];
  } catch {
    return [];
  }
}

function writeFeedback(feedback) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(feedbackFile, JSON.stringify(feedback, null, 2));
}

export function listFeedback() {
  return readFeedback().sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}

export function createFeedback(feedback = {}) {
  const items = readFeedback();

  const rating = Math.min(5, Math.max(1, Number(feedback.rating) || 5));
  const message = String(feedback.message || '').trim();

  if (!message) {
    throw new Error('Feedback message is required');
  }

  const nextFeedback = {
    id: feedback.id || `feedback-${Date.now()}`,
    userId: feedback.userId,
    username: feedback.username || 'MiitVerse member',
    rating,
    message,
    createdAt: feedback.createdAt || new Date().toISOString(),
  };

  writeFeedback([nextFeedback, ...items]);
  return nextFeedback;
}

export function deleteFeedbackById(feedbackId) {
  if (!feedbackId) return false;

  const items = readFeedback();
  const nextItems = items.filter((item) => String(item.id) !== String(feedbackId));
  if (nextItems.length === items.length) return false;

  writeFeedback(nextItems);
  return true;
}