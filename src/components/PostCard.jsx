import "./PostCard.css";
import { useState, useEffect } from "react";
import ReactionModal from "./ReactionModal";
import VerifiedBadge from "./VerifiedBadge";
import { resolveApiUrl } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { useVerifiedAuthors } from "../lib/useVerifiedAuthors";
import { apiRequest } from "../lib/api";

function formatTimestamp(value) {
  if (!value) return "just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";

  const minutesAgo = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));

  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h ago`;
  return `${Math.floor(minutesAgo / 1440)}d ago`;
}

export default function PostCard({ post = {}, onPostUpdated }) {
  const { user } = useAuth();
  const verifiedAuthors = useVerifiedAuthors();

  const {
    id = "default",
    username = post.author || post.username || "",
    pageName = null,
    profilePicture = null,
    content = "The latest community update is ready.",
    image = null,
    createdAt = post.timestamp || new Date().toISOString(),
    likes = 0,
    comments = [],
    reposts = 0,
    shares = reposts,
    likedBy = [],
  } = post;

  // Verification belongs to the account, never to the post. The badge is
  // derived exclusively from the author's CURRENT account state (the live
  // verified-accounts set, which the server resolves at read time) so admin
  // enable/disable changes apply immediately to old, current, and future
  // posts without editing or recreating any post.
  const postUserId = post.userId ?? post.authorId ?? post.ownerId ?? null;
  const ownAccountVerified = String(postUserId ?? '') === String(user?.id ?? '') && Boolean(user?.verified);
  const authorIsVerified = !!postUserId && !!verifiedAuthors && verifiedAuthors.has(String(postUserId));
  const isVerified = Boolean(
    ownAccountVerified ||
    authorIsVerified
  );

  const initialCommentCount = Array.isArray(comments) ? comments.length : Number(comments || 0);

  const initialLikers = Array.isArray(likedBy) ? likedBy : [];
  const [reactions, setReactions] = useState({
    postId: id,
    likes: Number(likes || 0),
    comments: initialCommentCount,
    shares: Number(shares ?? reposts ?? 0),
    liked: initialLikers.some((entry) => String(entry?.userId) === String(user?.id)),
    likers: initialLikers,
  });
  const [postComments, setPostComments] = useState(Array.isArray(comments) ? comments : []);
  const [liking, setLiking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const [showReactionModal, setShowReactionModal] = useState(false);

  useEffect(() => {
    const nextLikers = Array.isArray(likedBy) ? likedBy : [];
    setReactions((current) => ({
      ...current,
      likes: Number(likes || 0),
      comments: initialCommentCount,
      shares: Number(shares ?? reposts ?? 0),
      liked: nextLikers.some((entry) => String(entry?.userId) === String(user?.id)),
      likers: nextLikers,
    }));
    setPostComments(Array.isArray(comments) ? comments : []);
  }, [id, likes, initialCommentCount, reposts, shares, user?.id, likedBy, comments]);

  const handleLike = async () => {
    if (liking || !user?.id) return;

    setLiking(true);
    try {
      const result = await apiRequest(`/social/posts/${encodeURIComponent(id)}/likes`, { method: "POST" });
      const nextPost = result.post || {};
      const nextLikers = Array.isArray(nextPost.likedBy) ? nextPost.likedBy : [];
      setReactions((current) => ({
        ...current,
        likes: Number(nextPost.likes || 0),
        liked: Boolean(result.reacted),
        likers: nextLikers,
      }));
      onPostUpdated?.(nextPost);
    } catch (error) {
      console.error("Failed to save reaction:", error);
    } finally {
      setLiking(false);
    }
  };

  const handleComment = () => {
    setShowReactionModal(true);
  };

  const handleCommentAdded = (nextPost) => {
    const nextComments = Array.isArray(nextPost?.comments) ? nextPost.comments : [];
    setPostComments(nextComments);
    setReactions((current) => ({ ...current, comments: nextComments.length }));
    onPostUpdated?.(nextPost);
  };

  const handleReport = async () => {
    if (reporting || reported || !user?.id) return;

    setReporting(true);
    try {
      await apiRequest(`/social/posts/${encodeURIComponent(id)}/reports`, {
        method: "POST",
        body: JSON.stringify({ type: "Inappropriate content" }),
      });
      setReported(true);
      window.alert("This post has been reported and will be reviewed by the moderation team.");
    } catch (error) {
      window.alert(error.message || "We could not submit the report. Please try again.");
    } finally {
      setReporting(false);
    }
  };

  const handleReactionCountClick = () => {
    setShowReactionModal(true);
  };

  // Page posts carry their full page name; fall back to the regular username.
  const authorLabel = pageName || username;
  const displayName = typeof authorLabel === "string" && authorLabel.trim() ? authorLabel.trim() : "User";
  const imageSrc = image ? resolveApiUrl(image.replace(/^\/api(?=\/)/, "")) : null;

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "U";

  return (
    <>
      <ReactionModal
        isOpen={showReactionModal}
        onClose={() => setShowReactionModal(false)}
        post={post}
        reactions={reactions}
        likers={reactions.likers}
        comments={postComments}
        onCommentAdded={handleCommentAdded}
      />

      <div className="post-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background:
                  "linear-gradient(45deg,#f58529,#feda77,#dd2a7b,#8134af,#515bd4)",
                padding: "2px",
              }}
            >
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={username}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "#001e62",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: initials.length > 1 ? "12px" : "16px",
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="post-card-author" style={{ fontWeight: "600" }}>{displayName}</span>
                {isVerified && <VerifiedBadge size="small" />}
              </div>
              <div className="post-card-time">{formatTimestamp(createdAt)}</div>
            </div>
          </div>

          <span style={{ fontSize: "20px", cursor: "pointer" }}>⋯</span>
        </div>

        <div style={{ padding: "0 16px 16px" }}>
          <p
            className="post-card-body"
            style={{
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
            }}
          >
            {content}
          </p>
        </div>

        {image && (
          <img
            src={imageSrc}
            alt="post"
            style={{
              width: "100%",
              maxHeight: "550px",
              objectFit: "cover",
              display: "block",
            }}
            onError={(event) => {
              if (!event.currentTarget.dataset.fallbackTried) {
                event.currentTarget.dataset.fallbackTried = "true";
                event.currentTarget.src = image;
                return;
              }
              event.currentTarget.style.display = "none";
            }}
          />
        )}

        <div
          className="post-reactions-count"
          onClick={handleReactionCountClick}
          style={{
            padding: "12px 16px",
            fontSize: "14px",
            color: "#4B5D7A",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = "#f8f8f8")}
          onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
        >
          <span>❤️ {reactions.likes} Likes</span>
          <span>💬 {reactions.comments} Comments</span>
        </div>

        <div
          className="post-actions"
          style={{
            display: "flex",
            justifyContent: "space-around",
            padding: "12px 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <button
            className="post-action-btn"
            onClick={handleLike}
            disabled={liking}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "8px",
              fontSize: "16px",
              color: reactions.liked ? "#e74c3c" : "#0B1E4F",
              fontWeight: reactions.liked ? "600" : "500",
              transition: "all 0.2s ease",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                color: reactions.liked ? "#e74c3c" : "#6b7280",
                display: "inline-block",
                transform: reactions.liked ? "scale(1.06)" : "scale(1)",
              }}
            >
              {reactions.liked ? "♥" : "♡"}
            </span>
            <span>Like</span>
          </button>

          <button
            className="post-action-btn"
            onClick={handleComment}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "8px",
              fontSize: "16px",
              color: "#0B1E4F",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "18px" }}>💬</span>
            <span>Comment</span>
          </button>

          <button
            className="post-action-btn"
            onClick={handleReport}
            disabled={reporting || reported || !user?.id}
            title={!user?.id ? "Sign in to report this post" : reported ? "Post reported" : "Report this post"}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "8px",
              fontSize: "16px",
              color: reported ? "#b42318" : "#0B1E4F",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "18px" }}>🚩</span>
            {reporting && <span className="button-spinner" aria-hidden="true" />}
            <span>{reporting ? "Sending…" : reported ? "Reported" : "Report"}</span>
          </button>

        </div>

        <div className="post-engagement" style={{ padding: "12px 16px" }}>
          <p
            className="post-card-body"
            style={{
              lineHeight: "1.5",
              fontSize: "14px",
              marginBottom: "0",
            }}
          >
            <strong>{displayName}</strong> {isVerified && <VerifiedBadge size="small" />} {content.substring(0, 80)}
            {content.length > 80 ? "..." : ""}
          </p>
        </div>
      </div>
    </>
  );
}
