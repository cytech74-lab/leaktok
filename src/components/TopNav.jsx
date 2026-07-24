import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'
import DiscoveryLinks from './DiscoveryLinks'

export default function TopNav() {
  const navigate = useNavigate()
  return (
    <header className="top-nav">
      <Logo compact />
      <div className="feed-tabs">
        <button className="active">For You</button>
      </div>
      <button className="top-search icon-button" onClick={() => navigate('/search')} aria-label="Search videos">
        <Search />
      </button>
      <DiscoveryLinks className="feed-discovery-links" />
    </header>
  )
}
