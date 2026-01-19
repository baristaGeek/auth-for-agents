import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/debug/rules
 * Debug endpoint to see what rules exist for this agent's owner
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAgentAuth(request);
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const { agent } = authResult;

  const supabase = createServiceClient();

  const { data: rules, error } = await supabase
    .from('approval_rules')
    .select('*')
    .eq('owner_id', agent.owner_id)
    .order('priority', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    agent_id: agent.id,
    owner_id: agent.owner_id,
    rules_count: rules?.length || 0,
    rules: rules || [],
  });
}
