'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  priority: number;
  conditions: any;
  require_approval: boolean;
  created_at: string;
}

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/approval-rules');
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();
      setRules(data.rules);
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/approval-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to update rule');
      await fetchRules();
    } catch (error) {
      console.error('Error updating rule:', error);
      alert('Failed to update rule');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/approval-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete rule');
      await fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Approval Rules</h1>
            <p className="text-gray-600">
              Create rules to control when agent actions require human approval
            </p>
          </div>
          <Button onClick={() => router.push('/rules/new')}>Create Rule</Button>
        </div>
      </div>

      {rules.length === 0 ? (
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No rules yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first approval rule to control when agent actions require your approval.
          </p>
          <Button onClick={() => router.push('/rules/new')}>Create First Rule</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{rule.name}</h3>
                    {rule.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                    <Badge variant="default">Priority: {rule.priority}</Badge>
                  </div>

                  {rule.description && (
                    <p className="text-gray-600 mb-4">{rule.description}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    {rule.conditions.action_types && (
                      <div>
                        <span className="font-medium text-gray-700">Action Types: </span>
                        <span className="text-gray-600">
                          {rule.conditions.action_types.join(', ')}
                        </span>
                      </div>
                    )}

                    {rule.conditions.payload_patterns &&
                      rule.conditions.payload_patterns.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Conditions: </span>
                          {rule.conditions.payload_patterns.map((pattern: any, idx: number) => (
                            <div key={idx} className="text-gray-600 ml-4">
                              {pattern.field} {pattern.operator} "{pattern.value}"
                            </div>
                          ))}
                        </div>
                      )}

                    <div>
                      <span className="font-medium text-gray-700">Action: </span>
                      <span className="text-gray-600">
                        {rule.require_approval ? 'Require Approval' : 'Allow'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    Created: {new Date(rule.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => toggleActive(rule.id, rule.is_active)}
                    variant="secondary"
                  >
                    {rule.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button onClick={() => deleteRule(rule.id)} variant="secondary">
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
