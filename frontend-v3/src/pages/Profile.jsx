import { useAuth } from '../context/AuthContext'
import './Profile.css'

export default function Profile() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <section className="profile-page">
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.picture
              ? <img src={user.picture} alt={user.name} />
              : <span>{user.name?.[0] ?? 'U'}</span>
            }
          </div>
          <div className="profile-heading">
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
        </div>
      </div>

      <div className="profile-meta-card card">
        <div className="profile-meta-row">
          <span className="profile-meta-label">Provider</span>
          <span className="chevron" style={{ marginLeft: 'auto', marginRight: '0.5rem', order: 3 }}>❯</span>
          <span className="profile-meta-value">{user.provider}</span>
        </div>
        <div className="profile-meta-row">
          <span className="profile-meta-label">User ID</span>
          <span className="chevron" style={{ marginLeft: 'auto', marginRight: '0.5rem', order: 3 }}>❯</span>
          <span className="profile-meta-value profile-meta-value--mono">{user.sub}</span>
        </div>
      </div>
    </section>
  )
}
