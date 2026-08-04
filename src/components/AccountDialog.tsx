import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../types/auth'
import { BookIcon, CloseIcon, UserIcon } from './Icons'

interface AccountDialogProps {
  user: AuthUser | null
  learningWordCount: number
  learnedSongCount: number
  onCredential: (credential: string) => Promise<void>
  onSignOut: () => Promise<void>
  onClose: () => void
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''

export function AccountDialog({
  user,
  learningWordCount,
  learnedSongCount,
  onCredential,
  onSignOut,
  onClose,
}: AccountDialogProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user || !googleClientId) return
    let active = true
    const render = () => {
      if (!active || !buttonRef.current || !window.google) return
      buttonRef.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          setBusy(true)
          setError('')
          void onCredential(credential)
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.')
            })
            .finally(() => setBusy(false))
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 280,
      })
    }

    if (window.google) {
      render()
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-verse-google-signin]')
      const script = existing ?? document.createElement('script')
      script.addEventListener('load', render)
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.dataset.verseGoogleSignin = 'true'
        document.head.append(script)
      }
      return () => {
        active = false
        script.removeEventListener('load', render)
      }
    }
    return () => { active = false }
  }, [onCredential, user])

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
            <h2 id="account-title">{user ? 'Learning sync' : 'Sign in to keep learning'}</h2>
            <p>{user
              ? 'Your songs, likes, vocabulary, and progress are saved across devices.'
              : 'Google sign-in saves publishing, likes, vocabulary, and learned songs.'}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close account"><CloseIcon /></button>
        </header>

        {user ? (
          <div className="account-content">
            <div className="account-profile">
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
                : <span className="account-avatar-fallback"><UserIcon /></span>}
              <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
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
            <strong>One account, every device</strong>
            <p>Anyone who signs in can publish a synchronized song immediately.</p>
            {googleClientId
              ? <div className={busy ? 'google-button is-busy' : 'google-button'} ref={buttonRef} />
              : <p className="account-config-warning">Google sign-in needs the VITE_GOOGLE_CLIENT_ID deployment variable.</p>}
            {error && <p className="account-error" role="alert">{error}</p>}
            <small>Email and password sign-in is planned for P1.</small>
          </div>
        )}
      </section>
    </div>
  )
}
