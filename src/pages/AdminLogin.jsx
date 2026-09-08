import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { canUseUserLogin } from '../lib/authAccess'
import '../styles/AuthDesign.css'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await login(form)
      const user = data.user

      if (canUseUserLogin(user.role)) {
        setError('This account is not allowed to access admin.')
        return
      }

      const from = location.state?.from?.pathname || '/admin'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Admin login failed')
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
        <div className="auth-container">
          <button type="button" className="auth-back-btn" onClick={handleBack}>
            ← Back
          </button>
          <h2>Admin Login</h2>
          <p style={{ textAlign: 'center', color: '#8892b0', marginBottom: '24px' }}>
            Use an admin account to enter the dashboard.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </div>

            {error && <p style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading && <span className="button-spinner" aria-hidden="true" />}
              {loading ? 'Signing in...' : 'Enter Admin'}
            </button>
          </form>

          <p className="toggle-text">
            Not an admin? <Link to="/login" style={{ color: '#64ffda', textDecoration: 'none', fontWeight: '600' }}>Go to regular login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}