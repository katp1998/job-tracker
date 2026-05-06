import { useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { supabase } from '@/lib/supabase'

export function GoogleLoginButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Request Gmail readonly scope so we can scan emails later
        scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
        redirectTo: `${window.location.origin}/job-tracker/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleLogin}
        disabled={loading}
        className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
      >
        <FcGoogle size={18} />
        {loading ? 'Redirecting...' : 'Continue with Google'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

