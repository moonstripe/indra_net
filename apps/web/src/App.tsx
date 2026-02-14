import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import BaseDetail from './pages/BaseDetail'
import BaseVisualization from './pages/BaseVisualization'
import Settings from './pages/Settings'
import Docs from './pages/Docs'
import NotFound from './pages/NotFound'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="auth/callback/:provider" element={<AuthCallback />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bases/:id" element={<BaseDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="docs" element={<Docs />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Visualization route without layout (fullscreen) */}
        <Route path="bases/:id/viz" element={<BaseVisualization />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
