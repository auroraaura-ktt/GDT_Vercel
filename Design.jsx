import React, { useState } from "react";

export default function App() {
  const [activeNav, setActiveNav] = useState("Home");
  const [activeTab, setActiveTab] = useState("Page");
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [postText, setPostText] = useState("");
  const [night, setNight] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const navItems = [
    {
      name: "Home",
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5.2v-6.2H9.2V21H4a1 1 0 0 1-1-1v-9.2Z" />
        </svg>
      ),
    },
    {
      name: "Explore",
      icon: (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="m15.7 8.3-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2Z" />
        </svg>
      ),
    },
    {
      name: "Events",
      icon: (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" />
        </svg>
      ),
    },
    {
      name: "Community",
      icon: (
        <svg viewBox="0 0 24 24">
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 19c.5-3.1 2.4-5 5.5-5s5 1.9 5.5 5M15 14.5c2.8-.1 4.6 1.5 5 4.5" />
        </svg>
      ),
    },
    {
      name: "Messages",
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v6A3.5 3.5 0 0 1 16.5 15H11l-4.5 4v-4.1A3.5 3.5 0 0 1 4 11.5v-6Z" />
          <path d="M9 8.5h6M9 11.5h4" />
        </svg>
      ),
    },
  ];

  const Icon = ({ children, className = "" }) => (
    <span className={`icon ${className}`}>{children}</span>
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const submitComment = () => {
    if (!comment.trim()) return;

    setComments((prev) => [...prev, comment.trim()]);
    setComment("");
  };

  const createPost = () => {
    if (!postText.trim()) return;
    alert("Post created!");
    setPostText("");
  };

  return (
    <div className={`app ${night ? "night-mode" : ""}`}>
      <style>{`

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
          width: 100%;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        body {
          background: #eef5fc;
        }

        button,
        textarea {
          font-family: inherit;
        }

        button {
          border: 0;
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
          width: 100%;
          background:
            radial-gradient(
              circle at 52% 25%,
              rgba(255,255,255,.98) 0,
              rgba(245,250,255,.98) 35%,
              rgba(237,245,252,1) 100%
            );
          color: #10244c;
          display: grid;
          grid-template-columns: 342px minmax(560px, 1fr) 420px;
          gap: 0;
          overflow-x: hidden;
          transition: .25s ease;
        }

        /* ================================
           LEFT SIDEBAR
        ================================= */

        .sidebar {
          min-height: 100vh;
          background:
            linear-gradient(
              180deg,
              #061b47 0%,
              #061d4a 45%,
              #04183f 100%
            );
          color: white;
          padding: 24px 18px 30px 24px;
          position: relative;
          overflow: hidden;
        }

        .sidebar::after {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: rgba(53,91,163,.08);
          bottom: -180px;
          left: -150px;
          pointer-events: none;
        }

        .brand {
          height: 92px;
          display: flex;
          align-items: center;
          gap: 17px;
          padding: 0 10px;
          margin-bottom: 25px;
        }

        .brand-logo {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
          background:
            radial-gradient(circle at 50% 50%, #f7cc36 0 13%, transparent 14%),
            radial-gradient(circle at 50% 50%, #1d6ed7 0 35%, #172d84 36% 60%, #0d174d 61% 100%);
          border: 2px solid #384ab8;
          box-shadow:
            0 0 0 4px rgba(255, 202, 24, .08),
            inset 0 0 12px rgba(255,255,255,.25);
        }

        .brand-logo::before {
          content: "";
          position: absolute;
          width: 31px;
          height: 20px;
          border-radius: 50%;
          border: 4px solid #f5cf3c;
          transform: rotate(-12deg);
        }

        .brand-logo::after {
          content: "";
          position: absolute;
          width: 3px;
          height: 26px;
          background: #f5cf3c;
          transform: rotate(15deg);
          box-shadow:
            9px -3px 0 #f5cf3c,
            -9px 4px 0 #f5cf3c;
        }

        .brand-name {
          font-size: 28px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -.8px;
          white-space: nowrap;
        }

        .brand-name span {
          color: #ffc329;
        }

        .brand-subtitle {
          margin-top: 9px;
          font-size: 13px;
          color: #dbe6fa;
          font-weight: 500;
          white-space: nowrap;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nav-item {
          height: 61px;
          padding: 0 22px;
          border-radius: 16px;
          color: #f4f7ff;
          display: flex;
          align-items: center;
          gap: 23px;
          font-size: 19px;
          font-weight: 650;
          background: transparent;
          position: relative;
          transition: .18s ease;
          text-align: left;
        }

        .nav-item:hover {
          background: rgba(255,255,255,.08);
        }

        .nav-item.active {
          background:
            linear-gradient(
              90deg,
              rgba(69,96,150,.56),
              rgba(68,92,144,.48)
            );
        }

        .nav-item.active::before {
          content: "";
          position: absolute;
          width: 4px;
          left: 0;
          top: 0;
          bottom: 0;
          border-radius: 4px;
          background: #f62961;
        }

        .icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          flex-shrink: 0;
        }

        .icon svg {
          width: 100%;
          height: 100%;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .nav-item:first-child .icon svg {
          fill: white;
          stroke: white;
        }

        .sidebar-divider {
          height: 1px;
          background: rgba(255,255,255,.27);
          margin: 27px 22px 0 22px;
        }

        /* ================================
           CENTER
        ================================= */

        .main {
          min-width: 0;
          padding: 37px 34px 70px;
        }

        .welcome {
          margin: 0 0 18px 6px;
          color: #0d234d;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -.8px;
        }

        .composer {
          background: rgba(255,255,255,.92);
          border-radius: 19px;
          padding: 16px 21px 16px;
          box-shadow: 0 8px 25px rgba(22,61,111,.06);
          border: 1px solid rgba(221,231,243,.7);
        }

        .composer-top {
          display: flex;
          align-items: flex-start;
          gap: 19px;
        }

        .avatar {
          width: 65px;
          height: 65px;
          border-radius: 50%;
          background: #062456;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: 800;
          font-size: 21px;
          flex-shrink: 0;
        }

        .composer textarea {
          width: 100%;
          height: 120px;
          resize: none;
          border: 1px solid #dce7f5;
          border-radius: 20px;
          outline: none;
          padding: 19px 18px;
          color: #122856;
          font-size: 17px;
          background: linear-gradient(135deg,#fafcff,#f6faff);
        }

        .composer textarea::placeholder {
          color: #7e8dab;
          opacity: 1;
        }

        .composer textarea:focus {
          border-color: #9eb5d9;
          box-shadow: 0 0 0 3px rgba(35,83,150,.06);
        }

        .composer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 15px;
        }

        .photo-button {
          background: transparent;
          color: #0c214a;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 700;
        }

        .photo-button svg {
          width: 24px;
          height: 24px;
          fill: currentColor;
        }

        .post-button {
          min-width: 116px;
          height: 45px;
          padding: 0 20px;
          border-radius: 24px;
          color: white;
          background: #092657;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-size: 17px;
          font-weight: 700;
          box-shadow: 0 4px 8px rgba(5,25,64,.13);
        }

        .post-button svg {
          width: 21px;
          height: 21px;
          fill: white;
        }

        /* ================================
           TABS
        ================================= */

        .tabs {
          height: 105px;
          border-bottom: 1px solid #dce5f0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 150px;
          margin-bottom: 28px;
        }

        .tab {
          height: 82px;
          min-width: 116px;
          background: transparent;
          color: #7787a4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 15px;
          font-weight: 600;
          position: relative;
        }

        .tab.active {
          color: #0b214c;
        }

        .tab.active::after {
          content: "";
          position: absolute;
          height: 4px;
          border-radius: 4px 4px 0 0;
          background: #0c224f;
          width: 116px;
          bottom: -1px;
        }

        .tab-icon {
          width: 30px;
          height: 30px;
          position: relative;
          color: currentColor;
        }

        .tab-icon svg {
          width: 100%;
          height: 100%;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .notification {
          position: absolute;
          right: -8px;
          top: -5px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #f72b5e;
          color: white;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,.1);
        }

        /* ================================
           POST
        ================================= */

        .post {
          background: rgba(255,255,255,.96);
          border-radius: 19px;
          border-top: 4px solid #ffc226;
          padding: 25px 22px 18px;
          box-shadow: 0 7px 24px rgba(27,65,114,.06);
        }

        .post-header {
          display: flex;
          align-items: center;
        }

        .post-avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          background:
            linear-gradient(145deg,#102c67,#081d50);
          border: 2px solid #f32a62;
          box-shadow:
            0 0 0 2px #ffe24e,
            0 0 0 4px #132d70;
        }

        .post-author {
          margin-left: 13px;
        }

        .author-row {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 18px;
          font-weight: 800;
          color: #102750;
        }

        .verified {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          color: #050505;
          background: #ffc51c;
          font-size: 12px;
        }

        .post-time {
          color: #7283a1;
          font-size: 15px;
          margin-top: 3px;
        }

        .more-button {
          margin-left: auto;
          width: 38px;
          height: 38px;
          background: transparent;
          color: #18305b;
          border-radius: 50%;
          font-size: 25px;
          line-height: 1;
          letter-spacing: 2px;
        }

        .more-button:hover {
          background: #f1f5fa;
        }

        .post-content {
          padding: 24px 12px 25px;
          color: #101e39;
          font-size: 19px;
          font-weight: 500;
          min-height: 70px;
        }

        .post-stats {
          height: 50px;
          border-bottom: 1px solid #e4e9f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 17px;
          color: #71809d;
          font-size: 16px;
        }

        .like-stat {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .heart {
          width: 22px;
          height: 22px;
          color: #fa295c;
          display: inline-flex;
        }

        .heart svg {
          width: 100%;
          height: 100%;
          fill: currentColor;
        }

        .comment-stat {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .comment-stat svg {
          width: 21px;
          height: 21px;
          fill: #adb6c9;
        }

        .post-actions {
          height: 70px;
          border-bottom: 1px solid #e4e9f0;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
        }

        .action {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 13px;
          background: transparent;
          color: #17294f;
          font-size: 17px;
          font-weight: 700;
          transition: .15s ease;
        }

        .action:hover {
          background: #f7faff;
        }

        .action.liked {
          color: #f5295b;
        }

        .action svg {
          width: 25px;
          height: 25px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .action.liked svg {
          fill: currentColor;
        }

        .report {
          color: #17294f;
        }

        .report svg {
          fill: #fa2c5d;
          stroke: #fa2c5d;
        }

        .comments-area {
          padding: 17px 12px 0;
        }

        .others {
          color: #ffb719;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .existing-comment {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 16px;
          color: #15264b;
        }

        .comment-name {
          font-weight: 800;
          margin-right: 6px;
        }

        .comment-text {
          font-weight: 500;
        }

        .view-comments {
          border: 0;
          background: transparent;
          color: #72809c;
          padding: 13px 0 0;
          font-size: 15px;
          cursor: pointer;
        }

        .comment-input {
          margin-top: 15px;
          display: flex;
          gap: 8px;
        }

        .comment-input input {
          flex: 1;
          height: 39px;
          border: 1px solid #dce5f1;
          border-radius: 20px;
          outline: none;
          padding: 0 15px;
          color: #122653;
        }

        .comment-input button {
          padding: 0 15px;
          border-radius: 20px;
          background: #0a285c;
          color: white;
          font-weight: 700;
        }

        /* ================================
           RIGHT SIDEBAR
        ================================= */

        .right-panel {
          min-height: 100vh;
          border-left: 1px solid #526a96;
          margin: 14px 0 0;
          padding: 68px 46px 0 25px;
          position: relative;
        }

        .profile-card {
          min-height: 312px;
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              #143665 0%,
              #0b2859 100%
            );
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 26px 20px 23px;
          box-shadow: 0 8px 20px rgba(15,48,93,.06);
        }

        .profile-avatar {
          width: 103px;
          height: 103px;
          border-radius: 50%;
          background: #fff;
          color: #102952;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 29px;
          font-weight: 800;
          margin-bottom: 17px;
        }

        .profile-name {
          font-size: 19px;
          font-weight: 800;
          margin-bottom: 19px;
        }

        .profile-email {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 27px;
          white-space: nowrap;
        }

        .profile-button {
          width: 100%;
          height: 53px;
          border-radius: 28px;
          background: #ffbc19;
          color: #062253;
          font-size: 17px;
          font-weight: 800;
          transition: .15s ease;
        }

        .profile-button:hover {
          background: #ffc62e;
          transform: translateY(-1px);
        }

        .side-button {
          width: 100%;
          height: 50px;
          border-radius: 27px;
          margin-top: 34px;
          background: #0a285a;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          font-size: 17px;
          font-weight: 700;
        }

        .side-button svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
        }

        .refreshing svg {
          animation: spin .7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .night-button {
          margin-top: 15px;
          background: #fff1c9;
          color: #092653;
        }

        .night-button svg {
          fill: currentColor;
          stroke: currentColor;
        }

        /* ================================
           NIGHT MODE
        ================================= */

        .app.night-mode {
          background:
            radial-gradient(
              circle at 50% 15%,
              #20375e 0,
              #0c1d3a 55%,
              #07152c 100%
            );
          color: #edf4ff;
        }

        .night-mode .main,
        .night-mode .right-panel {
          color: #eef5ff;
        }

        .night-mode .welcome {
          color: #f2f6ff;
        }

        .night-mode .composer,
        .night-mode .post {
          background: #102647;
          border-color: #213b61;
        }

        .night-mode .composer textarea {
          background: #0d203d;
          color: white;
          border-color: #294466;
        }

        .night-mode .composer textarea::placeholder {
          color: #91a4c3;
        }

        .night-mode .photo-button,
        .night-mode .post-content,
        .night-mode .author-row,
        .night-mode .action,
        .night-mode .tab.active {
          color: #edf4ff;
        }

        .night-mode .tabs,
        .night-mode .post-stats,
        .night-mode .post-actions {
          border-color: #29405f;
        }

        .night-mode .tab {
          color: #9fb1cb;
        }

        .night-mode .view-comments,
        .night-mode .post-time,
        .night-mode .post-stats {
          color: #9eafc8;
        }

        .night-mode .side-button {
          background: #172f54;
        }

        .night-mode .night-button {
          background: #dce9ff;
        }

        /* ================================
           RESPONSIVE
        ================================= */

        @media (max-width: 1450px) {
          .app {
            grid-template-columns: 300px minmax(520px, 1fr) 360px;
          }

          .right-panel {
            padding-right: 30px;
          }

          .tabs {
            gap: 100px;
          }
        }

        @media (max-width: 1180px) {
          .app {
            grid-template-columns: 245px minmax(500px, 1fr);
          }

          .right-panel {
            display: none;
          }

          .brand-name {
            font-size: 24px;
          }

          .nav-item {
            font-size: 17px;
          }
        }

        @media (max-width: 850px) {
          .app {
            grid-template-columns: 82px minmax(0, 1fr);
          }

          .sidebar {
            padding: 20px 10px;
          }

          .brand {
            justify-content: center;
            padding: 0;
          }

          .brand-logo {
            width: 52px;
            height: 52px;
          }

          .brand-name,
          .brand-subtitle {
            display: none;
          }

          .nav-item {
            justify-content: center;
            padding: 0;
            gap: 0;
          }

          .nav-item span:not(.icon) {
            display: none;
          }

          .nav-item.active::before {
            width: 3px;
          }

          .sidebar-divider {
            margin-left: 5px;
            margin-right: 5px;
          }

          .main {
            padding: 27px 18px 50px;
          }

          .welcome {
            font-size: 25px;
          }

          .tabs {
            gap: 70px;
          }
        }

        @media (max-width: 600px) {
          .app {
            display: block;
          }

          .sidebar {
            position: fixed;
            z-index: 20;
            bottom: 0;
            left: 0;
            right: 0;
            min-height: auto;
            height: 70px;
            padding: 6px 10px;
            border-top: 1px solid rgba(255,255,255,.1);
          }

          .brand,
          .sidebar-divider {
            display: none;
          }

          .nav {
            height: 100%;
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
          }

          .nav-item {
            height: 55px;
            width: 55px;
            border-radius: 13px;
          }

          .nav-item.active::before {
            top: auto;
            left: 7px;
            right: 7px;
            bottom: 0;
            width: auto;
            height: 3px;
          }

          .main {
            padding: 22px 11px 95px;
          }

          .welcome {
            margin-left: 5px;
            font-size: 23px;
          }

          .composer {
            padding: 13px;
          }

          .composer-top {
            gap: 11px;
          }

          .avatar {
            width: 48px;
            height: 48px;
            font-size: 16px;
          }

          .composer textarea {
            height: 100px;
            font-size: 15px;
            padding: 15px;
            border-radius: 15px;
          }

          .photo-button {
            font-size: 15px;
          }

          .post-button {
            min-width: 95px;
            height: 41px;
            font-size: 15px;
          }

          .tabs {
            height: 88px;
            gap: 50px;
            margin-bottom: 17px;
          }

          .tab {
            height: 70px;
          }

          .post {
            padding: 20px 13px 15px;
          }

          .post-content {
            padding-left: 4px;
          }

          .post-actions {
            height: 62px;
          }

          .action {
            gap: 6px;
            font-size: 14px;
          }

          .action svg {
            width: 21px;
            height: 21px;
          }

          .post-stats {
            padding: 0 5px;
          }
        }

      `}</style>

      {/* ===========================
          LEFT SIDEBAR
      ============================ */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"></div>

          <div>
            <div className="brand-name">
              Miit<span>Verse</span>
            </div>

            <div className="brand-subtitle">
              Official Social Hub of MIIT
            </div>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activeNav === item.name ? "active" : ""
              }`}
              onClick={() => setActiveNav(item.name)}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-divider"></div>
      </aside>

      {/* ===========================
          MAIN CONTENT
      ============================ */}
      <main className="main">
        <h1 className="welcome">
          Welcome back, Kyaw Thein Tun!
        </h1>

        {/* Composer */}
        <section className="composer">
          <div className="composer-top">
            <div className="avatar">KT</div>

            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="What's on your mind?"
            />
          </div>

          <div className="composer-bottom">
            <button className="photo-button">
              <svg viewBox="0 0 24 24">
                <path d="M5 6h3l1.4-2h5.2L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                <circle
                  cx="12"
                  cy="13"
                  r="3.5"
                  fill="white"
                  stroke="#0c214a"
                  strokeWidth="1.5"
                />
              </svg>
              Photo
            </button>

            <button className="post-button" onClick={createPost}>
              <svg viewBox="0 0 24 24">
                <path d="m3 11 18-8-7 18-3-7-8-3Z" />
                <path d="m11 14 10-11" />
              </svg>
              Post
            </button>
          </div>
        </section>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${
              activeTab === "Page" ? "active" : ""
            }`}
            onClick={() => setActiveTab("Page")}
          >
            <div className="tab-icon">
              <svg viewBox="0 0 24 24">
                <path d="M7 20V4h11l-2.5 3L18 10H7" />
                <path d="M7 4v16" />
              </svg>

              <span className="notification">2</span>
            </div>

            Page
          </button>

          <button
            className={`tab ${
              activeTab === "User" ? "active" : ""
            }`}
            onClick={() => setActiveTab("User")}
          >
            <div className="tab-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="3.5" />
                <path d="M5 21c.5-4.1 2.9-6.5 7-6.5s6.5 2.4 7 6.5" />
              </svg>

              <span className="notification">5</span>
            </div>

            User
          </button>
        </div>

        {/* Post */}
        <article className="post">
          <div className="post-header">
            <div className="post-avatar">SW</div>

            <div className="post-author">
              <div className="author-row">
                Shine Wunna Tun
                <span className="verified">✓</span>
              </div>

              <div className="post-time">19d ago</div>
            </div>

            <button className="more-button">•••</button>
          </div>

          <div className="post-content">
            HELLO
          </div>

          <div className="post-stats">
            <div className="like-stat">
              <span className="heart">
                <svg viewBox="0 0 24 24">
                  <path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8C3.2 6 5.2 4 7.8 4c1.7 0 3.3.9 4.2 2.2C12.9 4.9 14.5 4 16.2 4c2.6 0 4.6 2 4.6 4.8Z" />
                </svg>
              </span>

              {liked ? 1 : 0} Likes
            </div>

            <div className="comment-stat">
              <svg viewBox="0 0 24 24">
                <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3.5A2 2 0 0 1 3 14V7a2 2 0 0 1 2-2Z" />
              </svg>

              {comments.length} Comments
            </div>
          </div>

          <div className="post-actions">
            <button
              className={`action ${liked ? "liked" : ""}`}
              onClick={() => setLiked(!liked)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8C3.2 6 5.2 4 7.8 4c1.7 0 3.3.9 4.2 2.2C12.9 4.9 14.5 4 16.2 4c2.6 0 4.6 2 4.6 4.8Z" />
              </svg>

              Like
            </button>

            <button className="action">
              <svg viewBox="0 0 24 24">
                <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3.5A2 2 0 0 1 3 14V7a2 2 0 0 1 2-2Z" />
              </svg>

              Comment
            </button>

            <button
              className="action report"
              onClick={() => alert("Post reported")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 21V4" />
                <path d="M6 5h12l-3 4 3 4H6" />
              </svg>

              Report
            </button>
          </div>

          <div className="comments-area">
            <div className="others">
              {liked ? "1 other liked this" : "0 others liked this"}
            </div>

            <div className="existing-comment">
              <span className="comment-name">
                Shine Wunna Tun
              </span>

              <span className="verified">✓</span>

              <span className="comment-text">
                HELLO
              </span>
            </div>

            <button className="view-comments">
              View all {comments.length} comments
            </button>

            {/* Optional functional comment input */}
            <div className="comment-input">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitComment();
                }}
                placeholder="Write a comment..."
              />

              <button onClick={submitComment}>
                Send
              </button>
            </div>
          </div>
        </article>
      </main>

      {/* ===========================
          RIGHT PROFILE PANEL
      ============================ */}
      <aside className="right-panel">
        <section className="profile-card">
          <div className="profile-avatar">
            KT
          </div>

          <div className="profile-name">
            Kyaw Thein Tun
          </div>

          <div className="profile-email">
            2022–miit–cse–022@miit.edu.mm
          </div>

          <button
            className="profile-button"
            onClick={() => alert("Opening profile...")}
          >
            View Profile
          </button>
        </section>

        <button
          className={`side-button ${
            refreshing ? "refreshing" : ""
          }`}
          onClick={handleRefresh}
        >
          <svg viewBox="0 0 24 24">
            <path d="M20 11a8 8 0 0 0-14.7-4L3 10" />
            <path d="M3 5v5h5" />
            <path d="M4 13a8 8 0 0 0 14.7 4L21 14" />
            <path d="M21 19v-5h-5" />
          </svg>

          Refresh
        </button>

        <button
          className="side-button night-button"
          onClick={() => setNight(!night)}
        >
          <svg viewBox="0 0 24 24">
            <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
          </svg>

          {night ? "Day" : "Night"}
        </button>
      </aside>
    </div>
  );
}