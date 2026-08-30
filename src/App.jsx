import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from './context/AuthContext.jsx'

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}