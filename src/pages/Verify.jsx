import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import '../styles/AuthDesign.css'

const RESEND_COOLDOWN_MS = 3 * 60 * 1000
const PENDING_VERIFICATION_KEY = 'miitverse-pending-verification'

function readPendingVerification() {
  try {
    const raw = window.localStorage.getItem(PENDING_VERIFICATION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function savePendingVerification(data) {
  if (!data?.email) return

  window.localStorage.setItem(
    PENDING_VERIFICATION_KEY,
    JSON.stringify({
      email: data.email,
      resendAvailableAt: data.resendAvailableAt,
      verificationExpiresAt: data.verificationExpiresAt,
    })
  )
}

function clearPendingVerification() {
  window.localStorage.removeItem(PENDING_VERIFICATION_KEY)
}

function getDeadlineMs(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}


function formatCountdown(totalMs) {
  const totalSeconds = Math.max(Math.ceil(totalMs / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Verify() {
  const navigate = useNavigate()
  const location = useLocation()
  const storedPending = useMemo(() => readPendingVerification(), [])
  const stateEmail = location.state?.email || ''
  const initialEmail = stateEmail || storedPending?.email || ''
  const initialResendAvailableAt = location.state?.resendAvailableAt || storedPending?.resendAvailableAt
  const initialVerificationExpiresAt = location.state?.verificationExpiresAt || storedPending?.verificationExpiresAt
  const initialResendDeadlineMs = getDeadlineMs(initialResendAvailableAt) || (initialEmail ? Date.now() + RESEND_COOLDOWN_MS : 0)

  const [email, setEmail] = useState(initialEmail)
  const [codeDigits, setCodeDigits] = useState(Array(8).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')
  const [resendDeadlineMs, setResendDeadlineMs] = useState(initialResendDeadlineMs)
  const [remainingMs, setRemainingMs] = useState(() => Math.max(initialResendDeadlineMs - Date.now(), 0))
  const [resendLoading, setResendLoading] = useState(false)
  const inputRefs = useRef([])

  const codeValue = codeDigits.join('')
  const isCodeComplete = codeDigits.every((digit) => digit !== '')

  const focusOtpInput = (index) => {
    const input = inputRefs.current[index]
    if (input) {
      input.focus()
    }
  }

  const handleOtpChange = (index, event) => {
    const entered = event.target.value.replace(/\D/g, '').slice(-1)
    const values = [...codeDigits]

    values[index] = entered
    setCodeDigits(values)

    if (entered && index < values.length - 1) {
      focusOtpInput(index + 1)
    }
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const values = [...codeDigits]

      if (values[index]) {
        values[index] = ''
        setCodeDigits(values)
        return
      }

      if (index > 0) {
        values[index - 1] = ''
        setCodeDigits(values)
        focusOtpInput(index - 1)
      }
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusOtpInput(index - 1)
    }

    if (event.key === 'ArrowRight' && index < codeDigits.length - 1) {
      event.preventDefault()
      focusOtpInput(index + 1)
    }
  }

  const handleOtpPaste = (index, event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return

    const values = [...codeDigits]
    for (let i = 0; i < pasted.length && index + i < values.length; i += 1) {
      values[index + i] = pasted[i]
    }

    setCodeDigits(values)
    const nextIndex = Math.min(values.length - 1, index + pasted.length)
    focusOtpInput(nextIndex)
  }

  useEffect(() => {
    if (!initialEmail) return

    savePendingVerification({
      email: initialEmail,
      resendAvailableAt: new Date(initialResendDeadlineMs).toISOString(),
      verificationExpiresAt: initialVerificationExpiresAt,
    })
  }, [initialEmail, initialResendDeadlineMs, initialVerificationExpiresAt])

  useEffect(() => {
    const updateRemaining = () => {
      setRemainingMs(Math.max(resendDeadlineMs - Date.now(), 0))
    }

    updateRemaining()

    if (resendDeadlineMs <= Date.now()) return undefined

    const timerId = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timerId)
  }, [resendDeadlineMs])

  function rememberCooldown(data) {
    const nextResendAvailableAt = data?.resendAvailableAt || new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString()
    const pending = {
      email: data?.email || email,
      resendAvailableAt: nextResendAvailableAt,
      verificationExpiresAt: data?.verificationExpiresAt,
    }

    savePendingVerification(pending)
    setResendDeadlineMs(getDeadlineMs(nextResendAvailableAt))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    if (!/^\d{8}$/.test(codeValue)) {
      setError('Verification code must be 8 digits')
      setLoading(false)
      return
    }

    try {
      setInfo('Verifying your email...')
      await apiRequest('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code: codeValue }),
      })

      clearPendingVerification()
      setInfo('Email verified successfully. Redirecting to login...')
      window.setTimeout(() => {
        navigate('/login')
      }, 1000)
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setResendLoading(true)

    try {
      const data = await apiRequest('/auth/verify/resend', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      rememberCooldown({ ...data, email })
      setInfo('Verification email resent. Check your inbox.')
    } catch (err) {
      if (err.data?.resendAvailableAt) {
        rememberCooldown({ email, resendAvailableAt: err.data.resendAvailableAt })
      }

      setError(err.message || 'Unable to resend verification email')
    } finally {
      setResendLoading(false)
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
        <div className="auth-container">
          <h2>Verify email</h2>
          <p style={{ textAlign: 'center', color: '#8892b0', marginBottom: '24px' }}>
            Enter the 8-digit code sent to your email.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || resendLoading}
              />
            </div>

            <div className="input-group">
              <label>Verification Code (8 digits)</label>
              <div className="otp-inputs">
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="1"
                    className="otp-box"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={(e) => handleOtpPaste(index, e)}
                    disabled={loading || resendLoading}
                    aria-label={`Verification digit ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {error && <p style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}
            {info && <p style={{ color: '#64ffda', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{info}</p>}

            <button type="submit" className="auth-btn" disabled={loading || !isCodeComplete}>
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>
          </form>

          {remainingMs > 0 ? (
            <p style={{ marginTop: '16px', fontSize: '14px', color: '#8892b0', textAlign: 'center' }}>
              Resend available in {formatCountdown(remainingMs)}
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || !email}
              className="auth-btn"
              style={{ marginTop: '16px', background: 'rgba(100, 255, 218, 0.2)', color: '#64ffda', border: '1px solid #64ffda' }}
            >
              {resendLoading ? 'Resending...' : 'Resend verification email'}
            </button>
          )}

          <p style={{ marginTop: '20px', fontSize: '14px', color: '#8892b0', textAlign: 'center' }}>
            Check your spam folder if you do not see the code.
          </p>
        </div>
      </div>
    </div>
  )
}
