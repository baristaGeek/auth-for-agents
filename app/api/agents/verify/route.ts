import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';

/**
 * GET /api/agents/verify
 * Verify agent API key authentication
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAgentAuth(request);

  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { agent } = authResult;

  return NextResponse.json({
    authenticated: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      is_active: agent.is_active,
      created_at: agent.created_at,
      last_seen_at: agent.last_seen_at,
    },
  });
}
