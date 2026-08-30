import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { apiRequest } from '../lib/api'
import './Admin.css'

export default function Admin() {
  const { user, token, logout } = useAuth()
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userActionMessage, setUserActionMessage] = useState({ type: '', text: '' })
  const [updatingUserStatus, setUpdatingUserStatus] = useState(false)
  const [userConfirmation, setUserConfirmation] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  })
  const [pageFormData, setPageFormData] = useState({
    pageName: '',
    email: '',
    password: '',
  })
  const [activeSection, setActiveSection] = useState('dashboard')
  const [creatingUser, setCreatingUser] = useState(false)
  const [createMessage, setCreateMessage] = useState({ type: '', text: '' })
  const [creatingPageAccount, setCreatingPageAccount] = useState(false)
  const [pageAccountMessage, setPageAccountMessage] = useState({ type: '', text: '' })
  const [pages, setPages] = useState([])
  const [loadingPages, setLoadingPages] = useState(false)

  const [resetPasswordUserId, setResetPasswordUserId] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetMessage, setResetMessage] = useState({ type: '', text: '' })

  const [testPostData, setTestPostData] = useState({
    author: '',
    content: '',
    image: '',
  })
  const [creatingTestPost, setCreatingTestPost] = useState(false)
  const [testPostMessage, setTestPostMessage] = useState({ type: '', text: '' })
  const [postsList, setPostsList] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [postsFilter, setPostsFilter] = useState('all') // all | user | page | suspended
  const [reportRows, setReportRows] = useState([
    { id: 'r-101', reporter: 'Jane Doe', type: 'Inappropriate Post', status: 'Open', target: 'Campus Event Reminder', author: 'MIIT Student Club' },
    { id: 'r-102', reporter: 'Alex Kim', type: 'Spam', status: 'Investigating', target: 'Free giveaway link', author: 'Random Account' },
    { id: 'r-103', reporter: 'May Win', type: 'Harassment', status: 'Open', target: 'Offensive comment thread', author: 'User A12' },
    { id: 'r-104', reporter: 'Leo Tan', type: 'Misinformation', status: 'Resolved', target: 'Fake exam timetable', author: 'Page Admin' },
  ])
  const [expandedReportId, setExpandedReportId] = useState(null)

  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteMessage, setInviteMessage] = useState({ type: '', text: '' })
  const [inviteResults, setInviteResults] = useState(null)
  const [inviting, setInviting] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setError(null)

    try {
      const data = await apiRequest('/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setUsers(data.users || [])
    } catch (err) {
      setError(err.message || 'Failed to load users')
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }, [token])

  const loadPages = useCallback(async ({ reportError = true } = {}) => {
    setLoadingPages(true)

    try {
      const data = await apiRequest('/auth/pages', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setPages(data.pages || [])
    } catch (err) {
      if (reportError) {
        setPageAccountMessage({ type: 'error', text: err.message || 'Failed to load pages' })
      }
    } finally {
      setLoadingPages(false)
    }
  }, [token])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handlePageFormChange = (e) => {
    const { name, value } = e.target
    setPageFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleTestPostChange = (e) => {
    const { name, value } = e.target
    setTestPostData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleInviteEmailsChange = (e) => {
    setInviteEmails(e.target.value)
    setInviteMessage({ type: '', text: '' })
    setInviteResults(null)
  }

  const handleSendInvitations = async (e) => {
    e.preventDefault()
    setInviteMessage({ type: '', text: '' })
    setInviteResults(null)

    const emails = inviteEmails
      .split(/[,\n;]+/)
      .map((email) => email.trim())
      .filter(Boolean)

    if (emails.length === 0) {
      setInviteMessage({ type: 'error', text: 'Enter one or more valid email addresses.' })
      return
    }

    setInviting(true)

    try {
      const data = await apiRequest('/auth/invite', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emails }),
      })

      setInviteMessage({
        type: 'success',
        text: data.invited.length > 0
          ? `Sent invitation to ${data.invited.length} address(es).`
          : 'No invitations were sent.',
      })
      setInviteResults(data)
      if (data.invited.length > 0) {
        setInviteEmails('')
      }
    } catch (err) {
      setInviteMessage({
        type: 'error',
        text: err.message || 'Failed to send invitations.',
      })
    } finally {
      setInviting(false)
    }
  }

  const handleCreateTestPost = async (e) => {
    e.preventDefault()
    setCreatingTestPost(true)
    setTestPostMessage({ type: '', text: '' })

    try {
      const data = await apiRequest('/social/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: testPostData.author.trim() || user?.username || 'Administrator',
          content: testPostData.content.trim(),
          image: testPostData.image.trim() || null,
        }),
      })

      setTestPostMessage({
        type: 'success',
        text: data.persistence?.mongoSaved
          ? 'Post saved to Neo4j and MongoDB.'
          : 'Post saved to Neo4j. MongoDB is currently unavailable.',
      })
      setTestPostData({ author: '', content: '', image: '' })
      await loadAllPosts()
    } catch (err) {
      setTestPostMessage({
        type: 'error',
        text: err.message || 'Failed to create post',
      })
    } finally {
      setCreatingTestPost(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreatingUser(true)
    setCreateMessage({ type: '', text: '' })

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData),
      })

      setCreateMessage({
        type: 'success',
        text: data.message || `Verification code sent to ${formData.email}.`,
      })
      setFormData({ username: '', email: '', password: '' })
      await loadUsers()
    } catch (err) {
      setCreateMessage({
        type: 'error',
        text: err.message || 'Failed to create user',
      })
    } finally {
      setCreatingUser(false)
    }
  }

  const handleCreatePageAccount = async (e) => {
    e.preventDefault()
    setCreatingPageAccount(true)
    setPageAccountMessage({ type: '', text: '' })

    try {
      const data = await apiRequest('/auth/create-page-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pageFormData),
      })

      setPageAccountMessage({
        type: 'success',
        text: data.message || `Page account ${pageFormData.pageName || pageFormData.email} created successfully.`,
      })
      if (data.page) {
        setPages((currentPages) => [
          data.page,
          ...currentPages.filter(
            (page) => page.id !== data.page.id && String(page.email).toLowerCase() !== String(data.page.email).toLowerCase()
          ),
        ])
      }
      setPageFormData({ pageName: '', email: '', password: '' })
      await loadUsers()
      await loadPages({ reportError: false })
    } catch (err) {
      setPageAccountMessage({
        type: 'error',
        text: err.message || 'Failed to create page account',
      })
    } finally {
      setCreatingPageAccount(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResettingPassword(true)
    setResetMessage({ type: '', text: '' })

    try {
      const data = await apiRequest('/users/reset-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: resetPasswordUserId,
          newPassword,
        }),
      })

      setResetMessage({
        type: 'success',
        text: `Password reset for ${data.user.username} successfully!`,
      })
      if (selectedUser?.id === resetPasswordUserId) {
        setUserActionMessage({
          type: 'success',
          text: `Password reset for ${data.user.username} successfully.`,
        })
      }
      setResetPasswordUserId(null)
      setNewPassword('')
      await loadUsers()
    } catch (err) {
      setResetMessage({
        type: 'error',
        text: err.message || 'Failed to reset password',
      })
    } finally {
      setResettingPassword(false)
    }
  }

  const handleDeleteUser = async (userId, username) => {
    try {
      await apiRequest(`/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
        setActiveSection('users')
      }
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to delete user')
    }
  }

  const openUserDetails = (userItem) => {
    setSelectedUser(userItem)
    setUserActionMessage({ type: '', text: '' })
    setActiveSection('user-details')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const applyUserSuspension = async () => {
    if (!selectedUser || selectedUser.id === user?.id) return

    const nextSuspended = !selectedUser.suspended
    setUpdatingUserStatus(true)
    setUserActionMessage({ type: '', text: '' })
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(selectedUser.id)}/suspension`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suspended: nextSuspended }),
      })
      const updatedUser = { ...selectedUser, ...data.user }
      setSelectedUser(updatedUser)
      setUsers((currentUsers) => currentUsers.map((item) => item.id === updatedUser.id ? { ...item, ...updatedUser } : item))
      setUserActionMessage({ type: 'success', text: data.message })
    } catch (err) {
      setUserActionMessage({ type: 'error', text: err.message || 'Failed to update account status' })
    } finally {
      setUpdatingUserStatus(false)
    }
  }

  const requestUserSuspension = () => {
    if (!selectedUser || selectedUser.id === user?.id) return
    setUserConfirmation({
      type: selectedUser.suspended ? 'restore' : 'suspend',
      user: selectedUser,
    })
  }

  const requestUserDeletion = () => {
    if (!selectedUser || selectedUser.id === user?.id) return
    setUserConfirmation({ type: 'delete', user: selectedUser })
  }

  const confirmUserAction = async () => {
    if (!userConfirmation) return
    const { type: actionType, user: targetUser } = userConfirmation
    setUserConfirmation(null)

    if (actionType === 'delete') {
      await handleDeleteUser(targetUser.id, targetUser.fullName || targetUser.username)
      return
    }

    await applyUserSuspension()
  }

  async function loadAllPosts() {
    setLoadingPosts(true)
    try {
      // fetch all posts from server (admin-only)
      const data = await apiRequest('/social/posts/all', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const fetchedPages = await (async () => {
        try {
          const pagesData = await apiRequest('/auth/pages', { headers: { Authorization: `Bearer ${token}` } })
          return pagesData.pages || []
        } catch (e) {
          return pages || []
        }
      })()

      const posts = (data.posts || []).map((p) => {
        const matchedPage = (fetchedPages || []).find((pg) => pg.id === p.userId)
        const isPage = Boolean(matchedPage)
        return {
          ...p,
          source: isPage ? 'page' : 'user',
          author: p.username || p.author || 'User',
          pageName: matchedPage?.pageName || null,
        }
      })

      setPostsList(posts)
    } catch (err) {
      setPostsList([])
    } finally {
      setLoadingPosts(false)
    }
  }

  const handleDeletePost = (post) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return

    ;(async () => {
      try {
        await apiRequest(`/social/posts/${encodeURIComponent(post.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        await loadAllPosts()
      } catch (err) {
        setError(err.message || 'Failed to delete post')
      }
    })()
  }

  const handleToggleSuspend = (post) => {
    const toggle = !post.suspended

    ;(async () => {
      try {
        await apiRequest(`/social/posts/${encodeURIComponent(post.id)}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ suspended: toggle }),
        })
        await loadAllPosts()
      } catch (err) {
        setError(err.message || 'Failed to update post')
      }
    })()
  }

  const newestUsers = users.slice(0, 6)

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers()
    }

    if (activeSection === 'page-accounts') {
      loadPages()
    }
    if (activeSection === 'posts') {
      loadAllPosts()
    }
  }, [activeSection, loadUsers, loadPages])

  const sidebarItems = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'users', label: '👥 Manage Users' },
    { key: 'page-accounts', label: '🌐 Page Accounts' },
    { key: 'posts', label: '📝 Posts' },
    { key: 'invitations', label: '✉ Invitations' },
    { key: 'reports', label: '🚩 Reports' },
  ]

  const pageTitles = {
    dashboard: 'Dashboard Overview',
    users: 'Manage Users',
    'page-accounts': 'Page Accounts',
    posts: 'Posts',
    invitations: 'Invitations',
    reports: 'Reports',
    'user-details': 'User Details',
  }

  const pageDescriptions = {
    dashboard: 'Welcome back, Admin',
    users: 'Create and manage personal accounts from here.',
    'page-accounts': 'Create special MIIT page accounts without email verification.',
    posts: 'Manage posts and content moderation.',
    invitations: 'Invite users via email and send a registration link.',
    reports: 'Review flagged reports and moderation tasks.',
    'user-details': 'Review account information and complete management actions.',
  }

  const goToSection = (key) => {
    setActiveSection(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'users':
        return (
          <>
            <section className="admin-users">
              <div className="admin-users-header">
                <h2>Manage Users</h2>
                <p>Load and manage all registered accounts from this page.</p>
              </div>

              {loadingUsers && <p>Loading users...</p>}
              {error && <p className="error-text">{error}</p>}

              {!loadingUsers && users.length === 0 && !error && (
                <p>No users loaded yet. Use the sidebar to refresh this view.</p>
              )}

              {users.length > 0 && (
                <div className="admin-users-table-wrap">
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Created At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((userItem) => (
                        <tr key={userItem.id}>
                          <td>{userItem.fullName || userItem.username}</td>
                          <td>{userItem.email}</td>
                          <td>{userItem.role}</td>
                          <td>{new Date(userItem.createdAt).toLocaleString()}</td>
                          <td className="admin-action-cell">
                            <button
                              type="button"
                              className="admin-more-actions-btn"
                              onClick={() => openUserDetails(userItem)}
                            >
                              More actions →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      case 'user-details': {
        if (!selectedUser) {
          return (
            <section className="admin-user-details-empty">
              <h2>No user selected</h2>
              <p>Choose a user from Manage Users to view their account details.</p>
              <button type="button" className="admin-more-actions-btn" onClick={() => goToSection('users')}>Go to Manage Users</button>
            </section>
          )
        }

        const displayName = selectedUser.fullName || selectedUser.username || 'MiitVerse user'
        const initials = displayName.split(' ').filter(Boolean).map((part) => part[0]?.toUpperCase()).join('').slice(0, 2) || 'U'
        const isCurrentAdmin = selectedUser.id === user?.id

        return (
          <section className="admin-user-details">
            <button type="button" className="admin-back-button" onClick={() => goToSection('users')}>← Back to Manage Users</button>
            <div className="admin-user-profile-card">
              <div className="admin-user-avatar">{initials}</div>
              <div className="admin-user-profile-copy">
                <p className="admin-eyebrow">ACCOUNT PROFILE</p>
                <h2>{displayName}</h2>
                <p>{selectedUser.email}</p>
                <div className="admin-user-badges"><span className="admin-role-badge">{selectedUser.role || 'user'}</span><span className={`admin-status-badge ${selectedUser.suspended ? 'suspended' : 'active'}`}>{selectedUser.suspended ? 'Suspended' : 'Active'}</span></div>
              </div>
            </div>

            {userActionMessage.text && <p className={`message message-${userActionMessage.type}`}>{userActionMessage.text}</p>}

            <div className="admin-user-details-grid">
              <section className="admin-user-info-card">
                <p className="admin-eyebrow">ACCOUNT INFORMATION</p>
                <h3>Details</h3>
                <dl>
                  <div><dt>Account name</dt><dd>{displayName}</dd></div>
                  <div><dt>Email address</dt><dd>{selectedUser.email}</dd></div>
                  <div><dt>Role</dt><dd>{selectedUser.role || 'user'}</dd></div>
                  <div><dt>Joined</dt><dd>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'Not available'}</dd></div>
                  <div><dt>Account ID</dt><dd className="admin-user-id">{selectedUser.id}</dd></div>
                </dl>
              </section>

              <section className="admin-user-actions-card">
                <p className="admin-eyebrow">ADMIN ACTIONS</p>
                <h3>Manage this account</h3>
                <p>Actions take effect immediately. Use suspension to block sign-in without removing account data.</p>
                <button type="button" className="admin-reset-btn" onClick={() => setResetPasswordUserId(selectedUser.id)}>Reset password</button>
                <button type="button" className="admin-suspend-btn" disabled={isCurrentAdmin || updatingUserStatus} onClick={requestUserSuspension}>{updatingUserStatus ? 'Updating…' : selectedUser.suspended ? 'Restore account' : 'Suspend account'}</button>
                <button type="button" className="admin-delete-btn" disabled={isCurrentAdmin} onClick={requestUserDeletion}>Delete account</button>
                {isCurrentAdmin && <small>You cannot suspend or delete your own admin account.</small>}
              </section>
            </div>
          </section>
        )
      }
      case 'page-accounts':
        return (
          <section id="page-accounts" className="admin-page-accounts">
            <div className="admin-create-header">
              <h2>Create Page Account</h2>
              <p>Create a special MIIT page account with a virtual @miitverse.com identity. These accounts do not require a real inbox and can be used like regular signed-in accounts.</p>
            </div>

            {pageAccountMessage.text && (
              <p className={`message message-${pageAccountMessage.type}`}>
                {pageAccountMessage.text}
              </p>
            )}

            <div className="admin-create-form">
              <div className="form-group">
                <label htmlFor="pageName">Page Name</label>
                <input
                  type="text"
                  id="pageName"
                  name="pageName"
                  value={pageFormData.pageName}
                  onChange={handlePageFormChange}
                  placeholder="MiitVerse BlueMark"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pageEmail">Email</label>
                <input
                  type="email"
                  id="pageEmail"
                  name="email"
                  value={pageFormData.email}
                  onChange={handlePageFormChange}
                  placeholder="page@miitverse.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pagePassword">Password</label>
                <input
                  type="password"
                  id="pagePassword"
                  name="password"
                  value={pageFormData.password}
                  onChange={handlePageFormChange}
                  required
                />
              </div>

              <button type="submit" className="form-submit" disabled={creatingPageAccount} onClick={handleCreatePageAccount}>
                {creatingPageAccount ? 'Creating account...' : 'Create Page Account'}
              </button>
            </div>

            <div className="admin-users-table-wrap" style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '12px' }}>Created Pages</h3>
              {loadingPages && <p>Loading pages...</p>}
              {!loadingPages && pages.length === 0 && <p>No pages created yet.</p>}
              {!loadingPages && pages.length > 0 && (
                <div className="admin-page-list">
                  {pages.map((pageItem) => (
                    <div className="admin-page-card" key={pageItem.id}>
                      <div>
                        <h4>{pageItem.pageName}</h4>
                        <p>{pageItem.email}</p>
                      </div>
                      <div className="admin-page-card-actions">
                        <span className="admin-page-badge">{pageItem.role || 'page'}</span>
                        <button
                          type="button"
                          className="admin-reset-btn"
                          onClick={() => setResetPasswordUserId(pageItem.ownerId || pageItem.id)}
                        >
                          Reset Password
                        </button>
                        <a className="admin-button" href={`/page/${pageItem.slug}`}>
                          Open Dashboard
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      case 'posts':
        return (
          <section id="posts" className="admin-page-accounts">
            <div className="admin-create-header">
              <h2>Posts Management</h2>
              <p>Review posts created by users and page accounts. You can delete or suspend posts from here.</p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <button type="button" className={`admin-nav-item admin-post-filter-btn ${postsFilter === 'all' ? 'active' : ''}`} onClick={() => setPostsFilter('all')}>All</button>
              <button type="button" className={`admin-nav-item admin-post-filter-btn ${postsFilter === 'user' ? 'active' : ''}`} onClick={() => setPostsFilter('user')} style={{ marginLeft: '8px' }}>User Posts</button>
              <button type="button" className={`admin-nav-item admin-post-filter-btn ${postsFilter === 'page' ? 'active' : ''}`} onClick={() => setPostsFilter('page')} style={{ marginLeft: '8px' }}>Page Posts</button>
              <button type="button" className={`admin-nav-item admin-post-filter-btn ${postsFilter === 'suspended' ? 'active' : ''}`} onClick={() => setPostsFilter('suspended')} style={{ marginLeft: '8px' }}>Suspended</button>
              <button type="button" onClick={() => loadAllPosts()} style={{ marginLeft: '12px' }}>Refresh</button>
            </div>

            <form className="admin-create-form" onSubmit={handleCreateTestPost} style={{ marginBottom: '20px' }}>
              <h3>Create post</h3>
              {testPostMessage.text && <p className={`message message-${testPostMessage.type}`}>{testPostMessage.text}</p>}
              <div className="form-group">
                <label htmlFor="postAuthor">Display name (optional)</label>
                <input id="postAuthor" name="author" value={testPostData.author} onChange={handleTestPostChange} disabled={creatingTestPost} />
              </div>
              <div className="form-group">
                <label htmlFor="postContent">Content</label>
                <textarea id="postContent" name="content" value={testPostData.content} onChange={handleTestPostChange} disabled={creatingTestPost} required />
              </div>
              <div className="form-group">
                <label htmlFor="postImage">Image URL (optional)</label>
                <input id="postImage" name="image" type="url" value={testPostData.image} onChange={handleTestPostChange} disabled={creatingTestPost} />
              </div>
              <button type="submit" disabled={creatingTestPost}>{creatingTestPost ? 'Saving…' : 'Publish post'}</button>
            </form>

            {loadingPosts && <p>Loading posts...</p>}

            {!loadingPosts && postsList.length === 0 && (
              <p>No posts found.</p>
            )}

            {!loadingPosts && postsList.length > 0 && (
              <div className="admin-posts-list">
                {postsList.filter((p) => {
                  if (postsFilter === 'all') return true
                  if (postsFilter === 'user') return p.source === 'user'
                  if (postsFilter === 'page') return p.source === 'page'
                  if (postsFilter === 'suspended') return p.suspended
                  return true
                }).map((post) => (
                  <div key={post.id} className="admin-post-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{post.source === 'page' ? `${post.pageName} (page)` : post.author}</strong>
                        <small>{post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}</small>
                      </div>
                      <p style={{ marginTop: '6px' }}>{post.content}</p>
                      {post.image ? <img src={post.image} alt="post" style={{ maxWidth: '240px', marginTop: '6px' }} /> : null}
                    </div>
                    <div className="admin-post-actions">
                      <button type="button" className="admin-delete-btn" onClick={() => handleDeletePost(post)}>Delete</button>
                      <button type="button" className="admin-reset-btn" onClick={() => handleToggleSuspend(post)}>{post.suspended ? 'Unsuspend' : 'Suspend'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      case 'invitations':
        return (
          <section className="admin-page-accounts admin-invite-section">
            <div className="admin-create-header admin-invite-header">
              <span className="admin-invite-icon" aria-hidden="true">✉</span>
              <div>
                <h2>Send Invitations</h2>
                <p>Invite MIIT users by entering one or more email addresses. Each invite includes a registration link with an embedded action button.</p>
              </div>
            </div>

            {inviteMessage.text && (
              <p className={`message message-${inviteMessage.type}`}>{inviteMessage.text}</p>
            )}

            <form className="admin-create-form admin-invite-form" onSubmit={handleSendInvitations}>
              <div className="form-group admin-invite-field">
                <div className="admin-invite-field-head">
                  <label htmlFor="inviteEmails">Invitation emails</label>
                  <span>{inviteEmails.split(/[,\n;]+/).map((email) => email.trim()).filter(Boolean).length} entered</span>
                </div>
                <textarea
                  id="inviteEmails"
                  value={inviteEmails}
                  onChange={handleInviteEmailsChange}
                  placeholder={'student@miit.edu.mm\nname@miit.edu.mm'}
                  rows={6}
                  disabled={inviting}
                  required
                />
                <small>Separate addresses with commas, semicolons, or new lines. Use @miit.edu.mm addresses only.</small>
              </div>

              <button type="submit" className="form-submit" disabled={inviting}>
                {inviting ? 'Sending invitations...' : 'Send invitations'}
              </button>
            </form>

            {inviteResults && (
              <div className="admin-invite-results">
                <div className="admin-invite-summary">
                  <strong>Invited:</strong> {inviteResults.invited.length}
                  <br />
                  <strong>Failed:</strong> {inviteResults.failed.length}
                </div>

                {inviteResults.failed.length > 0 && (
                  <div className="admin-invite-failed">
                    <h4>Failed invitations</h4>
                    <ul>
                      {inviteResults.failed.map((failure) => (
                        <li key={failure.email}>
                          <strong>{failure.email}</strong>: {failure.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      case 'reports':
        return (
          <section className="admin-page-accounts">
            <div className="admin-create-header">
              <h2>{pageTitles[activeSection]}</h2>
              <p>{pageDescriptions[activeSection]}</p>
            </div>

            <div className="admin-users-table-wrap admin-report-table-wrap">
              <table className="admin-users-table admin-reports-table">
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Reported Content</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((report) => (
                    <tr key={report.id}>
                      <td>{report.reporter}</td>
                      <td>
                        <div className="admin-report-target">
                          <strong>{report.target}</strong>
                          <span>by {report.author}</span>
                        </div>
                      </td>
                      <td>{report.type}</td>
                      <td>
                        <span className={`admin-report-status ${report.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="admin-report-action-cell">
                        <div className="admin-report-action-wrap">
                          <button
                            type="button"
                            className="admin-more-actions-btn"
                            onClick={() => setExpandedReportId((currentId) => currentId === report.id ? null : report.id)}
                          >
                            More actions →
                          </button>

                          {expandedReportId === report.id && (
                            <div className="admin-report-action-menu">
                              <button type="button" onClick={() => window.alert(`Previewing report: ${report.target}`)}>Preview</button>
                              <button type="button" onClick={() => {
                                setReportRows((currentRows) => currentRows.map((item) => item.id === report.id ? { ...item, status: 'Resolved' } : item));
                                setExpandedReportId(null);
                              }}>
                                Resolve
                              </button>
                              <button type="button" className="admin-delete-btn" onClick={() => {
                                setReportRows((currentRows) => currentRows.filter((item) => item.id !== report.id));
                                setExpandedReportId(null);
                              }}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      default:
        return (
          <>
            <section id="dashboard" className="stats-grid">
              <div className="stat-card">
                <h3>👥 Users</h3>
                <h2>{users.length || 12540}</h2>
                <p>+8% this month</p>
              </div>

              <div className="stat-card">
                <h3>📝 Posts</h3>
                <h2>48,221</h2>
                <p>+15% this month</p>
              </div>

              <div className="stat-card">
                <h3>� Reports</h3>
                <h2>18</h2>
                <p>Needs review</p>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="users-card full-width-users-card">
                <h2>Newest Users</h2>
                {newestUsers.length > 0 ? (
                  newestUsers.map((userItem) => (
                    <div className="user-row" key={userItem.id}>
                      <span>{userItem.fullName || userItem.username}</span>
                      <span>{new Date(userItem.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="user-row">
                    <span>No users loaded</span>
                    <span>—</span>
                  </div>
                )}
              </div>
            </section>
          </>
        )
    }
  }

  return (
    <div className="admin-layout">
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
            {sidebarItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={`admin-nav-item ${activeSection === item.key ? 'active' : ''}`}
                  onClick={() => goToSection(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <div>
            <h1>Dashboard Overview</h1>
            <p>Welcome back, Admin</p>
          </div>

          <div className="admin-profile">
            <img src="https://i.pravatar.cc/150?img=8" alt="admin" />
            <span>{user?.username || user?.email}</span>
          </div>
        </div>

        <div className="admin-actions">
          <button className="admin-logout" type="button" onClick={logout}>
            Log out
          </button>
        </div>

        <div className="admin-page-shell">
          <div className="admin-page-heading">
            <h1>{pageTitles[activeSection]}</h1>
            <p>{pageDescriptions[activeSection]}</p>
          </div>

          {renderContent()}
        </div>

        {resetPasswordUserId && (
          <section className="admin-reset-password">
            <div className="reset-password-modal">
              <div className="reset-password-header">
                <h3>Reset Password</h3>
                <button
                  type="button"
                  className="reset-password-close"
                  onClick={() => setResetPasswordUserId(null)}
                >
                  ✕
                </button>
              </div>

              {resetMessage.text && (
                <p className={`message message-${resetMessage.type}`}>
                  {resetMessage.text}
                </p>
              )}

              <form onSubmit={handleResetPassword} className="reset-password-form">
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="reset-password-actions">
                  <button
                    type="submit"
                    className="form-submit"
                    disabled={resettingPassword}
                  >
                    {resettingPassword ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button
                    type="button"
                    className="form-cancel"
                    onClick={() => {
                      setResetPasswordUserId(null)
                      setNewPassword('')
                      setResetMessage({ type: '', text: '' })
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {userConfirmation && (
          <section className="admin-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
            <div className="admin-confirm-dialog">
              <span className={`admin-confirm-icon ${userConfirmation.type}`}>{userConfirmation.type === 'delete' ? '!' : '✓'}</span>
              <p className="admin-eyebrow">CONFIRM ACTION</p>
              <h3 id="admin-confirm-title">{userConfirmation.type === 'delete' ? 'Delete this account?' : userConfirmation.type === 'suspend' ? 'Suspend this account?' : 'Restore this account?'}</h3>
              <p>{userConfirmation.type === 'delete' ? `This permanently removes ${userConfirmation.user.fullName || userConfirmation.user.username}'s account and cannot be undone.` : userConfirmation.type === 'suspend' ? `${userConfirmation.user.fullName || userConfirmation.user.username} will no longer be able to sign in until the account is restored.` : `${userConfirmation.user.fullName || userConfirmation.user.username} will be able to sign in again.`}</p>
              <div className="admin-confirm-actions">
                <button type="button" className="form-cancel" onClick={() => setUserConfirmation(null)}>Cancel</button>
                <button type="button" className={userConfirmation.type === 'delete' ? 'admin-delete-btn' : userConfirmation.type === 'suspend' ? 'admin-suspend-btn' : 'form-submit'} onClick={confirmUserAction}>{userConfirmation.type === 'delete' ? 'Delete account' : userConfirmation.type === 'suspend' ? 'Suspend account' : 'Restore account'}</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
