import { useEffect, useRef, useState } from "react";
import { FaCamera, FaPaperPlane, FaPaperclip, FaSync } from "react-icons/fa";
import { useAuth } from "../context/useAuth";

const MAX_POST_LENGTH = 280;

export default function CreatePost({ onAddPost, onRefresh, isRefreshing }) {
  const { user, token } = useAuth();
  const [videoOpen, setVideoOpen] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  // Multiple-photo support: every selected file belongs to ONE post. The old
  // single-image state is kept so the existing single-photo flow is untouched.
  const [selectedImages, setSelectedImages] = useState([]);
  // File attachment support: rides the same existing 'images' upload path as
  // photos, so photos + files submit together as ONE post.
  const [selectedFiles, setSelectedFiles] = useState([]);
  const MAX_PHOTOS = 10;
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // matches the existing backend upload limit
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const initials = user?.username
    ? user.username
        .split(" ")
        .map((part) => part[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "U";

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [videoOpen]);

  async function handleOpenVideo() {
    if (videoOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setVideoOpen(false);
      setStreamError(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setVideoOpen(true);
      setStreamError(null);
    } catch (error) {
      setStreamError("Unable to access camera. Please allow camera permission.");
      setVideoOpen(false);
    }
  }

  function handleImageSelect(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setErrorMessage("Only image files can be attached.");
      return;
    }

    setSelectedImages((current) => [...current, ...imageFiles].slice(0, MAX_PHOTOS));

    const skippedCount = files.length - imageFiles.length;
    if (skippedCount > 0) {
      setErrorMessage(`${skippedCount} file(s) skipped because they are not images.`);
    } else {
      setErrorMessage("");
    }
  }

  function handleRemoveImage(index) {
    setSelectedImages((current) => current.filter((_, position) => position !== index));
  }

  function handleFileSelect(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const totalSelected = selectedImages.length + selectedFiles.length;
    const room = MAX_PHOTOS - totalSelected;
    if (room <= 0) {
      setErrorMessage(`A post can contain at most ${MAX_PHOTOS} photos/files in total.`);
      return;
    }

    const accepted = [];
    let oversized = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        oversized += 1;
        continue;
      }
      accepted.push(file);
      if (accepted.length >= room) break;
    }

    if (accepted.length > 0) {
      setSelectedFiles((current) => [...current, ...accepted]);
    }

    if (oversized > 0) {
      setErrorMessage(`${oversized} file(s) skipped because they exceed the 15 MB size limit.`);
    } else if (accepted.length < files.length) {
      setErrorMessage(`A post can contain at most ${MAX_PHOTOS} photos/files in total.`);
    } else {
      setErrorMessage("");
    }
  }

  function handleRemoveFile(index) {
    setSelectedFiles((current) => current.filter((_, position) => position !== index));
  }

  function handlePostSubmit(event) {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent && selectedImages.length === 0 && selectedFiles.length === 0) {
      setErrorMessage("Please write something before posting.");
      return;
    }

    if (trimmedContent.length > MAX_POST_LENGTH) {
      setErrorMessage(`Posts must be ${MAX_POST_LENGTH} characters or less.`);
      return;
    }

    const storedAuth = typeof window !== "undefined" ? window.localStorage.getItem("miitverse-auth") : null;
    const storedUser = storedAuth ? JSON.parse(storedAuth) : null;
    const resolvedUsername =
      user?.username ||
      storedUser?.user?.username ||
      storedUser?.username ||
      user?.email?.split("@")[0] ||
      "MiitVerse member";

    const newPost = {
      id: Date.now(),
      userId: user?.id || storedUser?.user?.id || "guest",
      username: resolvedUsername,
      profilePicture: user?.profilePicture || null,
      content: trimmedContent,
      image: null,
      imageFile: selectedImages[0] || null,
      imageFiles: selectedImages.length + selectedFiles.length > 0
        ? [...selectedImages, ...selectedFiles]
        : null,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
      reposts: 0,
      visibility: "public",
    };

    if (typeof onAddPost === "function") {
      onAddPost(newPost);
    }

    setContent("");
    setErrorMessage("");
    setSelectedImage(null);
    setImagePreview("");
    setSelectedImages([]);
    setSelectedFiles([]);
  }

  return (
    <form className="create-post" onSubmit={handlePostSubmit}>
      <div className="create-post-top">
        <div className="profile-avatar-small">{initials}</div>
        <textarea
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            if (errorMessage) {
              setErrorMessage("")
            }
          }}
          placeholder="What’s on your mind?"
          rows={4}
          maxLength={MAX_POST_LENGTH}
        />
      </div>

      {videoOpen && (
        <div className="create-post-video-preview">
          <video ref={videoRef} autoPlay playsInline muted className="video-preview" />
          <button type="button" className="close-video-btn" onClick={handleOpenVideo}>
            Close camera
          </button>
        </div>
      )}

      {streamError && <p className="stream-error">{streamError}</p>}

      {selectedFiles.length > 0 && (
        <div className="create-post-image-preview">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
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
                📄 {file.name}
              </span>
              <button
                type="button"
                className="close-video-btn"
                onClick={() => handleRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                ❌
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedImages.length > 0 && (
        <div className="create-post-image-preview">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
            {selectedImages.map((file, index) => (
              <div key={`${file.name}-${index}`} style={{ position: "relative" }}>
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Selected upload preview ${index + 1}`}
                  style={{ width: "100%", height: "110px", borderRadius: "12px", objectFit: "cover" }}
                />
                <button
                  type="button"
                  className="close-video-btn"
                  style={{ position: "absolute", top: "4px", right: "4px", padding: "2px 8px" }}
                  onClick={() => handleRemoveImage(index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="close-video-btn" onClick={() => setSelectedImages([])}>
            Remove all photos
          </button>
        </div>
      )}

      {imagePreview && !selectedImages.length && (
        <div className="create-post-image-preview">
          <img src={imagePreview} alt="Selected upload preview" style={{ maxWidth: "100%", maxHeight: "220px", borderRadius: "12px", objectFit: "cover" }} />
          <button type="button" className="close-video-btn" onClick={() => {
            setSelectedImage(null);
            setImagePreview("");
          }}>
            Remove photo
          </button>
        </div>
      )}

      <div className="create-post-footer">
        <span className="create-post-counter">{content.trim().length}/{MAX_POST_LENGTH}</span>
        {errorMessage && <span className="create-post-error">{errorMessage}</span>}
      </div>

      <div className="create-post-actions">
        <label style={{ cursor: "pointer" }}>
          <FaCamera /> Photo
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageSelect} />
        </label>
        <label style={{ cursor: "pointer" }}>
          <FaPaperclip /> File
          <input type="file" multiple style={{ display: "none" }} onChange={handleFileSelect} />
        </label>
        <button type="button" className="video-trigger" onClick={onRefresh}>
          {isRefreshing ? <span className="button-spinner" aria-hidden="true" /> : <FaSync />} {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button type="submit">
          <FaPaperPlane /> Post
        </button>
      </div>
    </form>
  );
}
