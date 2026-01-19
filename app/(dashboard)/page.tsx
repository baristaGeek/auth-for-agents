'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type Tab = 'approvals' | 'agents';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('approvals');
  const [approvals, setApprovals] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [approvalsRes, agentsRes] = await Promise.all([
        fetch('/api/approvals?status=pending'),
        fetch('/api/agents'),
      ]);

      const [approvalsData, agentsData] = await Promise.all([
        approvalsRes.json(),
        agentsRes.json(),
      ]);

      setApprovals(approvalsData.approvals || []);
      setAgents(agentsData.agents || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    try {
      await fetch(`/api/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      fetchData();
    } catch (error) {
      console.error('Error approving:', error);
    }
  };

  const handleReject = async (approvalId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    try {
      await fetch(`/api/approvals/${approvalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      fetchData();
    } catch (error) {
      console.error('Error rejecting:', error);
    }
  };


  const pendingCount = approvals.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Auth for Agents</h1>
        <p className="text-gray-600">
          OAuth + Approvals for AI Agents
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-3xl font-bold text-red-600">{pendingCount}</div>
          <div className="text-sm text-gray-600">Pending Approvals</div>
        </Card>
        <Card className="p-4">
          <div className="text-3xl font-bold text-blue-600">{agents.length}</div>
          <div className="text-sm text-gray-600">Active Agents</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'approvals'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Approvals {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'agents'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Agents
        </button>
      </div>

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {approvals.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No pending approvals</p>
              <p className="text-sm text-gray-500 mt-2">
                Run the sample app to create an approval
              </p>
            </Card>
          ) : (
            approvals.map((approval) => (
              <Card key={approval.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {approval.agent?.name || 'Unknown Agent'}
                      </h3>
                      <Badge variant="error">Action Required</Badge>
                    </div>
                    <p className="text-gray-700 mb-3 text-lg">{approval.action_summary}</p>
                    <details className="mb-3">
                      <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                        View Details
                      </summary>
                      <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto mt-2">
                        {JSON.stringify(approval.action_payload, null, 2)}
                      </pre>
                    </details>
                    <p className="text-sm text-gray-500">
                      {new Date(approval.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button onClick={() => handleApprove(approval.id)}>
                      ✓ Approve
                    </Button>
                    <Button onClick={() => handleReject(approval.id)} variant="secondary">
                      ✗ Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Agents</h2>
            <Button onClick={() => (window.location.href = '/agents/new')}>
              + New Agent
            </Button>
          </div>
          <div className="space-y-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{agent.name}</h3>
                    {agent.description && (
                      <p className="text-gray-600 mb-2">{agent.description}</p>
                    )}
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {agent.api_key_prefix}
                    </code>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
