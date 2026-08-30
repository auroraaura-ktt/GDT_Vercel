import { FaBars } from 'react-icons/fa'

export default function TopBar({ setSidebarOpen }) {
  return (
    <div className="feed-topbar">
      <div className="menu-btn" onClick={() => setSidebarOpen(true)}>
        <FaBars />
      </div>

      <div className="feed-topbar-spacer" aria-hidden="true" />
    </div>
  )
}
