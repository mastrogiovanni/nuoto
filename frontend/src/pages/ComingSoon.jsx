import './ComingSoon.css'

const features = [
  {
    icon: '📊',
    tag: 'Personalizzazione',
    title: 'Indicatori di performance su misura per te',
    description:
      'Scegli quali metriche contano davvero per il tuo allenamento: efficienza di vasca, progressione stagionale, andamento per stile. Il tuo cruscotto, le tue regole.',
    badge: 'Prossimamente',
    highlight: true,
  },
  {
    icon: '🥇',
    tag: 'Ispirazione',
    title: 'Confrontati con i campioni',
    description:
      'Scopri a quanti secondi sei dai record italiani e mondiali nella tua categoria. Vedi chi sono i nuotatori più vicini al tuo livello e scala la classifica.',
    badge: 'In arrivo',
    highlight: false,
  },
  {
    icon: '📸',
    tag: 'Profilo',
    title: 'Il tuo profilo con la tua foto',
    description:
      'Carica la tua foto e personalizza il profilo con i tuoi colori societari. Rendi il tuo spazio davvero tuo.',
    badge: 'In arrivo',
    highlight: false,
  },
  {
    icon: '🔔',
    tag: 'Notifiche',
    title: 'Avvisi sui tuoi progressi',
    description:
      'Ricevi una notifica ogni volta che stabilisci un nuovo record personale o quando un tuo rivale migliora il proprio tempo.',
    badge: 'Presto',
    highlight: false,
  },
  {
    icon: '📈',
    tag: 'Analisi',
    title: 'Grafici di progressione avanzati',
    description:
      'Visualizza l\'andamento dei tuoi tempi nel tempo con grafici interattivi, confronti stagione per stagione e proiezioni di miglioramento.',
    badge: 'Presto',
    highlight: false,
  },
]

export default function ComingSoon() {
  return (
    <div className="coming-soon">
      <div className="cs-hero">
        <div className="cs-hero-icon">🚀</div>
        <h1 className="cs-hero-title">Cosa sta arrivando</h1>
        <p className="cs-hero-subtitle">
          Stiamo costruendo funzionalità potenti per portare la tua esperienza
          al livello successivo. Eccone un'anteprima.
        </p>
      </div>

      <div className="cs-cards">
        {features.map((f) => (
          <div key={f.title} className={`cs-card${f.highlight ? ' cs-card--highlight' : ''}`}>
            <div className="cs-card-top">
              <span className="cs-card-icon">{f.icon}</span>
              <span className="cs-badge">{f.badge}</span>
            </div>
            <span className="cs-card-tag">{f.tag}</span>
            <h2 className="cs-card-title">{f.title}</h2>
            <p className="cs-card-desc">{f.description}</p>
            <button className="cs-notify-btn" disabled>
              🔔 Avvisami quando è pronto
            </button>
          </div>
        ))}
      </div>

      <div className="cs-footer">
        <p>Hai un'idea? Scrivici e la valuteremo per le prossime versioni.</p>
      </div>
    </div>
  )
}
