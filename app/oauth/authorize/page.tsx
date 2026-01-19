'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ConnectionRequest {
  id: string;
  agent_name: string;
  service_provider_name: string;
  service_provider_id: string;
  scopes: string[];
  expires_at: string;
  state: string;
}

function AuthorizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get('request_id');

  const [request, setRequest] = useState<ConnectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError('Missing request ID');
      setLoading(false);
      return;
    }

    // Fetch connection request details
    fetch(`/api/oauth/request/${requestId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load request');
        return res.json();
      })
      .then((data) => {
        setRequest(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [requestId]);

  const handleAuthorize = () => {
    if (!request) return;

    setRedirecting(true);

    // Build Gmail OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`,
      response_type: 'code',
      scope: request.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: request.state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = authUrl;
  };

  const handleDeny = async () => {
    if (!requestId) return;

    try {
      await fetch(`/api/oauth/request/${requestId}`, {
        method: 'DELETE',
      });
      router.push('/dashboard?oauth_denied=true');
    } catch (err) {
      setError('Failed to deny request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authorization request...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error || 'Request not found'}</p>
          <Button onClick={() => router.push('/dashboard')} variant="secondary">
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const scopeDescriptions: Record<string, string> = {
    'https://www.googleapis.com/auth/gmail.send': 'Send emails on your behalf',
    'https://www.googleapis.com/auth/gmail.readonly': 'Read your emails',
    'https://www.googleapis.com/auth/gmail.modify': 'Modify your emails (archive, label, etc.)',
    'https://www.googleapis.com/auth/userinfo.email': 'Access your email address',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Authorization Request</h1>
          <p className="text-gray-600">
            An AI agent is requesting access to your account
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Agent</label>
              <p className="text-lg font-semibold text-gray-900">{request.agent_name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Service</label>
              <p className="text-lg font-semibold text-gray-900">
                {request.service_provider_name}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Requested Permissions</label>
              <ul className="mt-2 space-y-2">
                {request.scopes.map((scope) => (
                  <li key={scope} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700">
                      {scopeDescriptions[scope] || scope}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Expires</label>
              <p className="text-gray-700">
                {new Date(request.expires_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg
              className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Important</h3>
              <p className="text-sm text-yellow-700">
                By authorizing, you allow this agent to perform actions on your behalf using{' '}
                {request.service_provider_name}. You can revoke access at any time from your
                dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleAuthorize}
            disabled={redirecting}
            className="flex-1"
          >
            {redirecting ? 'Redirecting...' : 'Authorize Access'}
          </Button>
          <Button
            onClick={handleDeny}
            variant="secondary"
            disabled={redirecting}
            className="flex-1"
          >
            Deny
          </Button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          You'll be redirected to {request.service_provider_name} to complete the authorization
        </p>
      </Card>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthorizeContent />
    </Suspense>
  );
}
