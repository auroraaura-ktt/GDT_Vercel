import { useEffect, useRef, useState } from "react";
import { FaCamera, FaPaperPlane, FaSync } from "react-icons/fa";
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
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setSelectedImage(file);
    setImagePreview(previewUrl);
    setErrorMessage("");
  }

  function handlePostSubmit(event) {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent && !selectedImage) {
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
      imageFile: selectedImage || null,
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

      {imagePreview && (
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
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
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
