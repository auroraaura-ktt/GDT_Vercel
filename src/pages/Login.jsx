import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { apiRequest } from '../lib/api'
import { canAccessUserApp } from '../lib/authAccess'
import '../styles/AuthDesign.css'

export default function Login() {
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

      if (!canAccessUserApp(user.role)) {
        setError('This account is not allowed to access the regular user area.')
        return
      }

      if (user.role === 'page') {
        const normalizeSlug = (value = '') =>
          String(value)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

        // Redirect page accounts directly to their own dashboard
        if (user.pageSlug) {
          navigate(`/page/${encodeURIComponent(user.pageSlug)}`, { replace: true })
          return
        }

        // Fallback to owner lookup if slug wasn't included in login response
        try {
          const pageData = await apiRequest(`/auth/pages/owner/${encodeURIComponent(user.id)}`, {
            headers: { Authorization: `Bearer ${data.token}` },
          })

          if (pageData?.page?.slug) {
            navigate(`/page/${encodeURIComponent(pageData.page.slug)}`, { replace: true })
            return
          }
        } catch {
          // fallback to inferred slug
        }

        const fallbackSlug = normalizeSlug(user.username || (user.email || '').split('@')[0])
        if (fallbackSlug) {
          navigate(`/page/${encodeURIComponent(fallbackSlug)}`, { replace: true })
          return
        }
      }

      if (user.role === 'admin') {
        navigate(location.state?.from?.pathname || '/admin', { replace: true })
        return
      }

      const destination = location.state?.from?.pathname || '/feed'
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
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
          <h2>Login</h2>
          <p style={{ textAlign: 'center', color: '#8892b0', marginBottom: '24px' }}>
            Use your account to access MiitVerse.
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
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <p className="toggle-text">
            Need an account? <Link to="/register" style={{ color: '#64ffda', textDecoration: 'none', fontWeight: '600' }}>Register</Link>
          </p>
          <p className="toggle-text">
            <Link to="/admin-login" style={{ color: '#64ffda', textDecoration: 'none', fontWeight: '600' }}>Admin Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}