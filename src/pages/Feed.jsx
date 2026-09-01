import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from '../context/useAuth'
import BottomNav from "../components/BottomNav"
import LeftSidebar from "../components/LeftSidebar"
import RightSidebar from "../components/RightSidebar"
import TopBar from "../components/TopBar"
import CreatePost from "../components/CreatePost"
import PostList from "../components/PostList"
import { getVisiblePosts, shouldPersistSocialPost, toggleFollowRelationship } from "../lib/socialFeed"
import { apiRequest } from "../lib/api"

async function uploadPostImage(file) {
  if (!file) return null

  const formData = new FormData()
  formData.append('image', file)

  const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('miitverse-auth') : null
  const parsedAuth = authToken ? JSON.parse(authToken) : null
  const token = parsedAuth?.token

  const response = await fetch('/api/social/uploads', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.message || 'Image upload failed')
  }

  const data = await response.json()
  return data.imageUrl || null
}

export default function Feed() {
  const { user, ready } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshSeed, setRefreshSeed] = useState(0)
  const lastFetchedPostsRef = useRef([])

  const FEED_POST_LIMIT = 8

  const loadFeedData = useCallback(async ({ scrollToTop = false } = {}) => {
    setIsLoading(true)

    if (scrollToTop) {
      setRefreshSeed((seed) => seed + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const feedCenter = document.querySelector('.feed-center')
      if (feedCenter) feedCenter.scrollTo({ top: 0, behavior: 'smooth' })
    }

    try {
      const savedFollowing = localStorage.getItem("feed-following")
      if (savedFollowing) {
        setFollowing(JSON.parse(savedFollowing))
      }

      if (!ready) {
        return
      }

      if (!user?.id) {
        setPosts([
          {
            id: "welcome-post",
            userId: "system",
            username: "MiitVerse",
            profilePicture: null,
            content: "Welcome to the new feed. Start a conversation with your community.",
            image: null,
            createdAt: new Date().toISOString(),
            likes: 0,
            comments: [],
            reposts: 0,
            visibility: "public",
          },
        ])
        return
      }

      const [{ posts: serverPosts }, { following: serverFollowing }] = await Promise.all([
        apiRequest('/social/posts'),
        apiRequest('/social/follows'),
      ])

      setPosts(serverPosts || [])
      setFollowing(serverFollowing || [])
      localStorage.setItem("feed-following", JSON.stringify(serverFollowing || []))
      lastFetchedPostsRef.current = serverPosts || []
    } catch (error) {
      console.error("Failed to load feed posts:", error)
    } finally {
      setIsLoading(false)
    }
  }, [ready, user?.id])

  useEffect(() => {
    loadFeedData()

    const refreshTimer = window.setInterval(() => {
      loadFeedData()
    }, 15000)

    return () => window.clearInterval(refreshTimer)
  }, [loadFeedData])

  const handlePostUpdated = useCallback((updatedPost) => {
    if (!updatedPost?.id) return

    setPosts((currentPosts) => currentPosts.map((post) => (
      String(post.id) === String(updatedPost.id)
        ? { ...post, ...updatedPost }
        : post
    )))
  }, [])

  const handleAddPost = async (newPost) => {
    const storedAuth = typeof window !== 'undefined' ? window.localStorage.getItem('miitverse-auth') : null
    const parsedStoredAuth = storedAuth ? JSON.parse(storedAuth) : null
    const resolvedUsername = user?.username || parsedStoredAuth?.user?.username || parsedStoredAuth?.username || null

    const shouldUseServerPersistence = shouldPersistSocialPost({
      user,
      ready,
      authToken: storedAuth,
    })

    if (!shouldUseServerPersistence) {
      setPosts((currentPosts) => {
        const nextPosts = [newPost, ...currentPosts]
        localStorage.setItem("feed-posts", JSON.stringify(nextPosts))
        return nextPosts
      })
      return
    }

    try {
      let postResponse

      if (newPost.imageFile) {
        const formData = new FormData()
        formData.append('content', newPost.content || '')
        formData.append('username', resolvedUsername || newPost.username || 'MiitVerse member')
        formData.append('visibility', newPost.visibility || 'public')
        formData.append('image', newPost.imageFile)

        const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('miitverse-auth') : null
        const parsedAuth = authToken ? JSON.parse(authToken) : null
        const token = parsedAuth?.token

        const response = await fetch('/api/social/posts', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.message || 'Failed to save post')
        }

        postResponse = await response.json()
      } else {
        const payload = {
          ...newPost,
          username: resolvedUsername || newPost.username,
          image: newPost.image || null,
          imageFile: undefined,
        }

        postResponse = await apiRequest('/social/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      const post = postResponse?.post || postResponse
      setPosts((currentPosts) => [post, ...currentPosts])
    } catch (error) {
      console.error('Failed to save post:', error)
      setPosts((currentPosts) => {
        const nextPosts = [newPost, ...currentPosts]
        localStorage.setItem("feed-posts", JSON.stringify(nextPosts))
        return nextPosts
      })
    }
  }

  const handleFollowToggle = async (targetUser) => {
    if (!user?.id) {
      setFollowing((currentFollowing) => {
        const nextFollowing = toggleFollowRelationship(currentFollowing, targetUser)
        localStorage.setItem("feed-following", JSON.stringify(nextFollowing))
        return nextFollowing
      })
      return
    }

    try {
      const { following: nextFollowing } = await apiRequest('/social/follows', {
        method: 'POST',
        body: JSON.stringify({ targetUser }),
      })

      setFollowing(nextFollowing || [])
      localStorage.setItem("feed-following", JSON.stringify(nextFollowing || []))
    } catch (error) {
      console.error('Failed to update follow state:', error)
    }
  }

  const visiblePosts = useMemo(() => {
    const allVisible = getVisiblePosts(posts, user?.id ?? null, following)

    // Keep exactly 8 posts on the feed; rotate the selection on each refresh
    if (allVisible.length > FEED_POST_LIMIT) {
      const seed = refreshSeed % allVisible.length
      const rotated = [...allVisible.slice(seed), ...allVisible.slice(0, seed)]
      return rotated.slice(0, FEED_POST_LIMIT)
    }

    return allVisible
  }, [posts, user?.id, following, refreshSeed])

  return (
    <div className={`feed-layout ${darkMode ? "dark" : ""}`}>
      <LeftSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="feed-center">
        <TopBar setSidebarOpen={setSidebarOpen} />

        <section className="feed-welcome">
          <div>
            <h2>Welcome back, {user?.username || 'MiitVerse member'}!</h2>
          </div>
        </section>

        <CreatePost onAddPost={handleAddPost} onRefresh={loadFeedData} isRefreshing={isLoading} />
        <PostList
          posts={visiblePosts}
          isLoading={isLoading}
          onPostUpdated={handlePostUpdated}
        />
      </main>

      <RightSidebar
        following={following}
        onFollowToggle={handleFollowToggle}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onRefresh={() => loadFeedData({ scrollToTop: true })}
      />
      <BottomNav />
    </div>
  );
}