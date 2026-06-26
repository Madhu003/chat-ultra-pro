import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const GeminiStar = () => (
  <svg width="48" height="48" viewBox="0 0 44 44" fill="none">
    <path
      d="M22 3L24.5 19.5L41 22L24.5 24.5L22 41L19.5 24.5L3 22L19.5 19.5Z"
      fill="url(#gemini-login-grad)"
    />
    <defs>
      <linearGradient id="gemini-login-grad" x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285f4" />
        <stop offset="0.5" stopColor="#9b72cb" />
        <stop offset="1" stopColor="#d96570" />
      </linearGradient>
    </defs>
  </svg>
)

export const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const cleanError = (msg: string) =>
    msg.replace('Firebase: ', '').replace(/\s?\(auth\/[^)]+\)\.?/g, '').trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await signInWithEmail(email, password)
      } else {
        if (!name.trim()) { setError('Please enter your name'); setLoading(false); return }
        await signUpWithEmail(email, password, name)
      }
    } catch (err: any) {
      setError(cleanError(err.message || 'Something went wrong'))
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      setError(cleanError(err.message || 'Failed to sign in with Google'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#131314] px-4">
      <div className="w-full max-w-[360px]">
        {/* Logo & heading */}
        <div className="flex flex-col items-center mb-8 text-center">
          <GeminiStar />
          <h1 className="mt-4 text-[26px] font-normal text-[#1f1f1f] dark:text-[#e3e3e3] tracking-tight">
            {tab === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="mt-1.5 text-sm text-[#444746] dark:text-[#8e918f]">
            {tab === 'login' ? 'Sign in to continue to Gemini' : 'Get started with Gemini'}
          </p>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#1e1e1f] hover:bg-[#f8f9fa] dark:hover:bg-[#282a2c] text-[#3c4043] dark:text-[#e3e3e3] text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#e0e0e0] dark:bg-[#3c4043]" />
          <span className="text-xs text-[#80868b] dark:text-[#5f6368] select-none">or</span>
          <div className="flex-1 h-px bg-[#e0e0e0] dark:bg-[#3c4043]" />
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-full bg-[#f1f3f4] dark:bg-[#282a2c] p-[3px] mb-5">
          {(['login', 'signup'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                tab === t
                  ? 'bg-white dark:bg-[#3c4043] text-[#1f1f1f] dark:text-[#e3e3e3] shadow-sm'
                  : 'text-[#444746] dark:text-[#9aa0a6] hover:text-[#1f1f1f] dark:hover:text-[#e3e3e3]'
              }`}
            >
              {t === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-transparent text-sm text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#80868b] dark:placeholder:text-[#5f6368] focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] transition-colors"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-transparent text-sm text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#80868b] dark:placeholder:text-[#5f6368] focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-transparent text-sm text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#80868b] dark:placeholder:text-[#5f6368] focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] transition-colors"
          />

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#1246a0] text-white text-sm font-medium transition-colors disabled:opacity-50 mt-1"
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#80868b] dark:text-[#5f6368] mt-6 leading-relaxed">
          By continuing, you agree to our{' '}
          <span className="text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer hover:underline">Terms of Service</span>
          {' '}and{' '}
          <span className="text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer hover:underline">Privacy Policy</span>
        </p>
      </div>
    </div>
  )
}
