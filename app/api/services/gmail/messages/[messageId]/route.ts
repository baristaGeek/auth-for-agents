import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { getGmailConnection, getGmailMessage } from '@/lib/services/gmail';

/**
 * GET /api/services/gmail/messages/:messageId
 * Get a specific Gmail message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    // Authenticate agent
    const authResult = await requireAgentAuth(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

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

    const { messageId } = await params;

    // Get the message
    const message = await getGmailMessage(connection, messageId);

    return NextResponse.json({
      success: true,
      ...message,
    });
  } catch (error) {
    console.error('Error in GET /api/services/gmail/messages/:messageId:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
