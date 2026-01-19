'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();

      if (response.ok) {
        setApiKey(data.api_key);
      } else {
        alert(data.error || 'Failed to create agent');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Failed to create agent');
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDone = () => {
    router.push('/agents');
  };

  if (apiKey) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Agent Created Successfully!
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            Save your API key - it won't be shown again
          </p>
        </div>

        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-200">
              Your API Key
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              This is your secret API key. Store it securely and never share it publicly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiKey}
                readOnly
                className="flex-1 px-4 py-3 border border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-zinc-900 font-mono text-sm"
              />
              <Button onClick={handleCopy} variant="secondary">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to use your API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Authentication
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Include your API key in the Authorization header:
              </p>
              <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -H "Authorization: Bearer ${apiKey}" \\
     https://your-app.com/api/endpoint`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Example: Request Gmail Access
              </h4>
              <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST https://your-app.com/api/oauth/initiate \\
     -H "Authorization: Bearer ${apiKey.substring(0, 20)}..." \\
     -H "Content-Type: application/json" \\
     -d '{
       "service_provider_id": "gmail",
       "scopes": ["gmail.send", "gmail.readonly"]
     }'`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Create New Agent
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          Set up a new AI agent with its own API key
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Agent Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="e.g., EmailBot, CalendarAssistant"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="What does this agent do?"
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Agent'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
