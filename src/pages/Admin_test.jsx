import "./Admin.css";

export default function Admin() {
  return (
    <>
     

      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-logo">
            <img src="/miitLogo.png" alt="MiitVerse Logo" />

            <div className="admin-logo-text">
                <h2>
                <span className="miit">Miit</span>
                <span className="verse">Verse</span>
                </h2>

                <p>Official Social Hub of MIIT</p>
                <span className="admin-panel">Admin Panel</span>
            </div>
            </div>

          <nav>
            <ul>
              <li className="active">📊 Dashboard</li>
              <li>👥 Users</li>
              <li>📝 Posts</li>
              <li>📅 Events</li>
              <li>🚩 Reports</li>
              <li>⚙️ Settings</li>
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <main className="admin-main">
          <div className="admin-header">
            <div>
              <h1>Dashboard Overview</h1>
              <p>Welcome back, Admin</p>
            </div>

            <div className="admin-profile">
              <img
                src="https://i.pravatar.cc/150?img=8"
                alt="admin"
              />
              <span>Admin</span>
            </div>
          </div>

          {/* Stats */}
          <section className="stats-grid">
            <div className="stat-card">
              <h3>👥 Users</h3>
              <h2>12,540</h2>
              <p>+8% this month</p>
            </div>

            <div className="stat-card">
              <h3>📝 Posts</h3>
              <h2>48,221</h2>
              <p>+15% this month</p>
            </div>

            <div className="stat-card">
              <h3>📅 Events</h3>
              <h2>327</h2>
              <p>+4% this month</p>
            </div>

            <div className="stat-card">
              <h3>🚩 Reports</h3>
              <h2>18</h2>
              <p>Needs review</p>
            </div>
          </section>

          {/* Bottom Section */}
          <section className="dashboard-grid">
            <div className="activity-card">
              <h2>Recent Activity</h2>

              <div className="activity-item">
                <strong>John Doe</strong> created a new event
              </div>

              <div className="activity-item">
                <strong>Sarah</strong> posted a new update
              </div>

              <div className="activity-item">
                <strong>Michael</strong> reported a post
              </div>

              <div className="activity-item">
                <strong>Emma</strong> joined MiitVerse
              </div>
            </div>

            <div className="users-card">
              <h2>Newest Users</h2>

              <div className="user-row">
                <span>Alice</span>
                <span>Today</span>
              </div>

              <div className="user-row">
                <span>James</span>
                <span>Today</span>
              </div>

              <div className="user-row">
                <span>Sophia</span>
                <span>Yesterday</span>
              </div>

              <div className="user-row">
                <span>Daniel</span>
                <span>Yesterday</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
