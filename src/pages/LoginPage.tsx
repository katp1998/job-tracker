import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
          <p className="mt-2 text-sm text-gray-500">
            Track applications, monitor email updates, and never miss a follow-up.
          </p>
        </div>
        <GoogleLoginButton />
        <p className="mt-6 text-center text-xs text-gray-400">
          Signing in grants read-only access to your Gmail so we can detect interview invites,
          offers, and rejections automatically.
        </p>
      </div>
    </div>
  )
}
