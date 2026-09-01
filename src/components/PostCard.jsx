import "./PostCard.css";
import { useState, useEffect } from "react";
import ReactionModal from "./ReactionModal";
import VerifiedBadge from "./VerifiedBadge";
import { useAuth } from "../context/useAuth";
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
    likedBy = [],
    verified = true,
  } = post;

  const { user } = useAuth();

  const initialCommentCount = Array.isArray(comments) ? comments.length : Number(comments || 0);

  const initialLikers = Array.isArray(likedBy) ? likedBy : [];
  const [reactions, setReactions] = useState({
    likes: Number(likes || 0),
    comments: initialCommentCount,
    shares: Number(reposts || 0),
    liked: initialLikers.some((entry) => String(entry?.userId) === String(user?.id)),
    likers: initialLikers,
  });
  const [liking, setLiking] = useState(false);

  const [showReactionModal, setShowReactionModal] = useState(false);

  useEffect(() => {
    const nextLikers = Array.isArray(likedBy) ? likedBy : [];
    setReactions((current) => ({
      ...current,
      likes: Number(likes || 0),
      comments: initialCommentCount,
      shares: Number(reposts || 0),
      liked: nextLikers.some((entry) => String(entry?.userId) === String(user?.id)),
      likers: nextLikers,
    }));
  }, [id, likes, initialCommentCount, reposts, user?.id, likedBy]);

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
    setReactions((prev) => ({
      ...prev,
      comments: prev.comments + 1,
    }));
  };

  const handleReport = () => {
    if (typeof window !== "undefined") {
      window.alert("This post has been reported and will be reviewed by the moderation team.");
    }
  };

  const handleReactionCountClick = () => {
    setShowReactionModal(true);
  };

  // Page posts carry their full page name; fall back to the regular username.
  const authorLabel = pageName || username;
  const displayName = typeof authorLabel === "string" && authorLabel.trim() ? authorLabel.trim() : "User";

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
                {verified && <VerifiedBadge size="small" />}
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
            src={image}
            alt="post"
            style={{
              width: "100%",
              maxHeight: "550px",
              objectFit: "cover",
              display: "block",
            }}
            onError={(event) => {
              event.target.style.display = "none";
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
            <span style={{ fontSize: "18px" }}>🚩</span>
            <span>Report</span>
          </button>

        </div>

        <div className="post-engagement" style={{ padding: "12px 16px" }}>
          <div
            className="post-card-engagement-count"
            style={{
              fontWeight: "600",
              marginBottom: "8px",
              fontSize: "14px",
              cursor: "pointer",
              color: "#F5B62D",
            }}
            onClick={handleReactionCountClick}
          >
            {reactions.liked ? "You and " : ""}{reactions.likes - (reactions.liked ? 1 : 0)} {reactions.likes - (reactions.liked ? 1 : 0) === 1 ? "other person" : "others"} liked this
          </div>

          <p
            className="post-card-body"
            style={{
              lineHeight: "1.5",
              fontSize: "14px",
              marginBottom: "8px",
            }}
          >
            <strong>{displayName}</strong> {verified && <VerifiedBadge size="small" />} {content.substring(0, 80)}
            {content.length > 80 ? "..." : ""}
          </p>

          <div
            className="post-card-comments-link"
            style={{
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: "600",
            }}
            onClick={handleReactionCountClick}
          >
            View all {reactions.comments} comments
          </div>
        </div>
      </div>
    </>
  );
}
