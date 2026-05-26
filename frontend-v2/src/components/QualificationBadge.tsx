interface Props {
  qualified: boolean
  category?: string
}

export default function QualificationBadge({ qualified, category }: Props) {
  if (qualified) {
    return (
      <div className="qual-card qual-card--qualified">
        <div className="qual-card-top">
          <span className="qual-flag">🇮🇹</span>
          <div>
            <div className="qual-title">Qualificato Nazionali</div>
            {category && (
              <div className="qual-sub">Raggiunto il minimo per i campionati {category}</div>
            )}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="qual-card qual-card--not">
      <div className="qual-card-top">
        <span className="qual-flag" style={{ filter: 'grayscale(1)', opacity: 0.5 }}>🇮🇹</span>
        <div>
          <div className="qual-title" style={{ color: 'var(--text-muted)' }}>Non qualificato</div>
          {category && (
            <div className="qual-sub">Minimo non ancora raggiunto per {category}</div>
          )}
        </div>
      </div>
    </div>
  )
}
