import Logo from './Logo'

export default function TopNav() {
  return (
    <header className="top-nav">
      <Logo compact />
      <div className="feed-tabs">
        <button className="active">For You</button>
      </div>
      <span />
    </header>
  )
}
