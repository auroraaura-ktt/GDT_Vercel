import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import '../styles/AuthDesign.css'

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const { register } = useAuth()
  const initialEmailFromQuery = new URLSearchParams(location.search).get('email') ?? ''
  const [form, setForm] = useState({ username: '', email: initialEmailFromQuery, password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailValidationMessage, setEmailValidationMessage] = useState('')

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/')
  }
  const [passwordValidation, setPasswordValidation] = useState({
    isLengthValid: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isValid: false
  })

  const validatePassword = (pwd) => {
    const hasUpperCase = /[A-Z]/.test(pwd)
    const hasLowerCase = /[a-z]/.test(pwd)
    const hasNumber = /[0-9]/.test(pwd)
    const hasSpecialChar = /[^A-Za-z0-9]/.test(pwd)
    const isLengthValid = pwd.length >= 8
    return {
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
      isLengthValid,
      isValid: hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && isLengthValid
    }
  }

  const validateEmail = (value) => {
    const normalizedEmail = value.trim().toLowerCase()

    if (!normalizedEmail) {
      return ''
    }

    return normalizedEmail.endsWith('@miit.edu.mm')
      ? ''
      : 'Only @miit.edu.mm email addresses are allowed for registration.'
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const emailMessage = validateEmail(form.email)
    if (emailMessage) {
      setEmailValidationMessage(emailMessage)
      setError(emailMessage)
      setLoading(false)
      return
    }

    if (!passwordValidation.isValid) {
      setError('Password must contain: uppercase letter, lowercase letter, number, special symbol, and be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const data = await register(form)
      navigate('/verify', {
        state: {
          email: data.email || form.email,
          resendAvailableAt: data.resendAvailableAt,
          verificationExpiresAt: data.verificationExpiresAt,
        },
      })
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="logo-section">
        <div className="logo-container">
          <img
            src="/miitLogo.png"
            alt="MIIT Logo"
            className="miit-logo"
          />
          <h1 className="logo-title">
            <span className="miit">Miit</span><span className="verse">Verse</span>
          </h1>
          <p className="logo-subtitle">Official Social Hub of MIIT</p>
        </div>
      </div>

      <div className="form-section">
        <div className="auth-container" style={{ maxWidth: '480px' }}>
          <button type="button" className="auth-back-btn" onClick={handleBack}>
            ← Back
          </button>
          <h2>Create account</h2>
          <p style={{ textAlign: 'center', color: '#8892b0', marginBottom: '24px' }}>
            Join MiitVerse as a user account.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Choose a username"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(event) => {
                  const nextEmail = event.target.value
                  setForm({ ...form, email: nextEmail })
                  setEmailValidationMessage(validateEmail(nextEmail))
                  setError('')
                }}
                required
                disabled={loading}
              />
              {emailValidationMessage && (
                <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '8px' }}>{emailValidationMessage}</p>
              )}
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Create a strong password"
                value={form.password}
                onChange={(event) => {
                  setForm({ ...form, password: event.target.value })
                  setPasswordValidation(validatePassword(event.target.value))
                }}
                required
                disabled={loading}
              />
            </div>

            {form.password && (
              <div className="password-validation">
                <div className={`validation-item ${passwordValidation.isLengthValid ? 'valid' : 'invalid'}`}>
                  <span className="check-icon">{passwordValidation.isLengthValid ? '✓' : '✗'}</span>
                  At least 8 characters
                </div>
                <div className={`validation-item ${passwordValidation.hasUpperCase ? 'valid' : 'invalid'}`}>
                  <span className="check-icon">{passwordValidation.hasUpperCase ? '✓' : '✗'}</span>
                  One uppercase letter (A-Z)
                </div>
                <div className={`validation-item ${passwordValidation.hasLowerCase ? 'valid' : 'invalid'}`}>
                  <span className="check-icon">{passwordValidation.hasLowerCase ? '✓' : '✗'}</span>
                  One lowercase letter (a-z)
                </div>
                <div className={`validation-item ${passwordValidation.hasNumber ? 'valid' : 'invalid'}`}>
                  <span className="check-icon">{passwordValidation.hasNumber ? '✓' : '✗'}</span>
                  One number (0-9)
                </div>
                <div className={`validation-item ${passwordValidation.hasSpecialChar ? 'valid' : 'invalid'}`}>
                  <span className="check-icon">{passwordValidation.hasSpecialChar ? '✓' : '✗'}</span>
                  One special symbol (!@#$%^&*)
                </div>
              </div>
            )}

            {error && <p style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

            <button type="submit" className="auth-btn" disabled={loading || !passwordValidation.isValid}>
              {loading && <span className="button-spinner" aria-hidden="true" />}
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <p className="toggle-text">
            Already have an account? <Link to="/login" style={{ color: '#64ffda', textDecoration: 'none', fontWeight: '600' }}>Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
