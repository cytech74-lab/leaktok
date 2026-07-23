export default function Logo({ compact = false }) {
  return (
    <div className={`logo ${compact ? 'logo-compact' : 'logo-full'}`} aria-label="LeakTok">
      <img src="/images/leaktok_logo.png" alt="LeakTok" />
    </div>
  )
}
