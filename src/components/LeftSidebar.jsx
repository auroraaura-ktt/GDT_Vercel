import { Link } from 'react-router-dom'
import { FaHome, FaCompass, FaCalendarAlt, FaUsers, FaComments } from 'react-icons/fa'
import { useAuth } from '../context/useAuth'

const navItems = [
  { label: 'Home', icon: FaHome, to: '/' },
  { label: 'Explore', icon: FaCompass, to: '/feed' },
  { label: 'Events', icon: FaCalendarAlt, to: '/feed' },
  { label: 'Community', icon: FaUsers, to: '/feed' },
  { label: 'Messages', icon: FaComments, to: '/feed' },
]

export default function LeftSidebar({ sidebarOpen, setSidebarOpen }) {
  const { user } = useAuth()

  const initials = user?.username
    ? user.username
        .split(' ')
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : 'U'

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

      <ul className="sidebar-menu">
        {navItems.map(({ label, icon: Icon, to }) => (
          <li key={label}>
            <Link to={to}>
              <Icon />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="sidebar-divider" />
    </aside>
  )
}
