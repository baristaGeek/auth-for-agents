import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { getGmailConnection, sendGmailEmail } from '@/lib/services/gmail';
import { evaluateRules } from '@/lib/approval/rule-engine';
import { createApproval, getApprovalStatus } from '@/lib/approval/approval-manager';
import { z } from 'zod';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string(),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
  approval_id: z.string().optional(), // If agent is following up on an approval
});

/**
 * POST /api/services/gmail/send
 * Send email via Gmail with approval checks
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
    const validatedData = sendEmailSchema.parse(body);

    // Get Gmail connection for this agent
    const connection = await getGmailConnection(agent.id);
    if (!connection) {
      return NextResponse.json(
        {
          error: 'No active Gmail connection found',
          message: 'Agent must complete OAuth authorization first',
        },
        { status: 403 }
      );
    }

    // If agent provided an approval_id, check if it's approved
    let emailData = {
      to: validatedData.to,
      subject: validatedData.subject,
      body: validatedData.body,
      cc: validatedData.cc,
      bcc: validatedData.bcc,
    };

    if (validatedData.approval_id) {
      const approval = await getApprovalStatus(validatedData.approval_id);

      if (!approval) {
        return NextResponse.json(
          { error: 'Approval not found' },
          { status: 404 }
        );
      }

      if (approval.agent_id !== agent.id) {
        return NextResponse.json(
          { error: 'Approval does not belong to this agent' },
          { status: 403 }
        );
      }

      if (approval.status === 'pending') {
        return NextResponse.json({
          requires_approval: true,
          approval_id: approval.id,
          status: 'pending',
          message: 'Approval is still pending',
        });
      }

      if (approval.status === 'rejected') {
        return NextResponse.json(
          {
            error: 'Approval was rejected',
            reason: approval.resolution_comment,
          },
          { status: 403 }
        );
      }

      if (approval.status === 'expired') {
        return NextResponse.json(
          { error: 'Approval has expired' },
          { status: 410 }
        );
      }

      if (approval.status !== 'approved') {
        return NextResponse.json(
          { error: `Invalid approval status: ${approval.status}` },
          { status: 400 }
        );
      }

      // Approval is approved - use the email data from the approval's action_payload
      // This ensures we send exactly what was approved
      emailData = {
        to: approval.action_payload.to,
        subject: approval.action_payload.subject,
        body: approval.action_payload.body,
        cc: approval.action_payload.cc,
        bcc: approval.action_payload.bcc,
      };
    } else {
      // No approval_id provided - check if approval is needed
      const actionPayload = {
        to: validatedData.to,
        subject: validatedData.subject,
        body: validatedData.body,
        cc: validatedData.cc,
        bcc: validatedData.bcc,
      };

      const { requiresApproval, matchedRule } = await evaluateRules(agent.owner_id, {
        agent_id: agent.id,
        action_type: 'gmail.send',
        action_payload: actionPayload,
        service_connection_id: connection.id,
        service_provider_id: 'gmail',
      });

      if (requiresApproval) {
        // Create pending approval
        const approval = await createApproval({
          agent_id: agent.id,
          owner_id: agent.owner_id,
          rule_id: matchedRule?.id,
          service_connection_id: connection.id,
          action_type: 'gmail.send',
          action_payload: actionPayload,
          expires_in_hours: matchedRule?.auto_approve_after_hours || 24,
        });

        return NextResponse.json({
          requires_approval: true,
          approval_id: approval.id,
          status: approval.status,
          priority: approval.priority,
          action_summary: approval.action_summary,
          expires_at: approval.expires_at,
          message: 'Approval required. Use the approval_id to check status and retry when approved.',
        });
      }

      // No approval needed - proceed
    }

    // Send the email using the email data (either from request or from approval)
    const result = await sendGmailEmail(connection, emailData);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      message_id: result.id,
      thread_id: result.threadId,
      approval_id: validatedData.approval_id || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error in POST /api/services/gmail/send:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
