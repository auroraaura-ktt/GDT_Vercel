import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaArrowLeft, FaBullhorn, FaChartLine, FaImage, FaPaperclip, FaPen } from 'react-icons/fa'

import { useAuth } from '../context/useAuth'
import { apiRequest, resolveApiUrl } from '../lib/api'
import LoadingState from '../components/LoadingState'
import PostList from '../components/PostList'
import './PageDashboard.css'

export default function PageDashboard() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const { token, user } = useAuth()
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState([])
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  // Page file attachment support: rides the same existing 'images' upload path
  // as the user account system, so photos + files submit together as ONE page
  // post through the existing POST /social/posts API.
  const [selectedFiles, setSelectedFiles] = useState([])
  const MAX_MEDIA = 10 // matches the existing backend maxCount for the 'images' field
  const MAX_FILE_SIZE = 15 * 1024 * 1024 // matches the existing backend upload limit
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    let active = true

    async function loadPage() {
      setLoading(true)
      setError('')

      try {
        const data = await apiRequest(`/auth/pages/${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (active) setPage(data.page)
      } catch (err) {
        if (active) setError(err.message || 'Failed to load page')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPage()
    return () => { active = false }
  }, [slug, token])

  useEffect(() => {
    let active = true

    async function loadPosts() {
      if (!page?.id) {
        setPosts([])
        return
      }

      try {
        const data = await apiRequest(`/social/posts?userId=${encodeURIComponent(page.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (active) setPosts((data.posts || []).map((post) => ({
          ...post,
          pageName: post.pageName || page.pageName,
          username: post.username || page.pageName,
          profilePicture: post.profilePicture || page.coverImage || null,
        })))
      } catch {
        if (active) setPosts([])
      }
    }

    loadPosts()
    return () => { active = false }
  }, [page?.coverImage, page?.id, page?.pageName, token])

  const pageTitle = useMemo(() => page?.pageName || 'Page Dashboard', [page])
  const pageInitial = pageTitle.trim().charAt(0).toUpperCase() || 'P'

  const handlePostSubmit = async (event) => {
    event.preventDefault()
    const trimmed = draft.trim()

    if (!trimmed && !imagePreview && selectedFiles.length === 0) {
      setMessage('Write something or attach an image before publishing to the page.')
      return
    }

    setPosting(true)
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('content', trimmed)
      if (imageFile) {
        formData.append('image', imageFile)
      }
      for (const file of selectedFiles) {
        formData.append('images', file)
      }
      // Admins publish on behalf of this page so the post is attributed to the
      // page account (its full page name), never to the admin.
      if (user?.role === 'admin') {
        formData.append('onBehalfOfPageId', page.id)
      }

      const data = await apiRequest('/social/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      setPosts((currentPosts) => [{
        ...data.post,
        pageName: page.pageName,
        username: page.pageName,
        profilePicture: page.coverImage || null,
      }, ...currentPosts])
      setDraft('')
      setImageFile(null)
      setImagePreview(null)
      setImageError('')
      setSelectedFiles([])
      setMessage('Your page update is live.')
    } catch (err) {
      setMessage(err.message || 'Failed to publish post')
    } finally {
      setPosting(false)
    }
  }

  const handlePostUpdated = (updatedPost) => {
    setPosts((currentPosts) => currentPosts.map((post) => (
      String(post.id) === String(updatedPost?.id) ? { ...post, ...updatedPost } : post
    )))
  }

  const handlePostDeleted = (postId) => {
    setPosts((currentPosts) => currentPosts.filter((post) => String(post.id) !== String(postId)))
  }

  const handleImageChange = (event) => {
    setImageError('')
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('Only image files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be 5MB or smaller.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
    setImageFile(file)
  }

  const handleFilesChange = (event) => {
    setImageError('')
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const totalSelected = selectedFiles.length + (imageFile ? 1 : 0)
    const room = MAX_MEDIA - totalSelected
    if (room <= 0) {
      setImageError(`A post can contain at most ${MAX_MEDIA} photos/files in total.`)
      return
    }

    const accepted = []
    let oversized = 0
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        oversized += 1
        continue
      }
      accepted.push(file)
      if (accepted.length >= room) break
    }

    if (accepted.length > 0) {
      setSelectedFiles((current) => [...current, ...accepted])
    }

    if (oversized > 0) {
      setImageError(`${oversized} file(s) skipped because they exceed the 15MB size limit.`)
    } else if (accepted.length < files.length) {
      setImageError(`A post can contain at most ${MAX_MEDIA} photos/files in total.`)
    } else {
      setImageError('')
    }
  }

  const handleRemoveFile = (index) => {
    setSelectedFiles((current) => current.filter((_, position) => position !== index))
  }

  const renderActiveTab = () => {
    if (activeTab === 'create-post') {
      return (
        <section className="page-composer-card" id="create-post">
          <div className="page-card-heading"><div><p className="page-kicker">CREATE</p><h2>Publish an update</h2></div><span className="page-avatar small">{pageInitial}</span></div>
          <form onSubmit={handlePostSubmit}>
            <label htmlFor="pagePost">What would you like to share?</label>
            <textarea id="pagePost" rows="6" value={draft} onChange={(event) => { setDraft(event.target.value); if (message) setMessage('') }} placeholder={`Write an update from ${pageTitle}…`} />
            <div className="page-composer-actions">
              <label className="page-image-picker" htmlFor="pageImage"><FaImage /> Add image</label>
              <input id="pageImage" type="file" accept="image/*" onChange={handleImageChange} />
              <label className="page-image-picker" htmlFor="pageFiles"><FaPaperclip /> Add files</label>
              <input id="pageFiles" type="file" multiple onChange={handleFilesChange} />
              <span>{draft.trim().length} characters</span>
              <button type="submit" disabled={posting}>{posting ? <><span className="button-spinner" aria-hidden="true" /> Publishing…</> : <><FaBullhorn /> Publish update</>}</button>
            </div>
            {imageError && <p className="page-message error">{imageError}</p>}
            {message && <p className={`page-message ${message === 'Your page update is live.' ? 'success' : 'error'}`}>{message}</p>}
            {selectedFiles.length > 0 && (
              <div className="page-image-preview">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '6px 10px',
                      border: '1px solid #eee',
                      borderRadius: '10px',
                      marginBottom: '6px',
                      fontSize: '14px',
                      color: '#0B1E4F',
                      width: '100%',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.type?.startsWith('image/') ? '🖼' : '📄'} {file.name}
                    </span>
                    <button type="button" onClick={() => handleRemoveFile(index)} aria-label={`Remove ${file.name}`}>❌</button>
                  </div>
                ))}
              </div>
            )}
            {imagePreview && <div className="page-image-preview"><img src={imagePreview} alt="Selected for your post" /><button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}>Remove image</button></div>}
          </form>
        </section>
      )
    }

    if (activeTab === 'published-posts') {
      return (
        <section className="page-posts-card" id="recent-posts">
          <div className="page-card-heading"><div><p className="page-kicker">ACTIVITY</p><h2>Recent page posts</h2></div><span className="page-post-count">{posts.length} total</span></div>
          {posts.length === 0 ? <div className="page-empty-state"><FaBullhorn /><h3>Your page has no posts yet</h3><p>Create the first update to start your page activity.</p><button type="button" className="page-empty-action" onClick={() => setActiveTab('create-post')}>Create an update</button></div> : <PostList posts={posts} onPostUpdated={handlePostUpdated} onPostDeleted={handlePostDeleted} />}
        </section>
      )
    }

    return (
      <>
        <section className="page-hero-card">
          <div className="page-hero-icon"><FaBullhorn /></div>
          <div>
            <p className="page-kicker">YOUR PAGE IS READY</p>
            <h2>Share something worth seeing.</h2>
            <p>Publish announcements, news, and moments for your audience from one focused workspace.</p>
          </div>
          <button type="button" className="page-primary-action" onClick={() => setActiveTab('create-post')}><FaPen /> Create update</button>
        </section>

        <section className="page-overview-summary" aria-label="Page statistics">
          <article className="page-stat-card"><span className="page-stat-icon blue"><FaBullhorn /></span><div><p>Published posts</p><strong>{posts.length}</strong><small>Updates shared</small></div></article>
        </section>
      </>
    )
  }

  if (loading) {
    return <main className="page-dashboard-state"><LoadingState label="Loading your page dashboard" /></main>
  }

  if (error || !page) {
    return (
      <main className="page-dashboard-state">
        <p>{error || 'Page not found.'}</p>
        <Link to="/feed">Return to feed</Link>
      </main>
    )
  }

  return (
    <main className="page-dashboard">
      <aside className="page-dashboard-sidebar">
        <Link className="page-dashboard-brand" to="/feed">
          <img src="/miitLogo.png" alt="MIIT" />
          <span><strong>Miit<span>Verse</span></strong><small>PAGE STUDIO</small></span>
        </Link>

        <div className="page-account-summary">
          <span className="page-avatar">{pageInitial}</span>
          <div><strong>{pageTitle}</strong><small>Page account</small></div>
        </div>

        <nav className="page-dashboard-nav" aria-label="Page dashboard">
          <button type="button" className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><FaChartLine /> Overview</button>
          <button type="button" className={activeTab === 'create-post' ? 'active' : ''} onClick={() => setActiveTab('create-post')}><FaPen /> Create post</button>
          <button type="button" className={activeTab === 'published-posts' ? 'active' : ''} onClick={() => setActiveTab('published-posts')}><FaBullhorn /> Published posts</button>
        </nav>

        <button
          type="button"
          className="page-back-link"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1)
              return
            }

            navigate('/feed')
          }}
        >
          <FaArrowLeft /> Back
        </button>
      </aside>

      <section className="page-dashboard-main">
        <header className="page-dashboard-header" id="overview">
          <div>
            <p className="page-kicker">PAGE DASHBOARD</p>
            <h1>Welcome back, {pageTitle}</h1>
            <p>{page.description || 'Manage your page updates and keep your community informed.'}</p>
          </div>
          <div className="page-user-chip"><span>{user?.username?.charAt(0)?.toUpperCase() || pageInitial}</span>{user?.username || pageTitle}</div>
        </header>

        {renderActiveTab()}
      </section>
    </main>
  )
}
