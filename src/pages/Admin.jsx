import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { apiRequest, resolveApiUrl } from '../lib/api'
import { invalidateVerifiedAuthorsCache } from '../lib/useVerifiedAuthors'
import LoadingState from '../components/LoadingState'
import VerifiedBadge from '../components/VerifiedBadge'
import { FaStar } from 'react-icons/fa'
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
  const [reportRows, setReportRows] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [expandedReportId, setExpandedReportId] = useState(null)

  const [feedbackRows, setFeedbackRows] = useState([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteMessage, setInviteMessage] = useState({ type: '', text: '' })
  const [inviteResults, setInviteResults] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [inviteHistory, setInviteHistory] = useState([])
  const [loadingInviteHistory, setLoadingInviteHistory] = useState(false)
  const [inviteHistoryError, setInviteHistoryError] = useState('')

  const loadInviteHistory = useCallback(async () => {
    setLoadingInviteHistory(true)
    setInviteHistoryError('')
    try {
      const data = await apiRequest('/auth/invitations/history', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setInviteHistory(data.history || [])
    } catch (err) {
      setInviteHistoryError(err.message || 'Failed to load invitation history')
    } finally {
      setLoadingInviteHistory(false)
    }
  }, [token])

  const [usersTab, setUsersTab] = useState('regular') // regular | admin
  const [updatingVerified, setUpdatingVerified] = useState(false)
  const [verifyingUserId, setVerifyingUserId] = useState(null)
  const [updatingPageVerified, setUpdatingPageVerified] = useState(null)
  const [selectedPage, setSelectedPage] = useState(null)

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

  const loadReports = useCallback(async () => {
    setLoadingReports(true)
    try {
      const data = await apiRequest('/social/reports', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setReportRows(data.reports || [])
    } catch (err) {
      setError(err.message || 'Failed to load reports')
      setReportRows([])
    } finally {
      setLoadingReports(false)
    }
  }, [token])

  const handleReportStatusChange = async (reportId, status) => {
    try {
      const data = await apiRequest(`/social/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      setReportRows((currentRows) => currentRows.map((item) => item.id === reportId ? data.report : item))
      setExpandedReportId(null)
    } catch (err) {
      setError(err.message || 'Failed to update report')
    }
  }

  const handleDeleteReport = async (reportId) => {
    try {
      await apiRequest(`/social/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setReportRows((currentRows) => currentRows.filter((item) => item.id !== reportId))
      setExpandedReportId(null)
    } catch (err) {
      setError(err.message || 'Failed to delete report')
    }
  }

  const loadFeedback = useCallback(async () => {
    setLoadingFeedback(true)
    setFeedbackError('')
    try {
      const data = await apiRequest('/feedback', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFeedbackRows(Array.isArray(data.feedback) ? data.feedback : [])
    } catch (err) {
      setFeedbackError(err.message || 'Failed to load feedback')
      setFeedbackRows([])
    } finally {
      setLoadingFeedback(false)
    }
  }, [token])

  const handleDeleteFeedback = async (feedbackId) => {
    try {
      await apiRequest(`/feedback/${encodeURIComponent(feedbackId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setFeedbackRows((currentRows) => currentRows.filter((item) => item.id !== feedbackId))
    } catch (err) {
      setError(err.message || 'Failed to delete feedback')
    }
  }

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

  // Copies one of the fixed MiitVerse invitation links to the clipboard.
  const handleCopyInviteLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setInviteMessage({ type: 'success', text: `Copied invitation link: ${url}` })
    } catch {
      setInviteMessage({ type: 'error', text: `Could not copy the link. Please copy it manually: ${url}` })
    }
  }

  const handleSendInvitations = async (e) => {
    e.preventDefault()
    setInviteMessage({ type: '', text: '' })
    setInviteResults(null)

    const emails = inviteEmails
      .split(/[,\n;]+/)
      .map((email) => email.trim().toLowerCase())
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
        loadInviteHistory()
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

  const handleDeletePageAccount = async (targetPage) => {
    try {
      await apiRequest(`/users/${targetPage.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setPages((currentPages) => currentPages.filter((item) => item.id !== targetPage.id))
      if (selectedPage?.id === targetPage.id) {
        setSelectedPage(null)
        setActiveSection('page-accounts')
      }
      setPageAccountMessage({ type: 'success', text: `Page account "${targetPage.pageName || targetPage.email}" deleted successfully.` })
      await loadPages()
    } catch (err) {
      setPageAccountMessage({ type: 'error', text: err.message || 'Failed to delete page account' })
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

  const handleToggleVerified = async () => {
    if (!selectedUser) return
    const nextVerified = !selectedUser.verified
    setUpdatingVerified(true)
    setUserActionMessage({ type: '', text: '' })
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(selectedUser.id)}/verified`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: nextVerified }),
      })
      const updatedUser = { ...selectedUser, ...data.user }
      setSelectedUser(updatedUser)
      setUsers((currentUsers) => currentUsers.map((item) => item.id === updatedUser.id ? { ...item, ...updatedUser } : item))
      invalidateVerifiedAuthorsCache()
      setUserActionMessage({ type: 'success', text: data.message })
    } catch (err) {
      setUserActionMessage({ type: 'error', text: err.message || 'Failed to update blue mark status' })
    } finally {
      setUpdatingVerified(false)
    }
  }

  // Toggle verification directly from the Manage Users list (Admin only).
  const handleListToggleVerified = async (targetUser) => {
    if (!targetUser?.id) return
    const nextVerified = !targetUser.verified
    setVerifyingUserId(targetUser.id)
    setError(null)
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(targetUser.id)}/verified`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: nextVerified }),
      })
      const updatedUser = { ...targetUser, ...data.user }
      setUsers((currentUsers) => currentUsers.map((item) => item.id === updatedUser.id ? { ...item, ...updatedUser } : item))
      invalidateVerifiedAuthorsCache()
      if (selectedUser?.id === updatedUser.id) {
        setSelectedUser(updatedUser)
      }
    } catch (err) {
      setError(err.message || 'Failed to update blue mark status')
    } finally {
      setVerifyingUserId(null)
    }
  }

  const handleTogglePageVerified = async (pageItem) => {
    const nextVerified = pageItem.verified === false
    setUpdatingPageVerified(pageItem.id)
    setPageAccountMessage({ type: '', text: '' })
    try {
      const data = await apiRequest(`/auth/pages/${encodeURIComponent(pageItem.id)}/verified`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: nextVerified }),
      })
      const updatedPage = { ...pageItem, verified: data.page?.verified ?? nextVerified }
      setPages((currentPages) => currentPages.map((item) => item.id === updatedPage.id ? { ...item, ...updatedPage } : item))
      if (selectedPage?.id === updatedPage.id) {
        setSelectedPage(updatedPage)
      }
      // Republish the shared verified-accounts set so every open Feed (this
      // tab and other tabs) re-resolves the blue mark immediately for all of
      // the page's past, current, and future posts.
      invalidateVerifiedAuthorsCache()
      setPageAccountMessage({ type: 'success', text: data.message })
    } catch (err) {
      setPageAccountMessage({ type: 'error', text: err.message || 'Failed to update page blue mark' })
    } finally {
      setUpdatingPageVerified(null)
    }
  }

  const openPageDetails = (pageItem) => {
    setSelectedPage(pageItem)
    setPageAccountMessage({ type: '', text: '' })
    setActiveSection('page-details')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const requestPageDeletion = () => {
    if (!selectedPage) return
    setUserConfirmation({ type: 'delete', user: selectedPage })
  }

  const confirmUserAction = async () => {
    if (!userConfirmation) return
    const { type: actionType, user: targetUser } = userConfirmation
    setUserConfirmation(null)

    if (actionType === 'delete') {
      if (targetUser.role === 'page') {
        await handleDeletePageAccount(targetUser)
        return
      }
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

      const posts = (data.posts || []).map((p) => {
        const authorType = p.authorType || (p.source === 'page' || p.postType === 'page' ? 'page' : 'user')
        return {
          ...p,
          source: authorType,
          authorType,
          author: p.username || p.author || 'User',
          pageName: p.pageName || null,
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
  const regularUsers = users.filter((userItem) => userItem.role !== 'admin')
  const adminUsers = users.filter((userItem) => userItem.role === 'admin')

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers()
    }

    if (activeSection === 'page-accounts') {
      loadPages()
    }
    if (activeSection === 'invitations') {
      loadInviteHistory()
    }
    if (activeSection === 'posts') {
      loadAllPosts()
    }
    if (activeSection === 'reports') {
      loadReports()
    }
    if (activeSection === 'feedback') {
      loadFeedback()
    }
    if (activeSection === 'dashboard') {
      loadUsers()
      loadPages({ reportError: false })
      loadAllPosts()
      loadReports()
      loadFeedback()
    }
  }, [activeSection, loadUsers, loadPages, loadInviteHistory, loadReports, loadFeedback])

  const sidebarItems = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'users', label: '👥 Manage Users' },
    { key: 'page-accounts', label: '🌐 Page Accounts' },
    { key: 'posts', label: '📝 Posts' },
    { key: 'invitations', label: '✉ Invitations' },
    { key: 'reports', label: '🚩 Reports' },
    { key: 'feedback', label: '⭐ Feedback' },
  ]

  const pageTitles = {
    dashboard: 'Dashboard Overview',
    users: 'Manage Users',
    'page-accounts': 'Page Accounts',
    posts: 'Posts',
    invitations: 'Invitations',
    reports: 'Reports',
    feedback: 'User Feedback',
    'user-details': 'User Details',
    'page-details': 'Page Account Details',
  }

  const pageDescriptions = {
    dashboard: 'Welcome back, Admin',
    users: 'Create and manage personal accounts from here.',
    'page-accounts': 'Create special MIIT page accounts without email verification.',
    posts: 'Manage posts and content moderation.',
    invitations: 'Invite users via email and send a registration link.',
    reports: 'Review flagged reports and moderation tasks.',
    feedback: 'Review star ratings and feedback submitted by users.',
    'user-details': 'Review account information and complete management actions.',
    'page-details': 'Manage this page account, its blue mark and dashboard access.',
  }

  const goToSection = (key) => {
    setActiveSection(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const dashboardMetrics = [
    { label: 'Users', value: users.length, color: 'blue' },
    { label: 'Pages', value: pages.length, color: 'gold' },
    { label: 'Posts', value: postsList.length, color: 'green' },
    { label: 'Reports', value: reportRows.length, color: 'red' },
    { label: 'Feedback', value: feedbackRows.length, color: 'purple' },
  ]
  const dashboardChartMax = Math.max(...dashboardMetrics.map((metric) => metric.value), 1)
  const dashboardChartPoints = dashboardMetrics
    .map((metric, index) => `${34 + index * 84},${128 - (metric.value / dashboardChartMax) * 92}`)
    .join(' ')

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

              <div className="admin-users-tabs">
                <button
                  type="button"
                  className={`admin-users-tab ${usersTab === 'regular' ? 'active' : ''}`}
                  onClick={() => setUsersTab('regular')}
                >
                  👤 Regular Users ({regularUsers.length})
                </button>
                <button
                  type="button"
                  className={`admin-users-tab ${usersTab === 'admin' ? 'active' : ''}`}
                  onClick={() => setUsersTab('admin')}
                >
                  🛡 Admin Accounts ({adminUsers.length})
                </button>
                <button type="button" className="admin-users-refresh" onClick={() => loadUsers()}>↻ Refresh</button>
              </div>

              {usersTab === 'regular' && (
                <>
                  {loadingUsers && <LoadingState label="Loading users" compact />}
                  {error && <p className="error-text">{error}</p>}

                  {!loadingUsers && regularUsers.length === 0 && !error && (
                    <p>No regular user accounts found yet.</p>
                  )}

                  {regularUsers.length > 0 && (
                    <div className="admin-users-table-wrap">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>Full Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Blue Mark</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regularUsers.map((userItem) => (
                            <tr key={userItem.id}>
                              <td>
                                <span className="admin-name-cell">
                                  {userItem.fullName || userItem.username}
                                  {userItem.verified && <VerifiedBadge size="small" />}
                                </span>
                              </td>
                              <td>{userItem.email}</td>
                              <td>{userItem.role}</td>
                              <td>
                                <div className="admin-verify-cell">
                                  {userItem.verified
                                    ? <span className="admin-verified-badge" title="Blue mark enabled">✔ Verified</span>
                                    : <span className="admin-unverified-badge" title="Blue mark disabled">Not Verified</span>}
                                  <button
                                    type="button"
                                    className={`admin-verify-toggle-btn ${userItem.verified ? 'enabled' : ''}`}
                                    disabled={verifyingUserId === userItem.id}
                                    title={userItem.verified ? 'Remove Verification' : 'Mark as Verified'}
                                    onClick={() => handleListToggleVerified(userItem)}
                                  >
                                    {verifyingUserId === userItem.id
                                      ? <span className="button-spinner" aria-hidden="true" />
                                      : null}
                                    {verifyingUserId === userItem.id
                                      ? 'Updating…'
                                      : userItem.verified
                                        ? 'Remove Verification'
                                        : 'Mark as Verified'}
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span className={`admin-status-badge ${userItem.suspended ? 'suspended' : 'active'}`}>
                                  {userItem.suspended ? 'Suspended' : 'Active'}
                                </span>
                              </td>
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
                </>
              )}

                            {usersTab === 'admin' && (
                <>
                  {adminUsers.length === 0 && (<p>No admin accounts found.</p>)}
                  {adminUsers.length > 0 && (
                    <div className="admin-users-table-wrap">
                      <table className="admin-users-table">
                        <thead><tr><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created At</th><th>Action</th></tr></thead>
                        <tbody>
                          {adminUsers.map((userItem) => (
                            <tr key={userItem.id}>
                              <td>{userItem.fullName || userItem.username}</td>
                              <td>{userItem.email}</td>
                              <td>{userItem.role}</td>
                              <td><span className={`admin-status-badge ${userItem.suspended ? 'suspended' : 'active'}`}>{userItem.suspended ? 'Suspended' : 'Active'}</span></td>
                              <td>{new Date(userItem.createdAt).toLocaleString()}</td>
                              <td className="admin-action-cell"><button type="button" className="admin-more-actions-btn" onClick={() => openUserDetails(userItem)}>More actions →</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="admin-page-note">🌐 Page accounts are managed in the Page Accounts section.</p>
                </>
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
                <h2>{displayName} {selectedUser.verified && <VerifiedBadge size="small" />}</h2>
                <p>{selectedUser.email}</p>
                <div className="admin-user-badges"><span className="admin-role-badge">{selectedUser.role || 'user'}</span><span className={`admin-status-badge ${selectedUser.suspended ? 'suspended' : 'active'}`}>{selectedUser.suspended ? 'Suspended' : 'Active'}</span>{selectedUser.verified && <span className="admin-verified-badge">✔ Blue Mark</span>}</div>
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
                {selectedUser.role !== 'admin' && (
                  <button type="button" className={`admin-verified-btn ${selectedUser.verified ? 'enabled' : ''}`} disabled={updatingVerified} onClick={handleToggleVerified}>{updatingVerified && <span className="button-spinner" aria-hidden="true" />}{updatingVerified ? 'Updating…' : selectedUser.verified ? 'Disable Blue Mark' : 'Enable Blue Mark'}</button>
                )}
                {selectedUser.role === 'admin' && <small>Admin accounts cannot receive a blue mark.</small>}
                <button type="button" className="admin-suspend-btn" disabled={isCurrentAdmin || updatingUserStatus} onClick={requestUserSuspension}>{updatingUserStatus && <span className="button-spinner" aria-hidden="true" />}{updatingUserStatus ? 'Updating…' : selectedUser.suspended ? 'Restore account' : 'Suspend account'}</button>
                <button type="button" className="admin-delete-btn" disabled={isCurrentAdmin} onClick={requestUserDeletion}>Delete account</button>
                {isCurrentAdmin && <small>You cannot suspend or delete your own admin account.</small>}
              </section>
            </div>
          </section>
        )
      }
      case 'page-details': {
        if (!selectedPage) {
          return (
            <section className="admin-user-details-empty">
              <h2>No page account selected</h2>
              <p>Choose a page account from the Page Accounts section to view its details.</p>
              <button type="button" className="admin-more-actions-btn" onClick={() => goToSection('page-accounts')}>Go to Page Accounts</button>
            </section>
          )
        }

        const pageDisplayName = selectedPage.pageName || 'MiitVerse page'
        const pageInitials = pageDisplayName.split(' ').filter(Boolean).map((part) => part[0]?.toUpperCase()).join('').slice(0, 2) || 'P'

        return (
          <section className="admin-user-details">
            <button type="button" className="admin-back-button" onClick={() => goToSection('page-accounts')}>← Back to Page Accounts</button>
            <div className="admin-user-profile-card">
              <div className="admin-user-avatar">{pageInitials}</div>
              <div className="admin-user-profile-copy">
                <p className="admin-eyebrow">PAGE ACCOUNT PROFILE</p>
                <h2>{pageDisplayName} {selectedPage.verified && <VerifiedBadge size="small" />} {selectedPage.verified === false ? <span className="admin-unverified-badge">Not Verified</span> : <span className="admin-verified-badge">✔ Blue Mark</span>}</h2>
                <p>{selectedPage.email}</p>
                <div className="admin-user-badges"><span className="admin-role-badge">{selectedPage.role || 'page'}</span></div>
              </div>
            </div>

            {pageAccountMessage.text && <p className={`message message-${pageAccountMessage.type}`}>{pageAccountMessage.text}</p>}

            <div className="admin-user-details-grid">
              <section className="admin-user-info-card">
                <p className="admin-eyebrow">ACCOUNT INFORMATION</p>
                <h3>Details</h3>
                <dl>
                  <div><dt>Page name</dt><dd>{pageDisplayName}</dd></div>
                  <div><dt>Email address</dt><dd>{selectedPage.email}</dd></div>
                  <div><dt>Page slug</dt><dd>{selectedPage.slug || '—'}</dd></div>
                  <div><dt>Owner account</dt><dd>{selectedPage.ownerId || 'Not linked'}</dd></div>
                  <div><dt>Created</dt><dd>{selectedPage.createdAt ? new Date(selectedPage.createdAt).toLocaleString() : 'Not available'}</dd></div>
                  <div><dt>Account ID</dt><dd className="admin-user-id">{selectedPage.id}</dd></div>
                </dl>
              </section>

              <section className="admin-user-actions-card">
                <p className="admin-eyebrow">ADMIN ACTIONS</p>
                <h3>Manage this page account</h3>
                <p>Actions take effect immediately. The blue mark controls the verified badge shown next to this page's name and posts.</p>
                <button
                  type="button"
                  className={`admin-verified-btn ${selectedPage.verified !== false ? 'enabled' : ''}`}
                  disabled={updatingPageVerified === selectedPage.id}
                  onClick={() => handleTogglePageVerified(selectedPage)}
                >
                  {updatingPageVerified === selectedPage.id && <span className="button-spinner" aria-hidden="true" />}
                  {updatingPageVerified === selectedPage.id ? 'Updating…' : selectedPage.verified === false ? 'Enable Blue Mark' : 'Disable Blue Mark'}
                </button>
                <button type="button" className="admin-reset-btn" onClick={() => setResetPasswordUserId(selectedPage.ownerId || selectedPage.id)}>Reset password</button>
                <a className="admin-button" href={`/page/${selectedPage.slug}`}>Open Dashboard</a>
                <button type="button" className="admin-delete-btn" onClick={requestPageDeletion}>Delete page account</button>
                <small>Posts published from this page's dashboard appear under "{pageDisplayName}", never under the admin account.</small>
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
                {creatingPageAccount && <span className="button-spinner" aria-hidden="true" />}
                {creatingPageAccount ? 'Creating account...' : 'Create Page Account'}
              </button>
            </div>

            <div className="admin-users-table-wrap" style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '12px' }}>Created Pages</h3>
              {loadingPages && <LoadingState label="Loading pages" compact />}
              {!loadingPages && pages.length === 0 && <p>No pages created yet.</p>}
              {!loadingPages && pages.length > 0 && (
                <div className="admin-page-list">
                  {pages.map((pageItem) => (
                    <div className="admin-page-card" key={pageItem.id}>
                      <div>
                        <h4><span className="admin-name-cell">{pageItem.pageName} {pageItem.verified && <VerifiedBadge size="small" />}</span> {pageItem.verified === false ? <span className="admin-unverified-badge" title="Blue mark disabled">Not Verified</span> : <span className="admin-verified-badge" title="Blue mark enabled">✔ Blue Mark</span>}</h4>
                        <p>{pageItem.email}</p>
                      </div>
                      <div className="admin-page-card-actions">
                        <span className="admin-page-badge">{pageItem.role || 'page'}</span>
                        <button
                          type="button"
                          className={`admin-verify-toggle-btn ${pageItem.verified === false ? '' : 'enabled'}`}
                          disabled={updatingPageVerified === pageItem.id}
                          title={pageItem.verified === false ? 'Mark as Verified' : 'Remove Verification'}
                          onClick={() => handleTogglePageVerified(pageItem)}
                        >
                          {updatingPageVerified === pageItem.id && <span className="button-spinner" aria-hidden="true" />}
                          {updatingPageVerified === pageItem.id
                            ? 'Updating…'
                            : pageItem.verified === false
                              ? 'Mark as Verified'
                              : 'Remove Verification'}
                        </button>
                        <button
                          type="button"
                          className="admin-more-actions-btn"
                          onClick={() => openPageDetails(pageItem)}
                        >
                          More actions →
                        </button>
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

            <div className="admin-invite-link" style={{ marginBottom: '20px' }}>
              <strong>Note:</strong>
              <span>Admin accounts cannot publish posts. To publish, open a page account's dashboard from the Page Accounts section — posts are published under the page's full name.</span>
            </div>

            {loadingPosts && <LoadingState label="Loading posts" compact />}

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
                        <strong>{post.source === 'page' ? (post.pageName || post.author) : post.author} <small>({post.authorType === 'page' ? 'Page' : 'User'})</small></strong>
                        <small>{post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}</small>
                      </div>
                      <small>Post ID: {post.id} · Author ID: {post.userId}</small>
                      <p style={{ marginTop: '6px' }}>{post.content}</p>
                      {post.image ? <img src={resolveApiUrl(post.image.replace(/^\/api(?=\/)/, ''))} alt="post" style={{ maxWidth: '240px', marginTop: '6px', objectFit: 'cover' }} onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
                      <small>Reactions: {Math.max(Number(post.likes || 0), Array.isArray(post.likedBy) ? post.likedBy.length : 0)} · Comments: {Array.isArray(post.comments) ? post.comments.length : Number(post.comments || 0)} · Shares: {Number(post.shares ?? post.reposts ?? 0)} · Visibility: {post.visibility || 'public'}</small>
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

            <div className="admin-invite-link">
              <strong>Invitation links:</strong>
              <a href="https://gdt-vercel.vercel.app" target="_blank" rel="noreferrer">https://gdt-vercel.vercel.app</a>
              <button
                type="button"
                className="admin-users-refresh"
                onClick={() => handleCopyInviteLink('https://gdt-vercel.vercel.app')}
              >
                Copy link
              </button>
              <span aria-hidden="true">·</span>
              <a href="https://miitversebymiit.vercel.app" target="_blank" rel="noreferrer">https://miitversebymiit.vercel.app</a>
              <button
                type="button"
                className="admin-users-refresh"
                onClick={() => handleCopyInviteLink('https://miitversebymiit.vercel.app')}
              >
                Copy link
              </button>
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
                {inviting && <span className="button-spinner" aria-hidden="true" />}
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

            <div className="admin-invite-history" style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>📨 Invitation Delivery History</h3>
                <button type="button" className="admin-users-refresh" onClick={() => loadInviteHistory()}>↻ Refresh</button>
              </div>

              {loadingInviteHistory && <LoadingState label="Loading invitation history" compact />}
              {inviteHistoryError && <p className="error-text">{inviteHistoryError}</p>}

              {!loadingInviteHistory && !inviteHistoryError && inviteHistory.length === 0 && (
                <p>No invitations have been sent yet.</p>
              )}

              {!loadingInviteHistory && inviteHistory.length > 0 && (
                <div className="admin-users-table-wrap">
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Invited To</th>
                        <th>Subject</th>
                        <th>Delivery Status</th>
                        <th>Last Event At</th>
                        <th>Opens</th>
                        <th>Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.to}</td>
                          <td>{item.subject}</td>
                          <td>
                            <span className={`admin-status-badge ${item.status === 'delivered' ? 'active' : item.status === 'delivered_as_expected' ? 'active' : 'suspended'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.lastEventTime ? new Date(item.lastEventTime).toLocaleString() : '—'}</td>
                          <td>{item.opensCount}</td>
                          <td>{item.clicksCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <small style={{ display: 'block', marginTop: '10px', color: '#6b7280' }}>
                Delivery data comes from the email provider (SendGrid). "Delivered" means the email reached the recipient's mail server — if it can't be found in the inbox, ask the recipient to check their Junk/Spam folder.
              </small>
            </div>
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
              {loadingReports && <LoadingState label="Loading reports" compact />}
              {!loadingReports && reportRows.length === 0 && <p>No user reports have been submitted.</p>}
              {!loadingReports && reportRows.length > 0 && (
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
                              <button type="button" onClick={() => handleReportStatusChange(report.id, 'Resolved')}>
                                Resolve
                              </button>
                              <button type="button" className="admin-delete-btn" onClick={() => handleDeleteReport(report.id)}>
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
              )}
            </div>
          </section>
        )
      case 'feedback':
        return (
          <section className="admin-page-accounts">
            <div className="admin-create-header">
              <h2>{pageTitles[activeSection]}</h2>
              <p>{pageDescriptions[activeSection]}</p>
            </div>

            <div className="admin-users-table-wrap admin-report-table-wrap">
              {feedbackError && <p className="error-text">{feedbackError}</p>}
              {loadingFeedback && <LoadingState label="Loading feedback" compact />}
              {!loadingFeedback && feedbackRows.length === 0 && !feedbackError && <p>No user feedback has been submitted yet.</p>}
              {!loadingFeedback && feedbackRows.length > 0 && (
              <table className="admin-users-table admin-reports-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Rating</th>
                    <th>Feedback</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackRows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>
                        <span className="admin-feedback-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FaStar
                              key={star}
                              className={star <= item.rating ? 'filled' : ''}
                            />
                          ))}
                          <span className="admin-feedback-rating-num">{item.rating}/5</span>
                        </span>
                      </td>
                      <td className="admin-feedback-message">{item.message}</td>
                      <td>{new Date(item.createdAt || Date.now()).toLocaleString()}</td>
                      <td className="admin-report-action-cell">
                        <button
                          type="button"
                          className="admin-delete-btn"
                          onClick={() => handleDeleteFeedback(item.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </section>
        )
      default:
        return (
          <>
            <section id="dashboard" className="stats-grid">
              <div className="stat-card">
                <h3>👥 Users</h3>
                <h2>{users.length}</h2>
                <p>Regular registered users</p>
              </div>

              <div className="stat-card">
                <h3>🌐 Page Accounts</h3>
                <h2>{pages.length}</h2>
                <p>Official MIIT pages</p>
              </div>

              <div className="stat-card">
                <h3>📝 Posts</h3>
                <h2>{postsList.length}</h2>
                <p>User &amp; page posts</p>
              </div>

              <div className="stat-card">
                <h3>🚩 Reports</h3>
                <h2>{reportRows.length}</h2>
                <p>{reportRows.filter((r) => r.status !== 'Resolved').length} need review</p>
              </div>

              <div className="stat-card">
                <h3>⭐ Feedback</h3>
                <h2>{feedbackRows.length}</h2>
                <p>Star ratings &amp; reviews</p>
              </div>
            </section>

            <section className="dashboard-quick-actions">
              <button type="button" onClick={() => goToSection('users')}>👥 Manage Users</button>
              <button type="button" onClick={() => goToSection('page-accounts')}>🌐 Page Accounts</button>
              <button type="button" onClick={() => goToSection('posts')}>📝 Posts</button>
              <button type="button" onClick={() => goToSection('invitations')}>✉ Send Invitations</button>
              <button type="button" onClick={() => goToSection('reports')}>🚩 Reports</button>
              <button type="button" onClick={() => goToSection('feedback')}>⭐ View Feedback</button>
            </section>

            <section className="admin-insights" aria-label="Dashboard summary">
              <div className="admin-insights-heading">
                <div>
                  <p className="admin-eyebrow">AT A GLANCE</p>
                  <h2>Community overview</h2>
                  <p>Key activity counts across the platform, updated with this dashboard.</p>
                </div>
                <div className="admin-insights-total">
                  <strong>{users.length + pages.length + postsList.length}</strong>
                  <span>managed items</span>
                </div>
              </div>

              <div className="admin-summary-strip">
                <div><span>Needs attention</span><strong>{reportRows.filter((report) => report.status !== 'Resolved').length} reports</strong></div>
                <div><span>Published content</span><strong>{postsList.length} posts</strong></div>
                <div><span>Verified pages</span><strong>{pages.filter((page) => page.verified).length} pages</strong></div>
                <div><span>Feedback</span><strong>{feedbackRows.length} reviews</strong></div>
              </div>

              <div className="admin-chart-grid">
                <div className="admin-chart-card">
                  <div className="admin-chart-heading"><div><h3>Content mix</h3><p>Current records by category</p></div><span>COUNT</span></div>
                  <div className="admin-histogram" role="img" aria-label="Histogram comparing users, pages, posts, and reports">
                    {dashboardMetrics.map((metric) => (
                      <div className="admin-bar-column" key={metric.label}>
                        <strong>{metric.value}</strong>
                        <div className="admin-bar-track"><span className={`admin-bar ${metric.color}`} style={{ height: `${Math.max(8, (metric.value / dashboardChartMax) * 100)}%` }} /></div>
                        <small>{metric.label}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-chart-card">
                  <div className="admin-chart-heading"><div><h3>Activity signal</h3><p>Relative volume across tracked areas</p></div><span>LIVE DATA</span></div>
                  <div className="admin-line-chart" role="img" aria-label="Line graph showing relative dashboard activity">
                    <div className="admin-chart-grid-lines"><span /><span /><span /><span /></div>
                    <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
                      <polyline points={dashboardChartPoints} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      {dashboardMetrics.map((metric, index) => <circle key={metric.label} cx={34 + index * 84} cy={128 - (metric.value / dashboardChartMax) * 92} r="5" />)}
                    </svg>
                    <div className="admin-line-labels">{dashboardMetrics.map((metric) => <small key={metric.label}>{metric.label}</small>)}</div>
                  </div>
                </div>
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
            <li className="admin-sidebar-logout">
              <button type="button" className="admin-nav-item" onClick={logout}>↪ Log out</button>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="admin-main">
        <nav className="admin-mobile-nav" aria-label="Admin sections">
          <span className="admin-mobile-nav-label">Admin menu</span>
          <div className="admin-mobile-nav-list">
            {sidebarItems.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`admin-mobile-nav-item ${activeSection === item.key ? 'active' : ''}`}
                onClick={() => goToSection(item.key)}
              >
                {item.label}
              </button>
            ))}
            <button type="button" className="admin-mobile-nav-item admin-mobile-logout" onClick={logout}>↪ Log out</button>
          </div>
        </nav>

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
                    {resettingPassword && <span className="button-spinner" aria-hidden="true" />}
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
              <p>{userConfirmation.type === 'delete' ? `This permanently removes ${userConfirmation.user.fullName || userConfirmation.user.username || userConfirmation.user.pageName || 'this account'}'s account and cannot be undone.` : userConfirmation.type === 'suspend' ? `${userConfirmation.user.fullName || userConfirmation.user.username} will no longer be able to sign in until the account is restored.` : `${userConfirmation.user.fullName || userConfirmation.user.username} will be able to sign in again.`}</p>
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
