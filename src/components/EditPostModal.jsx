import { useState } from "react";
import { FaCamera, FaPaperclip } from "react-icons/fa";
import { apiRequest, resolveApiUrl } from "../lib/api";

const MAX_NEW_UPLOADS = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // matches the existing backend upload limit

function isImageMedia(entry) {
  if (!entry) return false;
  return entry.type
    ? String(entry.type).startsWith("image/")
    : /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.url || "");
}

// Derive the media this post currently owns, including any legacy single
// `image` value not already present in `media` (old posts) so it can also be
// kept or removed.
function deriveExisting(post = {}) {
  const entries = (Array.isArray(post.media) ? post.media : [])
    .map((item) => {
      const url = typeof item === "string" ? item : item?.url;
      if (typeof url !== "string" || !url) return null;
      return {
        url,
        type: typeof item === "object" && item ? item.type : null,
        name: typeof item === "object" && item ? item.name : null,
        size: typeof item === "object" && item ? Number(item.size) : null,
        removed: false,
      };
    })
    .filter(Boolean);

  const hasLegacy = typeof post.image === "string" && post.image && !entries.some((entry) => entry.url === post.image);
  if (hasLegacy) {
    entries.unshift({ url: post.image, type: null, name: null, size: null, removed: false });
  }
  return entries;
}

function formatFileSize(bytes) {
  if (!bytes || Number(bytes) <= 0) return "";
  const raw = Number(bytes);
  if (raw < 1024) return `${raw} B`;
  if (raw < 1024 * 1024) return `${Math.round((raw / 1024) * 10) / 10} KB`;
  return `${Math.round((raw / (1024 * 1024)) * 10) / 10} MB`;
}

