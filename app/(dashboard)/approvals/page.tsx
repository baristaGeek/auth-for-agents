'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Approval {
  id: string;
  agent: {
    id: string;
    name: string;
    description: string;
  } | null;
  rule: {
    id: string;
    name: string;
  } | null;
  action_type: string;
  action_payload: any;
  action_summary: string;
  status: string;
  priority: string;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  resolution_comment: string | null;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  useEffect(() => {
    fetchApprovals();
    // Poll for updates every 5 seconds when viewing pending
    const interval = filter === 'pending' ? setInterval(fetchApprovals, 5000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [filter]);

  const fetchApprovals = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter);
      }

      const response = await fetch(`/api/approvals?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch approvals');
      const data = await response.json();
      setApprovals(data.approvals);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: string, comment?: string) => {
    setProcessingId(approvalId);
    try {
      const response = await fetch(`/api/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      await fetchApprovals();
      setSelectedApproval(null);
    } catch (error) {
      console.error('Error approving:', error);
      alert('Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (approvalId: string, reason?: string) => {
    setProcessingId(approvalId);
    try {
      const response = await fetch(`/api/approvals/${approvalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      await fetchApprovals();
      setSelectedApproval(null);
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="error">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="success">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      case 'expired':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Approval Queue</h1>
            <p className="text-gray-600">
              Review and approve agent actions requiring human authorization
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg font-semibold">
              {pendingCount} Pending
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setFilter('pending')}
            variant={filter === 'pending' ? 'primary' : 'secondary'}
          >
            Pending
          </Button>
          <Button
            onClick={() => setFilter('approved')}
            variant={filter === 'approved' ? 'primary' : 'secondary'}
          >
            Approved
          </Button>
          <Button
            onClick={() => setFilter('rejected')}
            variant={filter === 'rejected' ? 'primary' : 'secondary'}
          >
            Rejected
          </Button>
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'primary' : 'secondary'}
          >
            All
          </Button>
        </div>
      </div>

      {approvals.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No approvals found</h3>
          <p className="text-gray-600">
            {filter === 'pending'
              ? 'All caught up! No actions are waiting for your approval.'
              : `No ${filter} approvals to display.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <Card key={approval.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {approval.agent?.name || 'Unknown Agent'}
                    </h3>
                    {getPriorityBadge(approval.priority)}
                    {getStatusBadge(approval.status)}
                  </div>

                  <p className="text-gray-700 text-lg mb-3">{approval.action_summary}</p>

                  {approval.rule && (
                    <p className="text-sm text-gray-500 mb-2">
                      Matched Rule: <span className="font-medium">{approval.rule.name}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Created: {new Date(approval.created_at).toLocaleString()}</span>
                    {approval.status === 'pending' && approval.expires_at && (
                      <span className="text-orange-600 font-medium">
                        {getTimeRemaining(approval.expires_at)}
                      </span>
                    )}
                  </div>

                  {approval.resolved_at && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span>Resolved: {new Date(approval.resolved_at).toLocaleString()}</span>
                      {approval.resolution_comment && (
                        <p className="mt-1 text-gray-700">
                          Comment: {approval.resolution_comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {approval.status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => setSelectedApproval(approval)}
                      variant="primary"
                      disabled={processingId === approval.id}
                    >
                      Review
                    </Button>
                    <Button
                      onClick={() => {
                        if (confirm('Quick approve without comment?')) {
                          handleApprove(approval.id);
                        }
                      }}
                      variant="primary"
                      disabled={processingId === approval.id}
                    >
                      {processingId === approval.id ? 'Processing...' : 'Quick Approve'}
                    </Button>
                    <Button
                      onClick={() => {
                        const reason = prompt('Reason for rejection (optional):');
                        if (reason !== null) {
                          handleReject(approval.id, reason);
                        }
                      }}
                      variant="secondary"
                      disabled={processingId === approval.id}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>

              {selectedApproval?.id === approval.id && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-semibold mb-2">Action Details</h4>
                  <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
                    {JSON.stringify(approval.action_payload, null, 2)}
                  </pre>

                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add comment (optional)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded"
                      id={`comment-${approval.id}`}
                    />
                    <Button
                      onClick={() => {
                        const input = document.getElementById(
                          `comment-${approval.id}`
                        ) as HTMLInputElement;
                        handleApprove(approval.id, input.value);
                      }}
                      variant="primary"
                    >
                      Approve with Comment
                    </Button>
                    <Button onClick={() => setSelectedApproval(null)} variant="secondary">
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
