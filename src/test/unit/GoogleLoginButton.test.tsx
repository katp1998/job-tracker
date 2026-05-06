import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { supabase } from '@/lib/supabase'

describe('GoogleLoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the sign-in button', () => {
    render(<GoogleLoginButton />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
  })

  it('calls signInWithOAuth with google provider and gmail scope on click', async () => {
    render(<GoogleLoginButton />)
    fireEvent.click(screen.getByText('Continue with Google'))

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          options: expect.objectContaining({
            scopes: expect.stringContaining('gmail.readonly'),
          }),
        }),
      )
    })
  })

  it('shows an error message when OAuth fails', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: { provider: 'google', url: null },
      error: { message: 'OAuth error' } as never,
    })

    render(<GoogleLoginButton />)
    fireEvent.click(screen.getByText('Continue with Google'))

    await waitFor(() => {
      expect(screen.getByText('OAuth error')).toBeInTheDocument()
    })
  })

  it('disables the button while loading', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockImplementationOnce(
      () => new Promise(() => {}), // never resolves
    )

    render(<GoogleLoginButton />)
    fireEvent.click(screen.getByText('Continue with Google'))

    await waitFor(() => {
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })
})
