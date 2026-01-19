import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/approvals
 * List approvals for authenticated user (dashboard only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const agentId = searchParams.get('agent_id');

    // Build query
    let query = supabase
      .from('pending_approvals')
      .select(`
        *,
        agents (
          id,
          name,
          description
        ),
        approval_rules (
          id,
          name
        )
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data: approvals, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching approvals:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
    }

    // Format response
    const formattedApprovals = (approvals || []).map((approval) => ({
      id: approval.id,
      agent: approval.agents ? {
        id: approval.agents.id,
        name: approval.agents.name,
        description: approval.agents.description,
      } : null,
      rule: approval.approval_rules ? {
        id: approval.approval_rules.id,
        name: approval.approval_rules.name,
      } : null,
      action_type: approval.action_type,
      action_payload: approval.action_payload,
      action_summary: approval.action_summary,
      status: approval.status,
      priority: approval.priority,
      created_at: approval.created_at,
      expires_at: approval.expires_at,
      resolved_at: approval.resolved_at,
      resolution_comment: approval.resolution_comment,
    }));

    return NextResponse.json({ approvals: formattedApprovals });
  } catch (error) {
    console.error('Error in GET /api/approvals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
