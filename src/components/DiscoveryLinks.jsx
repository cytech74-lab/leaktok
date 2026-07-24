import { Link } from 'react-router-dom'

export const discoveryRoutes = [
  { to: '/trending', label: 'Trending Videos' },
  { to: '/latest', label: 'Latest Videos' },
  { to: '/popular', label: 'Popular Videos' },
  { to: '/explore/ghana', label: 'Ghana Videos' },
]

export default function DiscoveryLinks({ className = '' }) {
  return (
    <nav className={`discovery-links ${className}`} aria-label="Discover videos">
      {discoveryRoutes.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}
    </nav>
  )
}
