import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaArrowLeft,
  FaCamera,
  FaCalendarAlt,
  FaCheckCircle,
  FaEnvelope,
  FaIdCard,
  FaLock,
  FaShieldAlt,
  FaSignOutAlt,
  FaUpload,
  FaUser,
} from 'react-icons/fa'

import { useAuth } from '../context/useAuth'
import './Profile.css'

function getInitials(username = '') {
  const parts = username.trim().split(/\s+/).filter(Boolean)

  if (!parts.length) return 'U'

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatDate(value) {
  if (!value) return 'N/A'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'N/A'
  }

  return date.toLocaleDateString()
}

export default function Profile() {
  const navigate = useNavigate()

  const {
    user,
    logout,
    updateProfile,
    updateAvatar,
    changePassword,
  } = useAuth()

  const fileInputRef = useRef(null)

  const [username, setUsername] = useState(user?.username ?? '')

  const [usernameStatus, setUsernameStatus] = useState('')
  const [usernameError, setUsernameError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [passwordStatus, setPasswordStatus] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [avatarStatus, setAvatarStatus] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => {
    setUsername(user?.username ?? '')
    setAvatarPreview(user?.avatarUrl || '')
  }, [user?.username, user?.avatarUrl])

  const initials = useMemo(
    () => getInitials(user?.username),
    [user?.username]
  )

  if (!user) {
    return null
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleAvatarSelect(event) {
    const file = event.target.files?.[0]

    setAvatarError('')
    setAvatarStatus('')

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file.')
      return
    }

    const maxSize = 5 * 1024 * 1024

    if (file.size > maxSize) {
      setAvatarError('Profile photo must be smaller than 5 MB.')
      return
    }

    setSelectedAvatar(file)

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
  }

  async function handleAvatarUpload() {
    if (!selectedAvatar) {
      fileInputRef.current?.click()
      return
    }

    setAvatarUploading(true)
    setAvatarError('')
    setAvatarStatus('')

    try {
      await updateAvatar(selectedAvatar)

      setSelectedAvatar(null)
      setAvatarStatus('Profile photo updated successfully.')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setAvatarError(
        error?.data?.message ||
          error?.message ||
          'Could not update profile photo.'
      )
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleUsernameSubmit(event) {
    event.preventDefault()

    setUsernameError('')
    setUsernameStatus('')

    try {
      const updatedUser = await updateProfile({
        username,
      })

      setUsername(updatedUser.username)
      setUsernameStatus('Username updated successfully.')
    } catch (error) {
      setUsernameError(
        error?.data?.message ||
          error?.message ||
          'Could not update username.'
      )
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()

    setPasswordError('')
    setPasswordStatus('')

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    try {
      await changePassword({
        currentPassword,
        newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setPasswordStatus('Password updated successfully.')
    } catch (error) {
      setPasswordError(
        error?.data?.message ||
          error?.message ||
          'Could not update password.'
      )
    }
  }

  const avatarSource = avatarPreview || user.avatarUrl

  return (
    <main className="mv-profile-page">
      <div className="mv-profile-container">

        {/* TOP BAR */}
        <header className="mv-profile-topbar">
          <button
            className="mv-back-button"
            onClick={() => navigate('/feed')}
          >
            <FaArrowLeft />
            <span>Back to Feed</span>
          </button>

          <div className="mv-profile-brand">
            <span>MIIT</span>
            <strong>VERSE</strong>
          </div>
        </header>

        {/* HERO PROFILE */}
        <section className="mv-profile-hero">

          <div className="mv-cover">
            <div className="mv-cover-glow" />

            <div className="mv-cover-text">
              <span>MIITVERSE</span>
              <strong>Official Social Hub of MIIT</strong>
            </div>
          </div>

          <div className="mv-profile-main">

            <div className="mv-avatar-wrapper">

              <div className="mv-avatar">

                {avatarSource ? (
                  <img
                    src={avatarSource}
                    alt={`${user.username}'s profile`}
                  />
                ) : (
                  <span>{initials}</span>
                )}

              </div>

              <button
                type="button"
                className="mv-camera-button"
                title="Choose profile photo"
                onClick={() => fileInputRef.current?.click()}
              >
                <FaCamera />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarSelect}
                hidden
              />
            </div>

            <div className="mv-profile-identity">

              <div className="mv-name-line">
                <h1>{user.username}</h1>

                {user.verified !== false && (
                  <span
                    className="mv-verified"
                    title="Verified MiitVerse account"
                  >
                    <FaCheckCircle />
                  </span>
                )}
              </div>

              <p className="mv-handle">
                @{user.username?.toLowerCase().replace(/\s+/g, '')}
              </p>

              <p className="mv-bio">
                Welcome back! Manage your profile details,
                personal information, and account security.
              </p>

              <div className="mv-profile-actions">

                <button
                  type="button"
                  className="mv-primary-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FaUpload />
                  Choose Photo
                </button>

                <button
                  type="button"
                  className="mv-secondary-button"
                  onClick={handleAvatarUpload}
                  disabled={!selectedAvatar || avatarUploading}
                >
                  {avatarUploading
                    ? 'Uploading...'
                    : 'Save Profile Photo'}
                </button>

              </div>

              {avatarStatus && (
                <p className="mv-success">
                  {avatarStatus}
                </p>
              )}

              {avatarError && (
                <p className="mv-error">
                  {avatarError}
                </p>
              )}

              <p className="mv-photo-hint">
                JPG, PNG, WEBP or GIF · Maximum 5 MB
              </p>

            </div>
          </div>
        </section>

        {/* ACCOUNT INFORMATION */}
        <section className="mv-content-grid">

          <div className="mv-card mv-account-card">

            <div className="mv-card-heading">
              <div className="mv-card-icon">
                <FaUser />
              </div>

              <div>
                <h2>Account details</h2>
                <p>Your MiitVerse account information</p>
              </div>
            </div>

            <div className="mv-info-list">

              <div className="mv-info-row">
                <div className="mv-info-label">
                  <FaUser />
                  <span>Username</span>
                </div>

                <strong>{user.username}</strong>
              </div>

              <div className="mv-info-row">
                <div className="mv-info-label">
                  <FaEnvelope />
                  <span>Email</span>
                </div>

                <strong className="mv-break">
                  {user.email}
                </strong>
              </div>

              <div className="mv-info-row">
                <div className="mv-info-label">
                  <FaIdCard />
                  <span>User ID</span>
                </div>

                <strong className="mv-user-id">
                  {user.id}
                </strong>
              </div>

              <div className="mv-info-row">
                <div className="mv-info-label">
                  <FaCalendarAlt />
                  <span>Joined</span>
                </div>

                <strong>
                  {formatDate(user.createdAt)}
                </strong>
              </div>

              <div className="mv-info-row">
                <div className="mv-info-label">
                  <FaShieldAlt />
                  <span>Account role</span>
                </div>

                <strong className="mv-role">
                  {user.role || 'user'}
                </strong>
              </div>

              <div className="mv-info-row">
                <div className="mv-info-label">
                  <FaCheckCircle />
                  <span>Account status</span>
                </div>

                <strong className="mv-status">
                  Active
                </strong>
              </div>

            </div>
          </div>

          {/* SETTINGS */}
          <div className="mv-settings-column">

            {/* USERNAME */}
            <div className="mv-card">

              <div className="mv-card-heading">
                <div className="mv-card-icon">
                  <FaUser />
                </div>

                <div>
                  <h2>Update username</h2>
                  <p>
                    Change the name shown across MiitVerse.
                  </p>
                </div>
              </div>

              <form
                className="mv-form"
                onSubmit={handleUsernameSubmit}
              >

                <label>
                  New username

                  <input
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                    minLength={3}
                    maxLength={30}
                    required
                  />
                </label>

                {usernameStatus && (
                  <p className="mv-success">
                    {usernameStatus}
                  </p>
                )}

                {usernameError && (
                  <p className="mv-error">
                    {usernameError}
                  </p>
                )}

                <button
                  type="submit"
                  className="mv-primary-button"
                >
                  Save Username
                </button>

              </form>
            </div>

            {/* PASSWORD */}
            <div className="mv-card">

              <div className="mv-card-heading">
                <div className="mv-card-icon">
                  <FaLock />
                </div>

                <div>
                  <h2>Change password</h2>
                  <p>
                    Keep your MiitVerse account secure.
                  </p>
                </div>
              </div>

              <form
                className="mv-form"
                onSubmit={handlePasswordSubmit}
              >

                <label>
                  Current password

                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    minLength={6}
                    required
                  />
                </label>

                <label>
                  New password

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    minLength={8}
                    required
                  />
                </label>

                <label>
                  Confirm new password

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    minLength={8}
                    required
                  />
                </label>

                {passwordStatus && (
                  <p className="mv-success">
                    {passwordStatus}
                  </p>
                )}

                {passwordError && (
                  <p className="mv-error">
                    {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  className="mv-primary-button"
                >
                  <FaLock />
                  Change Password
                </button>

              </form>
            </div>

          </div>
        </section>

        {/* BOTTOM ACTIONS */}
        <section className="mv-bottom-actions">

          <button
            type="button"
            className="mv-secondary-button"
            onClick={() => navigate('/feed')}
          >
            <FaArrowLeft />
            Back to Feed
          </button>

          <button
            type="button"
            className="mv-danger-button"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            Logout
          </button>

        </section>

      </div>
    </main>
  )
}