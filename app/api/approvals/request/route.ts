import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { evaluateRules } from '@/lib/approval/rule-engine';
import { createApproval } from '@/lib/approval/approval-manager';
import { z } from 'zod';

const requestApprovalSchema = z.object({
  action_type: z.string(),
  action_payload: z.any(),
  service_connection_id: z.string().optional(),
  service_provider_id: z.string().optional(),
});

/**
 * POST /api/approvals/request
 * Agent requests approval for an action
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent
    const authResult = await requireAgentAuth(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    // Parse and validate request
    const body = await request.json();
    const validatedData = requestApprovalSchema.parse(body);

    // Evaluate rules to see if approval is needed
    const { requiresApproval, matchedRule } = await evaluateRules(agent.owner_id, {
      agent_id: agent.id,
      action_type: validatedData.action_type,
      action_payload: validatedData.action_payload,
      service_connection_id: validatedData.service_connection_id,
      service_provider_id: validatedData.service_provider_id,
    });

    if (!requiresApproval) {
      // No approval needed - action can proceed immediately
      return NextResponse.json({
        requires_approval: false,
        message: 'No approval required for this action',
        matched_rule: matchedRule ? {
          id: matchedRule.id,
          name: matchedRule.name,
        } : null,
      });
    }

    // Create pending approval
    const approval = await createApproval({
      agent_id: agent.id,
      owner_id: agent.owner_id,
      rule_id: matchedRule?.id,
      service_connection_id: validatedData.service_connection_id,
      action_type: validatedData.action_type,
      action_payload: validatedData.action_payload,
      expires_in_hours: matchedRule?.auto_approve_after_hours || 24,
    });

    return NextResponse.json({
      requires_approval: true,
      approval_id: approval.id,
      status: approval.status,
      priority: approval.priority,
      action_summary: approval.action_summary,
      expires_at: approval.expires_at,
      matched_rule: matchedRule ? {
        id: matchedRule.id,
        name: matchedRule.name,
      } : null,
      message: 'Approval request created. Poll the status endpoint to check for resolution.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error in POST /api/approvals/request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
