import { Link, useNavigate } from 'react-router-dom'
import { FaHome, FaCommentDots, FaSignOutAlt } from 'react-icons/fa'
import { useAuth } from '../context/useAuth'

const navItems = [
  { label: 'Home', icon: FaHome, to: '/' },
]

export default function LeftSidebar({ sidebarOpen, setSidebarOpen }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.username
    ? user.username
        .split(' ')
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : 'U'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`left-sidebar ${sidebarOpen ? 'active' : ''}`}>
      <div className="close-btn" onClick={() => setSidebarOpen(false)}>
        ✕
      </div>

      <div className="sidebar-logo">
        <img src="/miitLogo.png" alt="MiitVerse" className="sidebar-logo-img" />
        <div className="logo-info">
          <h2>
            Miit<span>Verse</span>
          </h2>
          <p>Official Social Hub of MIIT</p>
        </div>
      </div>

      <ul className="sidebar-menu sidebar-menu-main">
        {navItems.map(({ label, icon: Icon, to }) => (
          <li key={label}>
            <Link to={to}>
              <Icon />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="sidebar-menu sidebar-menu-bottom">
        <li>
          <Link to="/feedback">
            <FaCommentDots />
            <span>Feedback</span>
          </Link>
        </li>

        <li>
          <button type="button" className="sidebar-action-btn" onClick={handleLogout}>
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </li>
      </ul>
    </aside>
  )
}
