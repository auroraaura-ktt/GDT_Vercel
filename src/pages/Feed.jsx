import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from '../context/useAuth'
import BottomNav from "../components/BottomNav"
import LeftSidebar from "../components/LeftSidebar"
import RightSidebar from "../components/RightSidebar"
import TopBar from "../components/TopBar"
import CreatePost from "../components/CreatePost"
import PostList from "../components/PostList"
import { getVisiblePosts, isPagePost, shouldPersistSocialPost, toggleFollowRelationship } from "../lib/socialFeed"
import { useVerifiedAuthors } from "../lib/useVerifiedAuthors"
import { apiRequest } from "../lib/api"

export default function Feed() {
  const { user, ready } = useAuth()
  const verifiedAuthors = useVerifiedAuthors()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMorePosts, setHasMorePosts] = useState(true)
  const [feedError, setFeedError] = useState("")
  const [activeFeed, setActiveFeed] = useState("current")
  const followingRef = useRef([])
  const loadMoreRef = useRef(null)
  const cursorRef = useRef(null)
  const hasMoreRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const feedRequestRef = useRef(false)

  const FEED_POST_LIMIT = 8

  const loadFeedData = useCallback(async ({ scrollToTop = false, reset = true, refresh = false } = {}) => {
    if (feedRequestRef.current) return
    if (!reset && !hasMoreRef.current) return

    feedRequestRef.current = true
    if (reset) setIsLoading(true)
    else setIsLoadingMore(true)
    setFeedError("")

    if (scrollToTop) {
      cursorRef.current = null
      hasMoreRef.current = true
      setHasMorePosts(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const feedCenter = document.querySelector('.feed-center')
      if (feedCenter) feedCenter.scrollTo({ top: 0, behavior: 'smooth' })
    }

    try {
      const savedFollowing = localStorage.getItem("feed-following")
      if (savedFollowing && reset) {
        const storedFollowing = JSON.parse(savedFollowing)
        followingRef.current = storedFollowing
        setFollowing(storedFollowing)
      }

      if (!ready) {
        return
      }

      if (!user?.id) {
        setPosts((currentPosts) => reset ? [
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
        ] : currentPosts)
        hasMoreRef.current = false
        setHasMorePosts(false)
        return
      }

      loadingMoreRef.current = !reset
      const postsPath = new URLSearchParams({ limit: String(FEED_POST_LIMIT) })
      const requestedCursor = reset || refresh ? null : cursorRef.current
      if (requestedCursor) postsPath.set('cursor', requestedCursor)
      const [{ posts: serverPosts, hasMore, nextCursor: returnedCursor }, { following: serverFollowing }] = await Promise.all([
        apiRequest(`/social/posts?${postsPath.toString()}`),
        reset ? apiRequest('/social/follows') : Promise.resolve({ following: followingRef.current }),
      ])

      const incomingPosts = Array.isArray(serverPosts) ? serverPosts : []
      setPosts((currentPosts) => {
        const merged = reset || refresh ? [...incomingPosts, ...currentPosts] : [...currentPosts, ...incomingPosts]
        const unique = new Map(merged.filter(Boolean).map((post) => [String(post.id), post]))
        return [...unique.values()]
      })
      if (reset) {
        followingRef.current = serverFollowing || []
        setFollowing(serverFollowing || [])
        localStorage.setItem("feed-following", JSON.stringify(serverFollowing || []))
      }
      if (!refresh) {
        cursorRef.current = returnedCursor || null
        hasMoreRef.current = Boolean(hasMore)
        setHasMorePosts(Boolean(hasMore))
      }
    } catch (error) {
      console.error("Failed to load feed posts:", error)
      setFeedError(reset ? "We couldn't load your feed." : "We couldn't load more posts.")
    } finally {
      if (reset) setIsLoading(false)
      feedRequestRef.current = false
      loadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [ready, user?.id])

  useEffect(() => {
    const startLoad = () => {
      window.setTimeout(() => {
        loadFeedData({ reset: true })
      }, 0)
    }

    startLoad()

    const refreshTimer = window.setInterval(() => {
      loadFeedData({ reset: false, refresh: true })
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
    // A browser File / object-URL is only valid for a live preview. It must
    // never be serialized into local state or fed back as a permanent image
    // reference. Only a persisted server URL (post.image) is kept.
    const stripImageFile = (post) => {
      if (!post || typeof post !== "object") return post
      const { imageFile, ...rest } = post
      if (typeof rest.image === "string" && (rest.image.startsWith("blob:") || rest.image.startsWith("object-url:"))) {
        rest.image = null
      }
      return rest
    }

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
        const nextPosts = [stripImageFile(newPost), ...currentPosts]
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
        if (newPost.profilePicture) formData.append('profilePicture', newPost.profilePicture)
        formData.append('visibility', newPost.visibility || 'public')
        formData.append('image', newPost.imageFile)

        postResponse = await apiRequest('/social/posts', {
          method: 'POST',
          body: formData,
        })
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
        const nextPosts = [stripImageFile(newPost), ...currentPosts]
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
      followingRef.current = nextFollowing || []
      localStorage.setItem("feed-following", JSON.stringify(nextFollowing || []))
    } catch (error) {
      console.error('Failed to update follow state:', error)
    }
  }

  const visiblePosts = useMemo(
    () => getVisiblePosts(posts, user?.id ?? null, following),
    [posts, user?.id, following]
  )

  // Blue-mark status belongs to the account. Every post card resolves the
  // badge from the author's CURRENT account state via the live
  // verified-accounts set (server-resolved at read time, never stored on the
  // post), so Admin enable/disable changes apply immediately to past, current,
  // and future posts without touching any post.
  const accountVerifiedPosts = useMemo(
    () => visiblePosts.map((post) => {
      if (!post) return post

      const postUserId = post.userId ?? post.authorId ?? post.ownerId ?? null
      const authorIsVerified = !!postUserId && !!verifiedAuthors && verifiedAuthors.has(String(postUserId))
      return {
        ...post,
        isVerified: Boolean(authorIsVerified || (postUserId && String(postUserId) === String(user?.id) && Boolean(user?.verified))),
      }
    }),
    [visiblePosts, verifiedAuthors, user?.id, user?.verified]
  )

  // Split the already-retrieved, already-sorted feed posts into the two tabs.
  // This reuses the existing feed data and algorithm; it only decides which
  // existing posts are shown in each feed based on the account type.
  const userPosts = useMemo(
    () => accountVerifiedPosts.filter((post) => !isPagePost(post)),
    [accountVerifiedPosts]
  )
  const pagePosts = useMemo(
    () => accountVerifiedPosts.filter((post) => isPagePost(post)),
    [accountVerifiedPosts]
  )

  const feedPosts = activeFeed === 'page' ? pagePosts : userPosts

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        setIsLoadingMore(true)
        loadFeedData({ reset: false })
      }
    }, { rootMargin: "700px 0px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadFeedData, visiblePosts.length])

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

        <div className="tabs" role="tablist" aria-label="Feed type">
          <button
            type="button"
            role="tab"
            aria-selected={activeFeed === 'page'}
            className={`tab ${activeFeed === 'page' ? 'active' : ''}`}
            onClick={() => setActiveFeed('page')}
          >
            <div className="tab-icon">
              <svg viewBox="0 0 24 24">
                <path d="M7 20V4h11l-2.5 3L18 10H7" />
                <path d="M7 4v16" />
              </svg>

              <span className="notification">{pagePosts.length}</span>
            </div>

            Page
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFeed === 'current'}
            className={`tab ${activeFeed === 'current' ? 'active' : ''}`}
            onClick={() => setActiveFeed('current')}
          >
            <div className="tab-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="3.5" />
                <path d="M5 21c.5-4.1 2.9-6.5 7-6.5s6.5 2.4 7 6.5" />
              </svg>

              <span className="notification">{userPosts.length}</span>
            </div>

            User
          </button>
        </div>

        <PostList
          posts={feedPosts}
          isLoading={isLoading}
          onPostUpdated={handlePostUpdated}
        />
        {feedError && <div className="feed-load-error" role="alert">{feedError}<button type="button" onClick={() => loadFeedData({ reset: !feedError.includes("more") })}>Retry</button></div>}
        <div ref={loadMoreRef} className="feed-load-status" aria-live="polite">
          {isLoadingMore && <span className="feed-loader" aria-label="Loading more posts" />}
          {!isLoading && !isLoadingMore && !hasMorePosts && feedPosts.length > 0 && <span>You've reached the end of your feed.</span>}
        </div>
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
