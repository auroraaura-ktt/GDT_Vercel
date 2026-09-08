import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { apiRequest } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { FaStar } from 'react-icons/fa'
import './Feedback.css'

const ratingLabels = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

export default function Feedback() {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState({ type: '', text: '' })

  const activeRating = hoverRating || rating

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!rating) {
      setStatus({ type: 'error', text: 'Please select a star rating before submitting.' })
      return
    }

    if (!message.trim()) {
      setStatus({ type: 'error', text: 'Please share a few words about your experience.' })
      return
    }

    setSubmitting(true)
    setStatus({ type: '', text: '' })

    try {
      await apiRequest('/feedback', {
        method: 'POST',
        body: JSON.stringify({ rating, message: message.trim() }),
      })

      setStatus({ type: 'success', text: 'Thank you for your feedback! Your review has been submitted.' })
      setRating(0)
      setMessage('')
    } catch (error) {
      setStatus({
        type: 'error',
        text: error.message || 'Something went wrong. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="home">
      <Navbar />

      <section className="feedback-hero">
        <h1>Share your <span>Feedback</span></h1>
        <p>
          Your opinion helps us improve MiitVerse for the entire MIIT community.
          Rate our platform and tell us how we’re doing.
        </p>
      </section>

      <section className="feedback-section">
        <div className="feedback-card">
          <div className="feedback-app">
            <img src="/miitLogo.png" alt="MiitVerse" className="feedback-app-icon" />
            <div>
              <h3>MiitVerse</h3>
              <p>Official Social Hub of MIIT</p>
            </div>
          </div>

          <div className="feedback-rating-area">
            <p className="feedback-prompt">Tap a star to rate</p>

            <div className="feedback-stars" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  key={star}
                  className={`star-btn ${star <= activeRating ? 'filled' : ''}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <FaStar />
                </button>
              ))}
            </div>

            <div className="feedback-rating-label" aria-live="polite">
              {activeRating ? ratingLabels[activeRating] : 'Rate your experience'}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="feedback-form">
            <div className="feedback-form-group">
              <label htmlFor="feedback-message">Share more details</label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value)
                  if (status.text) setStatus({ type: '', text: '' })
                }}
                placeholder="Tell us what you liked or what we can improve..."
                rows="5"
              />
            </div>

            {status.text && (
              <div className={`feedback-status ${status.type}`} role="alert">
                {status.type === 'success' ? '✓ ' : '✕ '}
                {status.text}
              </div>
            )}

            <button type="submit" className="feedback-submit" disabled={submitting}>
              {submitting && <span className="button-spinner" aria-hidden="true" />}
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  )
}