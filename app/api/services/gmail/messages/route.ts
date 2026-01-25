import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { getGmailConnection, listGmailMessages } from '@/lib/services/gmail';
import { z } from 'zod';

const listMessagesSchema = z.object({
  maxResults: z.number().int().min(1).max(100).optional().default(10),
  q: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
});

/**
 * GET /api/services/gmail/messages
 * List Gmail messages (usually no approval needed for reads)
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      maxResults: parseInt(searchParams.get('maxResults') || '10'),
      q: searchParams.get('q') || undefined,
      labelIds: searchParams.getAll('labelIds').length > 0
        ? searchParams.getAll('labelIds')
        : undefined,
    };

    const validatedParams = listMessagesSchema.parse(params);

    // List messages
    const result = await listGmailMessages(connection, validatedParams);

    return NextResponse.json({
      success: true,
      messages: result.messages || [],
      resultSizeEstimate: result.resultSizeEstimate,
      provider_email: connection.provider_email,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error in GET /api/services/gmail/messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
