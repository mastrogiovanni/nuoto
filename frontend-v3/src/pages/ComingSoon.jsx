import './ComingSoon.css'

const features = [
  {
    icon: '📊',
    tag: 'Personalizzazione',
    title: 'Indicatori di performance su misura',
    description: 'Scegli quali metriche contano per il tuo allenamento: efficienza di vasca, progressione stagionale, andamento per stile.',
    badge: 'Prossimamente',
    highlight: true,
  },
  {
    icon: '🥇',
    tag: 'Ispirazione',
    title: 'Confrontati con i campioni',
    description: 'Scopri a quanti secondi sei dai record italiani e mondiali nella tua categoria.',
    badge: 'In arrivo',
    highlight: false,
  },
  {
    icon: '📸',
    tag: 'Profilo',
    title: 'Il tuo profilo con la tua foto',
    description: 'Carica la tua foto e personalizza il profilo con i tuoi colori societari.',
    badge: 'In arrivo',
    highlight: false,
  },
  {
    icon: '🔔',
    tag: 'Notifiche',
    title: 'Avvisi sui tuoi progressi',
    description: 'Ricevi una notifica ogni volta che stabilisci un nuovo record personale.',
    badge: 'Presto',
    highlight: false,
  },
  {
    icon: '📈',
    tag: 'Analisi',
    title: 'Grafici di progressione avanzati',
    description: 'Visualizza l\'andamento dei tuoi tempi con grafici interattivi e confronti stagionali.',
    badge: 'Presto',
    highlight: false,
  },
]

const BADGE_COLOR = {
  'Prossimamente': { bg: '#e8f0fb', color: '#0066cc' },
  'In arrivo':     { bg: '#f0e8fb', color: '#7c3aed' },
  'Presto':        { bg: '#fff8e1', color: '#b8860b' },
}

export default function ComingSoon() {
  return (
    <div className="coming-soon">
      <div className="cs-hero card">
        <div className="cs-hero-icon">🚀</div>
        <h1 className="cs-hero-title">Cosa sta arrivando</h1>
        <p className="cs-hero-subtitle">
          Funzionalità potenti per portare la tua esperienza al livello successivo.
        </p>
      </div>

      <div className="cs-cards">
        {features.map((f) => {
          const badgeStyle = BADGE_COLOR[f.badge] ?? {}
          return (
            <div key={f.title} className={`cs-card card${f.highlight ? ' cs-card--highlight' : ''}`}>
              <div className="cs-card-top">
                <div className="cs-icon-wrap">{f.icon}</div>
                <span
                  className="cs-badge badge-pill"
                  style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                >
                  {f.badge}
                </span>
              </div>
              <div className="cs-tag">{f.tag}</div>
              <h2 className="cs-card-title">{f.title}</h2>
              <p className="cs-card-desc">{f.description}</p>
              <button className="cs-notify-btn" disabled>
                🔔 Avvisami quando è pronto
              </button>
            </div>
          )
        })}
      </div>

      <p className="cs-footer">Hai un'idea? Scrivici e la valuteremo.</p>
    </div>
  )
}
