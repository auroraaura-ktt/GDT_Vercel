export default function LoadingState({ label = 'Loading', compact = false }) {
  return (
    <div className={`loading-state${compact ? ' loading-state-compact' : ''}`} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
