import { useState } from "react";
import VerifiedBadge from "./VerifiedBadge";

export default function ReactionModal({ isOpen, onClose, post, reactions, likers = [] }) {
  const [activeTab, setActiveTab] = useState("likes");

  if (!isOpen) return null;

  const commenters = [
    {
      id: 1,
      name: "Grace Lee",
      avatar: "GL",
      verified: true,
      comment: "Great information! Thanks for sharing.",
      time: "2h ago",
    },
    {
      id: 2,
      name: "Tom Brown",
      avatar: "TB",
      verified: false,
      comment: "This is exactly what I needed. Really helpful!",
      time: "1h ago",
    },
    {
      id: 3,
      name: "Lisa Park",
      avatar: "LP",
      verified: false,
      comment: "Can you provide more details about this?",
      time: "30m ago",
    },
  ];

  return (
    <div
      className="reaction-modal-overlay"
      style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          backdropFilter: "blur(4px)",
          pointerEvents: "auto",
        }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          maxWidth: "520px",
          width: "90%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          zIndex: 100000,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #eee",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
            Post Activity
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #eee",
            padding: "0",
          }}
        >
          <button
            onClick={() => setActiveTab("likes")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: activeTab === "likes" ? "3px solid #001e62" : "none",
              fontWeight: activeTab === "likes" ? "600" : "500",
              color: activeTab === "likes" ? "#001e62" : "#666",
              transition: "all 0.2s ease",
            }}
          >
            ❤️ Likes ({reactions.likes})
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: activeTab === "comments" ? "3px solid #001e62" : "none",
              fontWeight: activeTab === "comments" ? "600" : "500",
              color: activeTab === "comments" ? "#001e62" : "#666",
              transition: "all 0.2s ease",
            }}
          >
            💬 Comments ({reactions.comments})
          </button>
        </div>

        {/* Content */}
        <div
        style={{
            flex: 1,
            overflowY: "auto",
            padding: "0",
          }}
        >
          {activeTab === "likes" && (
            <div style={{ padding: "16px" }}>
              {likers.length === 0 ? (
                <p style={{ margin: 0, color: "#667085", textAlign: "center" }}>No account reactions to show yet.</p>
              ) : likers.map((user) => {
                const accountName = user.username || "MiitVerse member";
                const initials = accountName.split(" ").filter(Boolean).map((part) => part[0]?.toUpperCase()).join("").slice(0, 2) || "U";
                return (
                <div
                  key={user.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 0",
                    borderBottom: "1px solid #f0f0f0",
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "linear-gradient(45deg,#f58529,#feda77,#dd2a7b,#8134af,#515bd4)",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
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
                        fontSize: "12px",
                      }}
                    >
                      {initials}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: "600" }}>{accountName}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#999" }}>Account reaction</span>
                  </div>
                  <span style={{ fontSize: "18px" }}>❤️</span>
                </div>
                );
              })}
            </div>
          )}

          {activeTab === "comments" && (
            <div style={{ padding: "16px" }}>
              {commenters.slice(0, Math.min(reactions.comments, 3)).map((commenter) => (
                <div
                  key={commenter.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "linear-gradient(45deg,#f58529,#feda77,#dd2a7b,#8134af,#515bd4)",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
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
                          fontSize: "10px",
                        }}
                      >
                        {commenter.avatar}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: "600", fontSize: "14px" }}>
                          {commenter.name}
                        </span>
                        {commenter.verified && (
                          <VerifiedBadge size="small" />
                        )}
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0",
                          background: "#f0f0f0",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "14px",
                          lineHeight: "1.4",
                        }}
                      >
                        {commenter.comment}
                      </p>
                      <span style={{ fontSize: "12px", color: "#999", marginTop: "4px", display: "block" }}>
                        {commenter.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {reactions.comments > 3 && (
                <div style={{ textAlign: "center", padding: "12px", color: "#1877f2", cursor: "pointer" }}>
                  View all {reactions.comments} comments
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
