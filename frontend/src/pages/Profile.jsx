import { useAuth } from '../context/AuthContext'
import './Profile.css'

export default function Profile() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <section className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.picture ? <img src={user.picture} alt={user.name} /> : (user.name?.[0] ?? 'U')}
          </div>
          <div className="profile-heading">
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
        </div>

        <div className="profile-meta">
          <div className="profile-meta-row">
            <span className="profile-meta-label">Provider</span>
            <span className="profile-meta-value">{user.provider}</span>
          </div>
          <div className="profile-meta-row">
            <span className="profile-meta-label">User ID</span>
            <span className="profile-meta-value">{user.sub}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
