import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import HomePage from './pages/HomePage'
import VideoPage from './pages/VideoPage'
import AdminPage from './pages/AdminPage'
import SearchPage from './pages/SearchPage'
import DiscoveryPage from './pages/DiscoveryPage'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/trending" element={<DiscoveryPage type="trending" />} />
        <Route path="/latest" element={<DiscoveryPage type="latest" />} />
        <Route path="/popular" element={<DiscoveryPage type="popular" />} />
        <Route path="/explore/ghana" element={<DiscoveryPage type="ghana" />} />
        <Route path="/video/:id" element={<VideoPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
