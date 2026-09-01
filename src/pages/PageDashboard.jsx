import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FaArrowLeft, FaBullhorn, FaChartLine, FaImage, FaPen } from 'react-icons/fa'

import { useAuth } from '../context/useAuth'
import { apiRequest } from '../lib/api'
import { buildPagePost, normalizePagePosts } from '../lib/pagePosts'
import './PageDashboard.css'

export default function PageDashboard() {
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
        if (active) setPosts(normalizePagePosts(data.posts || []))
      } catch {
        if (active) setPosts([])
      }
    }

    loadPosts()
    return () => { active = false }
  }, [page?.id, token])

  const pageTitle = useMemo(() => page?.pageName || 'Page Dashboard', [page])
  const pageInitial = pageTitle.trim().charAt(0).toUpperCase() || 'P'

  const handlePostSubmit = async (event) => {
    event.preventDefault()
    const trimmed = draft.trim()

    if (!trimmed && !imagePreview) {
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

      setPosts((currentPosts) => normalizePagePosts([buildPagePost(data.post), ...currentPosts]))
      setDraft('')
      setImageFile(null)
      setImagePreview(null)
      setImageError('')
      setMessage('Your page update is live.')
    } catch (err) {
      setMessage(err.message || 'Failed to publish post')
    } finally {
      setPosting(false)
    }
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
              <span>{draft.trim().length} characters</span>
              <button type="submit" disabled={posting}>{posting ? 'Publishing…' : <><FaBullhorn /> Publish update</>}</button>
            </div>
            {imageError && <p className="page-message error">{imageError}</p>}
            {message && <p className={`page-message ${message === 'Your page update is live.' ? 'success' : 'error'}`}>{message}</p>}
            {imagePreview && <div className="page-image-preview"><img src={imagePreview} alt="Selected for your post" /><button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}>Remove image</button></div>}
          </form>
        </section>
      )
    }

    if (activeTab === 'published-posts') {
      return (
        <section className="page-posts-card" id="recent-posts">
          <div className="page-card-heading"><div><p className="page-kicker">ACTIVITY</p><h2>Recent page posts</h2></div><span className="page-post-count">{posts.length} total</span></div>
          {posts.length === 0 ? <div className="page-empty-state"><FaBullhorn /><h3>Your page has no posts yet</h3><p>Create the first update to start your page activity.</p><button type="button" className="page-empty-action" onClick={() => setActiveTab('create-post')}>Create an update</button></div> : <div className="page-post-list">{posts.map((post) => <article className="page-post" key={post.id}><span className="page-avatar small">{pageInitial}</span><div><strong>{pageTitle}</strong><time>{new Date(post.createdAt).toLocaleString()}</time><p>{post.content}</p>{post.image && <img src={post.image} alt="Post attachment" />}</div></article>)}</div>}
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
    return <main className="page-dashboard-state">Loading your page dashboard…</main>
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

        <Link className="page-back-link" to="/feed"><FaArrowLeft /> Back to feed</Link>
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
