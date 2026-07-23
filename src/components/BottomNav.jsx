import { Home } from 'lucide-react'

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button className="active" aria-label="Home">
        <Home size={23} fill="currentColor" />
        <span>Home</span>
      </button>
    </nav>
  )
}
