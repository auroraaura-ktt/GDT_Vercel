import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'

function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isPublicPage = ['/', '/about', '/contact', '/login', '/register', '/verify', '/admin-login'].includes(location.pathname)
  const showAuthenticatedLinks = Boolean(user) && !isPublicPage

  return (
    <nav className="navbar">
      <div className="logo">
        <img src="/miitLogo.png" alt="MIIT Logo" />

        <div className="logo-text">
          <h2>
            Miit<span>Verse</span>
          </h2>

          <p>Official Social Hub of MIIT</p>
        </div>
      </div>

      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/contact">Contact Us</Link></li>
        {showAuthenticatedLinks ? (
          <>
            <li><Link to="/feed">Feed</Link></li>
            <li><Link to="/profile">Profile</Link></li>
          </>
        ) : (
          <>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/register">Register</Link></li>
          </>
        )}
      </ul>

      {showAuthenticatedLinks ? (
        <button className="join-btn" onClick={logout}>Logout</button>
      ) : (
        <Link className="join-btn" to="/register">Join Us</Link>
      )}
    </nav>
  )
}

export default Navbar