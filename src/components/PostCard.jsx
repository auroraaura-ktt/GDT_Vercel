import "./PostCard.css";
import { useState, useEffect } from "react";
import ReactionModal from "./ReactionModal";
import VerifiedBadge from "./VerifiedBadge";
import PhotoLightbox from "./PhotoLightbox";
import EditPostModal from "./EditPostModal";
import { resolveApiUrl, apiRequest, downloadProtectedFile } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { useVerifiedAuthors } from "../lib/useVerifiedAuthors";

function formatTimestamp(value) {
  if (!value) return "just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";

  const minutesAgo = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));

  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h ago`;
  return `${Math.floor(minutesAgo / 1440)}d ago`;
}

export default function PostCard({ post = {}, onPostUpdated, onPostDeleted }) {
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
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);

  const [showReactionModal, setShowReactionModal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

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
      // The backend may return just reaction info or a full post. We only ever
      // read the reaction fields we need — never replacing the whole post
      // object, so the card (photos, files, author, verification, etc.) always
      // stays intact and the post remains visible in the Feed.
      const nextPost = result.post || {};
      const nextLikers = Array.isArray(nextPost.likedBy) ? nextPost.likedBy : [];
      const nextLikes = typeof nextPost.likes !== "undefined" ? Number(nextPost.likes || 0)
        : (Array.isArray(reactions?.likers) ? reactions.likers.length : Number(reactions?.likes || 0));
      const reacted = typeof result.reacted !== "undefined" ? Boolean(result.reacted) : !reactions.liked;

      setReactions((current) => ({
        ...current,
        likes: nextLikes,
        liked: reacted,
        likers: nextLikers,
      }));

      // Propagate ONLY reaction fields up to the Feed. Feed merges these into
      // the existing post, preserving every other field.
      if (nextPost.id) {
        onPostUpdated?.({ id: nextPost.id, likes: nextLikes, likedBy: nextLikers });
      }
    } catch (error) {
      // Never remove the post on a reaction failure — leave it visible and
      // report the problem without touching the Feed list.
      console.error("Failed to save reaction:", error);
      if (error?.status && error.status !== 404) {
        console.warn("Reaction could not be saved; the post remains visible.");
      }
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

  const canManagePost = Boolean(user?.id) && (
    String(postUserId) === String(user.id) ||
    String(post.pageOwnerId) === String(user.id) ||
    user.role === "admin"
  );

  const handleEdit = () => {
    setShowPostMenu(false);
    setIsEditingPost(true);
  };

  const handleEditSaved = (updatedPost) => {
    setIsEditingPost(false);
    // Propagate the full updated post so the Feed/Profile/PageDashboard card
    // updates in place without resetting the rest of the Feed.
    onPostUpdated?.(updatedPost);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await apiRequest(`/social/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      onPostDeleted?.(id);
    } catch (error) {
      window.alert(error.message || "We could not delete this post.");
    }
  };

  // Page posts carry their full page name; fall back to the regular username.
  const authorLabel = pageName || username;
  const displayName = typeof authorLabel === "string" && authorLabel.trim() ? authorLabel.trim() : "User";

  // Multiple-photo/media support. `media` is the list of server-stored files
  // that belong to this one post; `image` remains the legacy single-photo field
  // so old posts keep rendering exactly as before. Non-image attachments
  // (documents, etc.) render as simple file chips instead of broken images.
  const mediaEntries = Array.isArray(post.media)
    ? post.media
        .map((item) => {
          const url = typeof item === "string" ? item : item?.url;
          const type = typeof item === "object" && item ? item.type : null;
          const name = typeof item === "object" && item ? item.name : null;
          const size = typeof item === "object" && item ? item.size : null;
          return typeof url === "string" && url ? { url, type: type || null, name: name || null, size: Number(size) || null } : null;
        })
        .filter(Boolean)
    : [];
  const isImageMedia = (entry) =>
    entry.type ? String(entry.type).startsWith("image/") : /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.url);
  const mediaImages = mediaEntries.filter(isImageMedia);
  const mediaFiles = mediaEntries.filter((entry) => !isImageMedia(entry));
  const primaryImage = image || mediaImages[0]?.url || null;
  const imageSrc = primaryImage ? resolveApiUrl(primaryImage.replace(/^\/api(?=\/)/, "")) : null;

  // All viewable photos on this post (used by the lightbox). These are the
  // actual image entries, resolved to absolute URLs that `<img>` can render.
  // A legacy single `image` (not present in media) is included so old photo
  // posts also open in the viewer.
  const lightboxPhotos = (() => {
    const fromMedia = mediaImages.map((entry) => resolveApiUrl(entry.url.replace(/^\/api(?=\/)/, "")));
    const hasLegacyImage = primaryImage && !mediaImages.some((entry) => {
      const resolved = resolveApiUrl(entry.url.replace(/^\/api(?=\/)/, ""));
      return resolved === (primaryImage && resolveApiUrl(primaryImage.replace(/^\/api(?=\/)/, "")));
    });
    if (hasLegacyImage && primaryImage) {
      return [...fromMedia, resolveApiUrl(primaryImage.replace(/^\/api(?=\/)/, ""))];
    }
    return fromMedia;
  })();

  const formatFileSize = (bytes) => {
    if (!bytes || Number(bytes) <= 0) return "";
    const raw = Number(bytes);
    if (raw < 1024) return `${raw} B`;
    if (raw < 1024 * 1024) return `${Math.round((raw / 1024) * 10) / 10} KB`;
    return `${Math.round((raw / (1024 * 1024)) * 10) / 10} MB`;
  };

  // A stable token for a file entry so we can show progress on the right button.
  const downloadingToken = (url) => {
    if (typeof url !== "string") return null;
    return url.split("/").pop() || null;
  };

  const handleDownload = async (entry) => {
    if (!user?.id) {
      window.alert("Sign in to download this file.");
      return;
    }
    if (downloadingId) return;

    const token = downloadingToken(entry.url);
    if (!token) return;

    setDownloadingId(token);
    try {
      const fileName = typeof entry.url === "string" ? entry.url.split("/").pop() : "";
      const path = `/social/download/${encodeURIComponent(fileName)}`;
      await downloadProtectedFile(path, { name: entry.name || fileName });
    } catch (error) {
      window.alert(error?.message || "We could not download this file.");
    } finally {
      setDownloadingId(null);
    }
  };

  const renderFileChip = (entry, index) => {
    const token = downloadingToken(entry.url);
    const downloading = downloadingId === token;
    return (
      <div key={`${id}-file-${index}`} className="post-file-chip">
        <span className="post-file-chip-icon" aria-hidden="true">📎</span>
        <div className="post-file-chip-body">
          <span className="post-file-chip-name">{entry.name || entry.url.split("/").pop()}</span>
          {(entry.type || entry.size) && (
            <span className="post-file-chip-meta">
              {entry.type ? String(entry.type).toUpperCase() : "FILE"}
              {entry.size ? ` · ${formatFileSize(entry.size)}` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          className="post-file-download-btn"
          aria-label={`Download ${entry.name || "file"}`}
          title="Download"
          disabled={Boolean(downloadingId)}
          onClick={() => handleDownload(entry)}
        >
          {downloading ? <span className="button-spinner" aria-hidden="true" /> : "⬇"}
        </button>
      </div>
    );
  };

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

      <PhotoLightbox
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(nextIndex) => setLightboxIndex(nextIndex)}
      />

      {canManagePost && (
        <EditPostModal
          post={post}
          isOpen={isEditingPost}
          onClose={() => setIsEditingPost(false)}
          onSaved={handleEditSaved}
        />
      )}

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

          {canManagePost && (
            <div className="post-card-menu">
              <button
                type="button"
                className="post-card-menu-trigger"
                aria-label="Post options"
                onClick={() => setShowPostMenu((visible) => !visible)}
              >
                ⋯
              </button>
              {showPostMenu && (
                <div className="post-card-menu-dropdown">
                  <button type="button" onClick={handleEdit} disabled={isSavingEdit}>Edit</button>
                  <button type="button" onClick={handleDelete}>Delete</button>
                </div>
              )}
            </div>
          )}
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

        {mediaEntries.length > 1 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: mediaEntries.length === 2 ? "1fr 1fr" : "1fr 1fr",
              gap: "2px",
            }}
            aria-label="Post photos"
          >
            {mediaEntries.map((entry, index) =>
              isImageMedia(entry) ? (
                <img
                  key={`${id}-media-${index}`}
                  src={resolveApiUrl(entry.url.replace(/^\/api(?=\/)/, ""))}
                  alt={`post photo ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                    display: "block",
                    cursor: "pointer",
                  }}
                  onClick={() => setLightboxIndex(index)}
                  onError={(event) => {
                    if (!event.currentTarget.dataset.fallbackTried) {
                      event.currentTarget.dataset.fallbackTried = "true";
                      event.currentTarget.src = entry.url;
                      return;
                    }
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <button
                  key={`${id}-media-${index}`}
                  type="button"
                  className="post-media-file"
                  disabled={Boolean(downloadingId)}
                  onClick={() => handleDownload(entry)}
                >
                  <span className="post-media-file-icon" aria-hidden="true">📄</span>
                  <span className="post-media-file-name">{entry.name || entry.url.split("/").pop()}</span>
                  {(entry.type || entry.size) && (
                    <span className="post-media-file-meta">
                      {entry.type ? String(entry.type).toUpperCase() : "FILE"}
                      {entry.size ? ` · ${formatFileSize(entry.size)}` : ""}
                    </span>
                  )}
                  <span className="post-media-file-btn" role="presentation">
                    {downloadingId === downloadingToken(entry.url) ? (
                      <span className="button-spinner" aria-hidden="true" />
                    ) : (
                      "⬇ Download"
                    )}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        {mediaEntries.length <= 1 && mediaFiles.map((entry, index) => renderFileChip(entry, index))}

        {mediaEntries.length <= 1 && primaryImage && (
          <img
            src={imageSrc}
            alt="post"
            style={{
              width: "100%",
              maxHeight: "550px",
              objectFit: "cover",
              display: "block",
              cursor: "pointer",
            }}
            onClick={() => setLightboxIndex(0)}
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

        {postComments.length > 0 && (
          <div className="post-comments" aria-label="Comments">
            {postComments.map((comment, index) => {
              const commentName = comment?.username || comment?.author || "MiitVerse member";
              return (
                <div className="post-comment" key={comment?.id || `${commentName}-${index}`}>
                  <strong>{commentName}</strong>
                  <p>{comment?.content || comment?.text || ""}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
