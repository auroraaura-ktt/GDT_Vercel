import { useEffect, useState } from "react";
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

function normalizeCommentThread(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    replies: Array.isArray(item?.replies) ? normalizeCommentThread(item.replies) : [],
  }));
}

function updateCommentTree(items, targetId, updater) {
  return items.flatMap((item) => {
    if (String(item?.id) === String(targetId)) {
      const nextItem = updater(item);
      return nextItem ? [nextItem] : [];
    }

    if (Array.isArray(item?.replies)) {
      const nextReplies = updateCommentTree(item.replies, targetId, updater);
      return [{ ...item, replies: nextReplies }];
    }

    return [item];
  });
}

function findItemById(items, targetId) {
  for (const item of items) {
    if (!item) continue;
    if (String(item.id) === String(targetId)) return item;
    if (Array.isArray(item.replies)) {
      const nested = findItemById(item.replies, targetId);
      if (nested) return nested;
    }
  }

  return null;
}

export default function ReactionModal({ isOpen, onClose, reactions, likers = [], comments = [], onCommentAdded }) {
  const { user } = useAuth();
  const verifiedIds = useVerifiedAuthors();
  const [activeTab, setActiveTab] = useState("comments");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [commentTree, setCommentTree] = useState(() => normalizeCommentThread(comments));
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [replyingCommentId, setReplyingCommentId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState(null);

  useEffect(() => {
    setCommentTree(normalizeCommentThread(comments));
  }, [comments]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      const clickedInsideMenu = event.target.closest(".comment-menu");
      const clickedInsideToggle = event.target.closest(".comment-menu-button");
      if (!clickedInsideMenu && !clickedInsideToggle) {
        setMenuOpenFor(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const closeModal = () => {
    setActiveTab("comments");
    setDraft("");
    setEditingCommentId(null);
    setEditDraft("");
    setReplyingCommentId(null);
    setReplyDraft("");
    setMenuOpenFor(null);
    setError("");
    onClose();
  };

  const isOwnerOfComment = (comment) => {
    if (!user?.id || !comment) return false;
    return String(comment.userId ?? comment.authorId ?? comment.ownerId ?? "") === String(user.id);
  };

  const getTrustedCommentTarget = (targetId, label) => {
    const item = findItemById(commentTree, targetId);
    if (!item || !isOwnerOfComment(item)) {
      setError(label === "reply" ? "You can only manage your own replies." : "You can only manage your own comment.");
      return null;
    }
    return item;
  };

  const commitCommentTree = (nextTree) => {
    setCommentTree(nextTree);
    onCommentAdded?.({ comments: nextTree });
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

  const startEditingComment = (comment) => {
    if (!isOwnerOfComment(comment)) {
      setError("You can only edit your own comment.");
      return;
    }

    setEditingCommentId(comment.id);
    setEditDraft(comment.content || "");
    setReplyingCommentId(null);
    setError("");
  };

  const toggleMenuFor = (key) => {
    setMenuOpenFor((current) => (current === key ? null : key));
  };

  const saveEditedComment = () => {
    if (!editingCommentId) return;
    const trustedComment = getTrustedCommentTarget(editingCommentId, "comment");
    if (!trustedComment) return;

    const content = editDraft.trim();
    if (!content) {
      setError("Comment text cannot be empty.");
      return;
    }

    const nextTree = updateCommentTree(commentTree, editingCommentId, (comment) => ({
      ...comment,
      content,
      editedAt: new Date().toISOString(),
    }));

    commitCommentTree(nextTree);
    setEditingCommentId(null);
    setEditDraft("");
    setError("");
  };

  const deleteComment = (comment) => {
    const trustedComment = getTrustedCommentTarget(comment.id, "comment");
    if (!trustedComment) return;

    if (!window.confirm("Delete this comment? This action cannot be undone.")) return;
    const nextTree = updateCommentTree(commentTree, trustedComment.id, () => null);
    commitCommentTree(nextTree);
    setEditingCommentId(null);
    setReplyingCommentId(null);
    setError("");
  };

  const submitReply = (parentComment) => {
    const content = replyDraft.trim();
    if (!content) {
      setError("Reply text cannot be empty.");
      return;
    }
    if (!user?.id) {
      setError("Sign in to reply to a comment.");
      return;
    }

    const newReply = {
      id: `reply-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      userId: user.id,
      username: user.username || "You",
      content,
      createdAt: new Date().toISOString(),
      parentCommentId: parentComment.id,
      replies: [],
    };

    const nextTree = updateCommentTree(commentTree, parentComment.id, (comment) => ({
      ...comment,
      replies: [...(Array.isArray(comment.replies) ? comment.replies : []), newReply],
    }));

    commitCommentTree(nextTree);
    setReplyingCommentId(null);
    setReplyDraft("");
    setError("");
  };

  const deleteReply = (parentComment, reply) => {
    const trustedReply = findItemById(commentTree, reply.id);
    if (!trustedReply || !isOwnerOfComment(trustedReply)) {
      setError("You can only delete your own replies.");
      return;
    }

    if (!window.confirm("Delete this reply?")) return;
    const nextTree = updateCommentTree(commentTree, parentComment.id, (comment) => ({
      ...comment,
      replies: (Array.isArray(comment.replies) ? comment.replies : []).filter((entry) => String(entry.id) !== String(reply.id)),
    }));

    commitCommentTree(nextTree);
    setEditingCommentId(null);
    setReplyingCommentId(null);
    setError("");
  };

  const saveEditedReply = (parentComment, reply) => {
    const trustedReply = findItemById(commentTree, reply.id);
    if (!trustedReply || !isOwnerOfComment(trustedReply)) {
      setError("You can only edit your own replies.");
      return;
    }

    const content = editDraft.trim();
    if (!content) {
      setError("Reply text cannot be empty.");
      return;
    }

    const nextTree = updateCommentTree(commentTree, parentComment.id, (comment) => ({
      ...comment,
      replies: (Array.isArray(comment.replies) ? comment.replies : []).map((entry) => (
        String(entry.id) === String(reply.id)
          ? { ...entry, content, editedAt: new Date().toISOString() }
          : entry
      )),
    }));

    commitCommentTree(nextTree);
    setEditingCommentId(null);
    setEditDraft("");
    setError("");
  };

  const renderComment = (comment, depth = 0) => {
    if (!comment) return null;

    const name = comment.username || comment.author || "MiitVerse member";
    const commentIsMine = isOwnerOfComment(comment);
    const replyList = Array.isArray(comment.replies) ? comment.replies : [];
    const isEditingThis = editingCommentId === comment.id;
    const menuKey = `comment:${comment.id}`;

    return (
      <div key={comment.id || `${comment.userId}-${comment.createdAt}`} className={depth === 0 ? "comment-item" : "comment-reply-item"}>
        <div className="comment-avatar">{initials(name)}</div>
        <div className="comment-copy">
          <div className="comment-headline">
            <div className="comment-meta">
              <span className="comment-name"><strong>{name}</strong>{verifiedIds?.has(String(comment.userId)) && <VerifiedBadge size="small" />}</span>
              <time>{formatCommentTime(comment.createdAt)}</time>
            </div>

            {!!user?.id && (
              <div className="comment-menu-wrap">
                <button
                  type="button"
                  className="comment-menu-button"
                  aria-label="Comment actions"
                  onClick={() => toggleMenuFor(menuKey)}
                >
                  ⋯
                </button>

                {menuOpenFor === menuKey && (
                  <div className="comment-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => {
                      setReplyingCommentId(comment.id);
                      setReplyDraft("");
                      setEditingCommentId(null);
                      setError("");
                      setMenuOpenFor(null);
                    }}>Reply</button>

                    {commentIsMine && (
                      <>
                        <button type="button" role="menuitem" onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditDraft(comment.content || "");
                          setReplyingCommentId(null);
                          setError("");
                          setMenuOpenFor(null);
                        }}>Edit</button>
                        <button type="button" role="menuitem" className="danger" onClick={() => {
                          if (!window.confirm("Delete comment?\n\nThis action will remove your comment.")) return;
                          deleteComment(comment);
                          setMenuOpenFor(null);
                        }}>Delete</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditingThis ? (
            <div className="comment-editor">
              <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value.slice(0, 500))} rows="3" maxLength="500" />
              <div className="comment-editor-actions">
                <button type="button" className="comment-action-btn primary" onClick={() => saveEditedComment()}>Save</button>
                <button type="button" className="comment-action-btn secondary" onClick={() => {
                  setEditingCommentId(null);
                  setEditDraft("");
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <p>{comment.content}</p>
          )}

          {replyingCommentId === comment.id && (
            <div className="comment-reply-form">
              <textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value.slice(0, 500))} rows="2" placeholder="Write a reply..." maxLength="500" />
              <div className="comment-editor-actions">
                <button type="button" className="comment-action-btn primary" onClick={() => submitReply(comment)}>Submit</button>
                <button type="button" className="comment-action-btn secondary" onClick={() => {
                  setReplyingCommentId(null);
                  setReplyDraft("");
                }}>Cancel</button>
              </div>
            </div>
          )}

          {replyList.length > 0 && (
            <div className="comment-reply-list">
              {replyList.map((reply) => {
                const replyIsMine = isOwnerOfComment(reply);
                const isEditingReply = editingCommentId === reply.id;
                const replyMenuKey = `reply:${comment.id}:${reply.id}`;

                return (
                  <div key={reply.id || `${reply.userId}-${reply.createdAt}`} className="comment-reply-item">
                    <div className="comment-avatar">{initials(reply.username || "You")}</div>
                    <div className="comment-copy">
                      <div className="comment-headline">
                        <div className="comment-meta">
                          <span className="comment-name"><strong>{reply.username || "You"}</strong>{verifiedIds?.has(String(reply.userId)) && <VerifiedBadge size="small" />}</span>
                          <time>{formatCommentTime(reply.createdAt)}</time>
                        </div>

                        {!!user?.id && (
                          <div className="comment-menu-wrap">
                            <button
                              type="button"
                              className="comment-menu-button"
                              aria-label="Reply actions"
                              onClick={() => toggleMenuFor(replyMenuKey)}
                            >
                              ⋯
                            </button>

                            {menuOpenFor === replyMenuKey && (
                              <div className="comment-menu" role="menu">
                                <button type="button" role="menuitem" onClick={() => {
                                  setReplyingCommentId(comment.id);
                                  setReplyDraft("");
                                  setEditingCommentId(null);
                                  setError("");
                                  setMenuOpenFor(null);
                                }}>Reply</button>

                                {replyIsMine && (
                                  <>
                                    <button type="button" role="menuitem" onClick={() => {
                                      setEditingCommentId(reply.id);
                                      setEditDraft(reply.content || "");
                                      setReplyingCommentId(null);
                                      setError("");
                                      setMenuOpenFor(null);
                                    }}>Edit</button>
                                    <button type="button" role="menuitem" className="danger" onClick={() => {
                                      if (!window.confirm("Delete reply?\n\nThis action will remove your reply.")) return;
                                      deleteReply(comment, reply);
                                      setMenuOpenFor(null);
                                    }}>Delete</button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditingReply ? (
                        <div className="comment-editor">
                          <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value.slice(0, 500))} rows="3" maxLength="500" />
                          <div className="comment-editor-actions">
                            <button type="button" className="comment-action-btn primary" onClick={() => saveEditedReply(comment, reply)}>Save</button>
                            <button type="button" className="comment-action-btn secondary" onClick={() => {
                              setEditingCommentId(null);
                              setEditDraft("");
                            }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p>{reply.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="reaction-modal-overlay" onClick={closeModal}>
      <section className="reaction-modal" onClick={(event) => event.stopPropagation()} aria-label="Post activity">
        <header className="reaction-modal-header">
          <div><span className="reaction-modal-kicker">Community thread</span><h2>Post activity</h2></div>
          <button className="reaction-modal-close" onClick={closeModal} aria-label="Close post activity">&#10005;</button>
        </header>
        <div className="reaction-modal-tabs" role="tablist">
          <button className={activeTab === "comments" ? "active" : ""} onClick={() => setActiveTab("comments")} role="tab">Comments <span>{commentTree.length}</span></button>
          <button className={activeTab === "likes" ? "active" : ""} onClick={() => setActiveTab("likes")} role="tab">Likes <span>{reactions.likes}</span></button>
        </div>
        <div className="reaction-modal-content">
          {activeTab === "comments" ? (
            <>
              <div className="comment-list">
                {commentTree.length === 0 ? <div className="comments-empty"><div className="comments-empty-icon">&#9993;</div><strong>Start the conversation</strong><span>Be the first person to share a thought.</span></div> : commentTree.map((comment) => renderComment(comment))}
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
