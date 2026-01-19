import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { getApprovalStatus } from '@/lib/approval/approval-manager';

/**
 * GET /api/approvals/:id/status
 * Agent polls to check approval status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate agent
    const authResult = await requireAgentAuth(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    // Get approval status
    const approval = await getApprovalStatus(id);

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    // Verify approval belongs to this agent
    if (approval.agent_id !== agent.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if expired and still pending
    if (approval.status === 'pending' && approval.expires_at) {
      const now = new Date();
      const expiresAt = new Date(approval.expires_at);
      if (now > expiresAt) {
        // Auto-expire (this should also be done by a background job)
        return NextResponse.json({
          status: 'expired',
          message: 'Approval request has expired',
        });
      }
    }

    // Return status
    return NextResponse.json({
      approval_id: approval.id,
      status: approval.status,
      priority: approval.priority,
      action_summary: approval.action_summary,
      created_at: approval.created_at,
      expires_at: approval.expires_at,
      resolved_at: approval.resolved_at,
      resolution_comment: approval.resolution_comment,
      message: getStatusMessage(approval.status),
    });
  } catch (error) {
    console.error('Error in GET /api/approvals/:id/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'pending':
      return 'Approval is pending human review';
    case 'approved':
      return 'Approval granted - proceed with action';
    case 'rejected':
      return 'Approval rejected - do not proceed';
    case 'expired':
      return 'Approval request expired';
    case 'cancelled':
      return 'Approval request was cancelled';
    default:
      return 'Unknown status';
  }
}
