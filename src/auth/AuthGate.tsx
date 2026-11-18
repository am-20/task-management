import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { startSync, stopSync } from '../sync/engine'

type Phase = 'loading' | 'signedOut' | 'recovery' | 'syncing' | 'ready'

/** Shows the sign-in screen until there is a session, then starts syncing and renders the app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(supabase ? 'loading' : 'ready')

  useEffect(() => {
    if (!supabase) return
    const begin = (session: Session) => {
      // Offline, or on a slow connection, the copy saved on this device opens right away.
      const offline = !navigator.onLine
      setPhase((p) => (p === 'ready' || p === 'recovery' ? p : offline ? 'ready' : 'syncing'))
      const fallback = window.setTimeout(() => setPhase((p) => (p === 'syncing' ? 'ready' : p)), 2500)
      void startSync(session.user.id).finally(() => {
        window.clearTimeout(fallback)
        setPhase((p) => (p === 'syncing' ? 'ready' : p))
      })
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer work out of the auth callback, as Supabase recommends.
      window.setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') {
          setPhase('recovery')
          return
        }
        if (event === 'SIGNED_OUT' || !session) {
          stopSync()
          setPhase('signedOut')
          return
        }
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') begin(session)
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (phase === 'ready') return <>{children}</>
  if (phase === 'signedOut') return <SignIn />
  if (phase === 'recovery') return <NewPassword onDone={() => setPhase('ready')} />
  return <Splash />
}

function Brand() {
  return (
    <div className="auth-brand">
      <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path
          d="M16 6 C17.5 9.5 22 11.5 22 17 A6 6 0 0 1 10 17 C10 14.8 10.9 13.2 12.1 12 C12.4 13.6 13.2 14.6 14.2 15.1 C13.7 11.7 14.4 8.7 16 6 Z"
          fill="#f6e7d6"
        />
      </svg>
      <span>Hearth</span>
    </div>
  )
}

function Splash() {
  return (
    <div className="auth-screen" aria-busy="true">
      <div className="auth-splash">
        <Brand />
        <div className="auth-spinner" />
      </div>
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) {
      setError(
        /invalid login/i.test(err.message)
          ? 'That email and password do not match.'
          : /fetch|network/i.test(err.message)
            ? 'No connection. Check your internet and try again.'
            : err.message,
      )
    }
  }

  const forgot = async () => {
    if (!supabase) return
    if (!email.trim()) {
      setError('Type your email first, then tap “Forgot password?” again.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    })
    setBusy(false)
    if (err) setError(err.message)
    else setNotice('If that address has an account, a reset link is on its way.')
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <p className="auth-lede">A calm home for every part of your life.</p>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="auth-notice">{notice}</p>}
        <button type="submit" className="btn primary auth-submit" disabled={busy}>
          {busy ? 'One moment…' : 'Sign in'}
        </button>
        <button type="button" className="auth-link" onClick={forgot} disabled={busy}>
          Forgot password?
        </button>
      </form>
    </div>
  )
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    setBusy(true)
    const { data, error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    window.location.hash = '/today'
    if (data.user) await startSync(data.user.id)
    onDone()
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <p className="auth-lede">Choose a new password.</p>
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  )
}
