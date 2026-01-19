'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchParams = useSearchParams();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const redirect = searchParams.get('redirect');
      const redirectUrl = redirect
        ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
        : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({
          type: 'success',
          text: 'Check your email for the magic link!',
        });
        setEmail('');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Auth for Agents
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to manage your AI agents
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors duration-200"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
            We'll send you a magic link to sign in without a password
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
