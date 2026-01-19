'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface PayloadPattern {
  field: string;
  operator: string;
  value: string;
  case_sensitive: boolean;
}

export default function NewRulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    priority: 10,
    action_types: ['gmail.send'],
    require_approval: true,
  });

  const [patterns, setPatterns] = useState<PayloadPattern[]>([
    { field: 'to', operator: 'contains', value: '', case_sensitive: false },
  ]);

  const addPattern = () => {
    setPatterns([
      ...patterns,
      { field: 'to', operator: 'contains', value: '', case_sensitive: false },
    ]);
  };

  const removePattern = (index: number) => {
    setPatterns(patterns.filter((_, i) => i !== index));
  };

  const updatePattern = (index: number, updates: Partial<PayloadPattern>) => {
    const newPatterns = [...patterns];
    newPatterns[index] = { ...newPatterns[index], ...updates };
    setPatterns(newPatterns);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty patterns
      const validPatterns = patterns.filter((p) => p.value.trim() !== '');

      const ruleData = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        priority: formData.priority,
        conditions: {
          action_types: formData.action_types,
          payload_patterns: validPatterns,
        },
        require_approval: formData.require_approval,
      };

      const response = await fetch('/api/approval-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rule');
      }

      router.push('/rules');
    } catch (error) {
      console.error('Error creating rule:', error);
      alert(error instanceof Error ? error.message : 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Approval Rule</h1>
        <p className="text-gray-600">
          Define when agent actions should require human approval
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., External Email Approval"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe when this rule applies"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  max="1000"
                />
                <p className="text-xs text-gray-500 mt-1">Higher priority rules are checked first</p>
              </div>

              <div>
                <label className="flex items-center space-x-2 mt-7">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Conditions</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Types
              </label>
              <select
                value={formData.action_types[0]}
                onChange={(e) => setFormData({ ...formData, action_types: [e.target.value] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="gmail.send">Gmail: Send Email</option>
                <option value="gmail.modify">Gmail: Modify Email</option>
                <option value="gmail.read">Gmail: Read Emails</option>
                <option value="document.query">Document: Query</option>
                <option value="document.download">Document: Download</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payload Patterns
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Define conditions on the action payload (e.g., email recipient, subject)
              </p>

              {patterns.map((pattern, index) => (
                <div key={index} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={pattern.field}
                    onChange={(e) => updatePattern(index, { field: e.target.value })}
                    placeholder="Field (e.g., 'to', 'subject')"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />

                  <select
                    value={pattern.operator}
                    onChange={(e) => updatePattern(index, { operator: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="starts_with">starts with</option>
                    <option value="ends_with">ends with</option>
                    <option value="matches">matches (regex)</option>
                    <option value="not_equals">not equals</option>
                  </select>

                  <input
                    type="text"
                    value={pattern.value}
                    onChange={(e) => updatePattern(index, { value: e.target.value })}
                    placeholder="Value (e.g., '@external.com')"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />

                  {patterns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePattern(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <Button type="button" onClick={addPattern} variant="secondary">
                Add Pattern
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Action</h2>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.require_approval}
                onChange={(e) =>
                  setFormData({ ...formData, require_approval: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Require Approval</span>
            </label>
            <p className="text-sm text-gray-500 mt-1 ml-6">
              If checked, matching actions will require human approval before executing
            </p>
          </div>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Rule'}
          </Button>
          <Button type="button" onClick={() => router.push('/rules')} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
