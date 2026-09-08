import { Link } from "react-router-dom";
import { FaMoon, FaSync } from "react-icons/fa";
import { useAuth } from "../context/useAuth";
import VerifiedBadge from "./VerifiedBadge";

export default function RightSidebar({ darkMode, setDarkMode, onRefresh }) {
  const { user } = useAuth();

  const initials = user?.username
    ? user.username
        .split(" ")
        .map((part) => part[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "U";

  return (
    <aside className="right-sidebar">
      <div className="profile-card">
        <div className="profile-avatar-large">{initials}</div>
        <h3>{user?.username || "MiitVerse User"} {user?.verified && <VerifiedBadge size="small" />}</h3>
        <p>{user?.email || "Guest member"}</p>
        {user ? (
          <Link className="profile-btn" to="/profile">View Profile</Link>
        ) : (
          <Link className="profile-btn" to="/login">Sign in</Link>
        )}
      </div>

      <div className="feed-sidebar-controls">
        <button type="button" className="feed-sidebar-action-btn refresh-btn" onClick={onRefresh}>
          <FaSync />
          <span>Refresh</span>
        </button>

        <button type="button" className="feed-sidebar-action-btn theme-btn" onClick={() => setDarkMode(!darkMode)}>
          <FaMoon />
          <span>{darkMode ? "Light" : "Night"}</span>
        </button>
      </div>
    </aside>
  );
}
