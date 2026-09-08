import { useState } from "react";
import { apiRequest } from "../lib/api";
import { useVerifiedAuthors } from "../lib/useVerifiedAuthors";
import { useAuth } from "../context/useAuth";
import VerifiedBadge from "./VerifiedBadge";

function formatCommentTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function initials(name = "User") {
  return name.split(" ").filter(Boolean).map((part) => part[0]?.toUpperCase()).join("").slice(0, 2) || "U";
}

export default function ReactionModal({ isOpen, onClose, reactions, likers = [], comments = [], onCommentAdded }) {
  const { user } = useAuth();
  const verifiedIds = useVerifiedAuthors();
  const [activeTab, setActiveTab] = useState("comments");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const closeModal = () => {
    setActiveTab("comments");
    setDraft("");
    setError("");
    onClose();
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || submitting) return;
    if (!user?.id) {
      setError("Sign in to join the conversation.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequest(`/social/posts/${encodeURIComponent(reactions.postId)}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      onCommentAdded?.(result.post);
      setDraft("");
    } catch (submitError) {
      setError(submitError.message || "Comment could not be posted.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reaction-modal-overlay" onClick={closeModal}>
      <section className="reaction-modal" onClick={(event) => event.stopPropagation()} aria-label="Post activity">
        <header className="reaction-modal-header">
          <div><span className="reaction-modal-kicker">Community thread</span><h2>Post activity</h2></div>
          <button className="reaction-modal-close" onClick={closeModal} aria-label="Close post activity">&#10005;</button>
        </header>
        <div className="reaction-modal-tabs" role="tablist">
          <button className={activeTab === "comments" ? "active" : ""} onClick={() => setActiveTab("comments")} role="tab">Comments <span>{comments.length}</span></button>
          <button className={activeTab === "likes" ? "active" : ""} onClick={() => setActiveTab("likes")} role="tab">Likes <span>{reactions.likes}</span></button>
        </div>
        <div className="reaction-modal-content">
          {activeTab === "comments" ? (
            <>
              <div className="comment-list">
                {comments.length === 0 ? <div className="comments-empty"><div className="comments-empty-icon">&#9993;</div><strong>Start the conversation</strong><span>Be the first person to share a thought.</span></div> : comments.map((comment) => {
                  const name = comment.username || "MiitVerse member";
                  return <article className="comment-item" key={comment.id || `${comment.userId}-${comment.createdAt}`}><div className="comment-avatar">{initials(name)}</div><div className="comment-copy"><div className="comment-meta"><span className="comment-name"><strong>{name}</strong>{verifiedIds?.has(String(comment.userId)) && <VerifiedBadge size="small" />}</span><time>{formatCommentTime(comment.createdAt)}</time></div><p>{comment.content}</p></div></article>;
                })}
              </div>
              <form className="comment-composer" onSubmit={submitComment}>
                <div className="comment-avatar composer-avatar">{initials(user?.username || "You")}</div>
                <div className="composer-field"><textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} placeholder={user?.id ? "Add to the conversation..." : "Sign in to comment"} disabled={!user?.id || submitting} rows="2" maxLength="500" /><div className="composer-footer"><span>{draft.length}/500</span><button type="submit" disabled={!draft.trim() || submitting || !user?.id}>{submitting ? "Posting..." : "Post comment"}</button></div></div>
              </form>
              {error && <p className="comment-error" role="alert">{error}</p>}
            </>
          ) : <div className="like-list">{likers.length === 0 ? <div className="comments-empty"><strong>No likes yet</strong><span>Be the first to react.</span></div> : likers.map((liker) => { const name = liker.username || "MiitVerse member"; return <div className="like-item" key={liker.userId}><div className="comment-avatar">{initials(name)}</div><span className="comment-name"><strong>{name}</strong>{verifiedIds?.has(String(liker.userId)) && <VerifiedBadge size="small" />}</span><span>Liked this post</span></div>; })}</div>}
        </div>
      </section>
    </div>
  );
}
