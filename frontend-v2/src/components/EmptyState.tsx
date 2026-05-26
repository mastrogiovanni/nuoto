interface Props {
  icon?: string
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon = '🔍', title, subtitle, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-text">{subtitle}</div>}
      {action && (
        <button className="btn btn--secondary btn--sm" onClick={action.onClick} style={{ marginTop: 12 }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
