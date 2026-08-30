import { Route, Routes } from 'react-router-dom'

import ProtectedRoute from '../components/ProtectedRoute'
import About from '../pages/About'
import Admin from '../pages/Admin'
import AdminLogin from '../pages/AdminLogin'
import ContactUs from '../pages/ContactUs'
import Feed from '../pages/Feed'
import Home from '../pages/Home'
import Login from '../pages/Login'
import PageDashboard from '../pages/PageDashboard'
import Profile from '../pages/Profile'
import Register from '../pages/Register'
import Verify from '../pages/Verify'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route
        path="/feed"
        element={(
          <ProtectedRoute>
            <Feed />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        )}
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route
        path="/page/:slug"
        element={(
          <ProtectedRoute roles={['page', 'admin']}>
            <PageDashboard />
          </ProtectedRoute>
        )}
      />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={(
          <ProtectedRoute roles={['admin']} redirectTo="/admin-login">
            <Admin />
          </ProtectedRoute>
        )}
      />
    </Routes>
  )
}
