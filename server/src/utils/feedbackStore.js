import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', '..', 'data');
const feedbackFile = resolve(dataDir, 'feedback.json');

const feedbackSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, default: '' },
    username: { type: String, default: 'MiitVerse member' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { timestamps: true }
)

const FeedbackModel = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema)

function isMongoReady() {
  return mongoose.connection?.readyState === 1
}

function serializeFeedback(item = {}) {
  const createdAt = item.createdAt instanceof Date
    ? item.createdAt.toISOString()
    : item.createdAt

  return {
    id: item.id != null ? String(item.id) : '',
    userId: item.userId != null ? String(item.userId) : '',
    username: item.username || 'MiitVerse member',
    rating: Number(item.rating) || 0,
    message: item.message || '',
    createdAt,
  }
}

function readFeedbackFile() {
  if (!existsSync(feedbackFile)) return [];

  try {
    const feedback = JSON.parse(readFileSync(feedbackFile, 'utf8'));
    return Array.isArray(feedback) ? feedback.map(serializeFeedback) : [];
  } catch {
    return [];
  }
}

function writeFeedbackFile(feedback) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(feedbackFile, JSON.stringify(feedback, null, 2));
}

function sortFeedback(items) {
  return [...items].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

export async function listFeedback() {
  if (isMongoReady()) {
    const docs = await FeedbackModel.find({}).sort({ createdAt: -1 }).lean()
    const mongoItems = docs.map(serializeFeedback)
    if (mongoItems.length > 0) {
      return mongoItems
    }

    const fileItems = readFeedbackFile()
    if (fileItems.length > 0) {
      await FeedbackModel.insertMany(fileItems, { ordered: false }).catch(() => {})
      return sortFeedback(fileItems)
    }

    return []
  }

  return sortFeedback(readFeedbackFile())
}

export async function createFeedback(feedback = {}) {
  const rating = Math.min(5, Math.max(1, Number(feedback.rating) || 5));
  const message = String(feedback.message || '').trim();

  if (!message) {
    throw new Error('Feedback message is required');
  }

  const nextFeedback = serializeFeedback({
    id: feedback.id || `feedback-${Date.now()}`,
    userId: feedback.userId,
    username: feedback.username || 'MiitVerse member',
    rating,
    message,
    createdAt: feedback.createdAt || new Date().toISOString(),
  });

  if (isMongoReady()) {
    await FeedbackModel.create({
      ...nextFeedback,
      createdAt: new Date(nextFeedback.createdAt),
    })
    return nextFeedback
  }

  console.warn('MongoDB is not connected; storing feedback on local disk. Admin dashboards on other hosts will not see it.')
  const items = readFeedbackFile();
  writeFeedbackFile([nextFeedback, ...items]);
  return nextFeedback;
}

export async function deleteFeedbackById(feedbackId) {
  if (!feedbackId) return false;
  const targetId = String(feedbackId)

  if (isMongoReady()) {
    const result = await FeedbackModel.deleteOne({ id: targetId })
    if (result.deletedCount > 0) return true
  }

  const items = readFeedbackFile();
  const nextItems = items.filter((item) => String(item.id) !== targetId);
  if (nextItems.length === items.length) return false;

  writeFeedbackFile(nextItems);
  return true;
}
