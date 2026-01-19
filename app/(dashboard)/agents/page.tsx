'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Agent {
  id: string;
  name: string;
  description: string;
  api_key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
  pending_approvals_count: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAgents(agents.filter(agent => agent.id !== id));
      } else {
        alert('Failed to delete agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Agents</h1>
        </div>
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Agents</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            Manage your AI agents and their API keys
          </p>
        </div>
        <Link href="/agents/new">
          <Button>Create Agent</Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No agents yet
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Create your first AI agent to get started
            </p>
            <Link href="/agents/new">
              <Button>Create Agent</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle>
                        <Link
                          href={`/agents/${agent.id}`}
                          className="hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {agent.name}
                        </Link>
                      </CardTitle>
                      <Badge variant={agent.is_active ? 'success' : 'default'}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {agent.pending_approvals_count > 0 && (
                        <Badge variant="warning">
                          {agent.pending_approvals_count} pending
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {agent.description || 'No description'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/agents/${agent.id}`}>
                      <Button variant="secondary" size="sm">View</Button>
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(agent.id, agent.name)}
                      disabled={deleting === agent.id}
                    >
                      {deleting === agent.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 mb-1">API Key</div>
                    <div className="font-mono text-zinc-900 dark:text-zinc-100">
                      {agent.api_key_prefix}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 mb-1">Created</div>
                    <div className="text-zinc-900 dark:text-zinc-100">
                      {formatDate(agent.created_at)}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400 mb-1">Last Seen</div>
                    <div className="text-zinc-900 dark:text-zinc-100">
                      {agent.last_seen_at ? formatDate(agent.last_seen_at) : 'Never'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