function resolveMediaUrl(url) {
  return resolveApiUrl(String(url || "").replace(/^\/api(?=\/)/, ""));
}
export default function EditPostModal({ post = {}, isOpen, onClose, onSaved }) {
  const [content, setContent] = useState(String(post.content || ""));
  const [existing, setExisting] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Refresh local state whenever a post is opened for editing (including
  // re-opening the same post after closing, so canceled edits are discarded).
  const [lastKey, setLastKey] = useState(null);
  const openKey = `${String(post?.id || "")}:${String(Boolean(isOpen))}`;
  if (isOpen && lastKey !== openKey) {
    setLastKey(openKey);
    setContent(String(post.content || ""));
    setExisting(deriveExisting(post));
    setNewImages([]);
    setNewFiles([]);
    setErrorMessage("");
    setSaving(false);
  }

  if (!isOpen) return null;

  const existingImages = existing.filter((entry) => isImageMedia(entry));
  const existingFiles = existing.filter((entry) => !isImageMedia(entry));
  const keptCount = existing.filter((entry) => !entry.removed).length;

  const toggleRemoved = (url) => {
    setExisting((current) =>
      current.map((entry) => (entry.url === url ? { ...entry, removed: !entry.removed } : entry))
    );
  };

  const addNewImages = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setErrorMessage("Only image files can be added.");
      return;
    }
    setNewImages((current) => [...current, ...imageFiles].slice(0, MAX_NEW_UPLOADS));
    setErrorMessage("");
  };

  const addNewFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const oversized = files.filter((file) => file.size > MAX_FILE_SIZE).length;
    const accepted = files.filter((file) => file.size <= MAX_FILE_SIZE);
    setNewFiles((current) => [...current, ...accepted].slice(0, MAX_NEW_UPLOADS));
    setErrorMessage(oversized > 0 ? `${oversized} file(s) skipped because they exceed the 15 MB size limit.` : "");
  };

  const removeNewImage = (index) => setNewImages((current) => current.filter((_, position) => position !== index));
  const removeNewFile = (index) => setNewFiles((current) => current.filter((_, position) => position !== index));

  const save = async (event) => {
    event.preventDefault();

    const trimmed = content.trim();
    const newUploadCount = newImages.length + newFiles.length;
    if (!trimmed && keptCount === 0 && newUploadCount === 0) {
      setErrorMessage("Post content or media is required.");
      return;
    }
    if (trimmed.length > 5000) {
      setErrorMessage("Post text must be 5000 characters or fewer.");
      return;
    }

    const removeMedia = existing.filter((entry) => entry.removed).map((entry) => entry.url);
    const newUploads = [...newImages, ...newFiles];

    setSaving(true);
    setErrorMessage("");
    try {
      let result;
      if (newUploads.length > 0) {
        const formData = new FormData();
        formData.append("content", trimmed);
        if (removeMedia.length > 0) formData.append("removeMedia", JSON.stringify(removeMedia));
        if (newUploads.length === 1) {
          formData.append("image", newUploads[0]);
        } else {
          for (const file of newUploads) formData.append("images", file);
        }
        result = await apiRequest(`/social/posts/${encodeURIComponent(post.id)}`, {
          method: "PATCH",
          body: formData,
        });
      } else {
        result = await apiRequest(`/social/posts/${encodeURIComponent(post.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ content: trimmed, removeMedia }),
        });
      }
      onSaved?.(result.post);
      onClose?.();
    } catch (error) {
      setErrorMessage(error.message || "We could not update this post.");
      setSaving(false);
    }
  };

  return (
    <div className="reaction-modal-overlay" onClick={onClose}>
      <section className="reaction-modal edit-post-modal" onClick={(event) => event.stopPropagation()} aria-label="Edit post">
        <header className="reaction-modal-header">
          <div><span className="reaction-modal-kicker">Make changes</span><h2>Edit post</h2></div>
          <button className="reaction-modal-close" onClick={onClose} aria-label="Close edit post">&#10005;</button>
        </header>

        <form className="create-post" onSubmit={save} style={{ padding: "16px 24px 20px" }}>
          <div className="create-post-top">
            <textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              placeholder="What's on your mind?"
              rows={4}
              maxLength={5000}
              aria-label="Post text"
            />
          </div>
          <div className="create-post-footer">
            <span className="create-post-counter">{content.trim().length}/5000</span>
          </div>

          {existingImages.length > 0 && (
            <section className="create-post-image-preview" style={{ border: "1px solid #edf0f5", borderRadius: "12px", padding: "10px 12px", marginTop: "10px" }}>
              <p className="edit-post-section-label">Existing photos — click to remove</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
                {existingImages.map((entry, index) => (
                  <div key={`${entry.url}-${index}`} style={{ position: "relative" }}>
                    <img
                      src={resolveMediaUrl(entry.url)}
                      alt={`Existing photo ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "110px",
                        borderRadius: "12px",
                        objectFit: "cover",
                        opacity: entry.removed ? 0.35 : 1,
                      }}
                    />
                    <button
                      type="button"
                      className="close-video-btn"
                      style={{ position: "absolute", top: "4px", right: "4px", padding: "2px 8px", fontSize: "12px" }}
                      onClick={() => toggleRemoved(entry.url)}
                      aria-label={entry.removed ? `Restore ${entry.name || "photo"}` : `Remove ${entry.name || "photo"}`}
                    >
                      {entry.removed ? "↩ Restore" : "✕"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {existingFiles.length > 0 && (
            <section style={{ border: "1px solid #edf0f5", borderRadius: "12px", padding: "10px 12px", marginTop: "10px" }}>
              <p className="edit-post-section-label">Existing files — click to remove</p>
              {existingFiles.map((entry, index) => (
                <div
                  key={`${entry.url}-${index}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "6px 10px",
                    border: "1px solid #eee",
                    borderRadius: "10px",
                    marginBottom: "6px",
                    fontSize: "14px",
                    color: "#0B1E4F",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    📄 {entry.name || entry.url.split("/").pop()}
                    {(entry.type || entry.size) && (
                      <span style={{ color: "#6b7280", fontSize: "12px" }}>
                        {entry.type ? ` · ${String(entry.type).toUpperCase()}` : ""}
                        {entry.size ? ` · ${formatFileSize(entry.size)}` : ""}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="close-video-btn"
                    onClick={() => toggleRemoved(entry.url)}
                    aria-label={entry.removed ? `Restore ${entry.name || "file"}` : `Remove ${entry.name || "file"}`}
                  >
                    {entry.removed ? "↩ Restore" : "❌"}
                  </button>
                </div>
              ))}
            </section>
          )}
          {newImages.length > 0 && (
            <section className="create-post-image-preview">
              <p className="edit-post-section-label">New photos</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
                {newImages.map((file, index) => (
                  <div key={`new-${file.name}-${index}`} style={{ position: "relative" }}>
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`New photo preview ${index + 1}`}
                      style={{ width: "100%", height: "110px", borderRadius: "12px", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      className="close-video-btn"
                      style={{ position: "absolute", top: "4px", right: "4px", padding: "2px 8px" }}
                      onClick={() => removeNewImage(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {newFiles.length > 0 && (
            <section className="create-post-image-preview">
              <p className="edit-post-section-label">New files</p>
              {newFiles.map((file, index) => (
                <div
                  key={`new-file-${file.name}-${index}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "6px 10px",
                    border: "1px solid #eee",
                    borderRadius: "10px",
                    marginBottom: "6px",
                    fontSize: "14px",
                    color: "#0B1E4F",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {file.name}</span>
                  <button type="button" className="close-video-btn" onClick={() => removeNewFile(index)} aria-label={`Remove ${file.name}`}>❌</button>
                </div>
              ))}
            </section>
          )}

          {errorMessage && <p className="create-post-error" role="alert">{errorMessage}</p>}

          <div className="create-post-actions">
            <label style={{ cursor: "pointer" }}>
              <FaCamera /> Photo
              <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addNewImages} />
            </label>
            <label style={{ cursor: "pointer" }}>
              <FaPaperclip /> File
              <input type="file" multiple style={{ display: "none" }} onChange={addNewFiles} />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}