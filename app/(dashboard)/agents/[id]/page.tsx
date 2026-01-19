'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface AgentDetail {
  agent: {
    id: string;
    name: string;
    description: string;
    api_key_prefix: string;
    is_active: boolean;
    created_at: string;
    last_seen_at: string | null;
  };
  recent_activity: any[];
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetchAgentDetails();
  }, [id]);

  const fetchAgentDetails = async () => {
    try {
      const response = await fetch(`/api/agents/${id}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching agent details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm('This will invalidate the old API key. Are you sure?')) {
      return;
    }

    setRegenerating(true);
    try {
      const response = await fetch(`/api/agents/${id}/regenerate-key`, {
        method: 'POST',
      });
      const result = await response.json();
      if (response.ok) {
        setNewApiKey(result.api_key);
      } else {
        alert('Failed to regenerate key');
      }
    } catch (error) {
      console.error('Error regenerating key:', error);
      alert('Failed to regenerate key');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleActive = async () => {
    if (!data) return;

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !data.agent.is_active }),
      });

      if (response.ok) {
        fetchAgentDetails();
      }
    } catch (error) {
      console.error('Error toggling agent status:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Agent not found</div>;
  }

  const { agent, recent_activity } = data;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {agent.name}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            {agent.description || 'No description'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleToggleActive}>
            {agent.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Badge variant={agent.is_active ? 'success' : 'default'}>
            {agent.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* API Key Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>Use this key to authenticate API requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newApiKey ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                New API Key Generated
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newApiKey}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-green-300 dark:border-green-700 rounded font-mono text-sm"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newApiKey);
                    alert('Copied to clipboard!');
                  }}
                >
                  Copy
                </Button>
              </div>
              <div className="text-xs text-green-700 dark:text-green-300 mt-2">
                Save this key securely - it won't be shown again
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {agent.api_key_prefix}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleRegenerateKey}
                  disabled={regenerating}
                >
                  {regenerating ? 'Regenerating...' : 'Regenerate Key'}
                </Button>
              </div>
              <div className="text-xs text-zinc-500">
                For security reasons, the full key is only shown once during creation
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Activity</CardTitle>
          <CardDescription>Last 20 API calls from this agent</CardDescription>
        </CardHeader>
        <CardContent>
          {recent_activity.length > 0 ? (
            <div className="space-y-2 text-sm">
              {recent_activity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={activity.status_code < 400 ? 'success' : 'danger'}>
                      {activity.status_code}
                    </Badge>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {activity.method} {activity.endpoint}
                    </span>
                  </div>
                  <span className="text-zinc-500">
                    {new Date(activity.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-500">
              No API activity yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
