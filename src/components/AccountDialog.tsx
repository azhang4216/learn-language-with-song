import { useState, type FormEvent } from 'react'
import type { AuthUser } from '../types/auth'
import { BookIcon, CloseIcon, UserIcon } from './Icons'

interface AccountDialogProps {
  user: AuthUser | null
  learningWordCount: number
  learnedSongCount: number
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
  onSignOut: () => Promise<void>
  onClose: () => void
}

export function AccountDialog({
  user,
  learningWordCount,
  learnedSongCount,
  onLogin,
  onRegister,
  onSignOut,
  onClose,
}: AccountDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await onLogin(username, password)
      else await onRegister(username, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    setError('')
    try {
      await onSignOut()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-out failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setError('')
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="section-eyebrow">Your Verse account</span>
            <h2 id="account-title">{user ? 'Learning sync' : mode === 'login' ? 'Sign in to keep learning' : 'Create your account'}</h2>
            <p>{user
              ? 'Your songs, likes, vocabulary, and progress are saved across devices.'
              : 'A username and password save your publishing, likes, vocabulary, and learned songs.'}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close account"><CloseIcon /></button>
        </header>

        {user ? (
          <div className="account-content">
            <div className="account-profile">
              <span className="account-avatar-fallback"><UserIcon /></span>
              <span><strong>{user.displayName}</strong><small>@{user.username}</small></span>
            </div>
            <div className="account-stats">
              <div><BookIcon /><strong>{learningWordCount}</strong><span>learning words</span></div>
              <div><span className="account-stat-glyph">✓</span><strong>{learnedSongCount}</strong><span>learned songs</span></div>
            </div>
            <button className="account-signout-button" disabled={busy} onClick={() => void handleSignOut()}>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : (
          <div className="account-content account-signin-content">
            <span className="account-lockup"><UserIcon /></span>
            <strong>{mode === 'login' ? 'Welcome back' : 'Start your learning library'}</strong>
            <p>{mode === 'login'
              ? 'Sign in with the username and password you created here.'
              : 'Anyone with an account can publish a synchronized song immediately.'}</p>
            <form className="account-form" onSubmit={(event) => void submit(event)}>
              <label>
                <span>Username</span>
                <input
                  autoFocus
                  autoComplete="username"
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]+"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {error && <p className="account-error" role="alert">{error}</p>}
              <button className="primary-button account-submit" disabled={busy} type="submit">
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button
              className="account-mode-button"
              onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
            </button>
            <small>No email, verification, or password reset in this MVP.</small>
          </div>
        )}
      </section>
    </div>
  )
}
