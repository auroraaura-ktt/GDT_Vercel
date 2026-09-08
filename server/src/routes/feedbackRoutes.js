import { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { createFeedback, deleteFeedbackById, listFeedback } from '../utils/feedbackStore.js';

const router = Router();

// Submit feedback from any authenticated user
router.post('/', authMiddleware, (req, res) => {
  const { rating, message } = req.body || {};

  try {
    const feedback = createFeedback({
      userId: req.user.id,
      username: req.user.username || req.user.email || 'MiitVerse member',
      rating,
      message,
    });

    return res.status(201).json({ feedback });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to save feedback' });
  }
});

// Admin: list all feedback
router.get('/', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ feedback: listFeedback() });
});

// Admin: delete feedback
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const deleted = deleteFeedbackById(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Feedback not found' });
  return res.json({ message: 'Feedback deleted' });
});

export default router;