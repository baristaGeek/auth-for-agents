import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/agents/[id] - Get agent details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch agent
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Fetch recent activity (API usage logs)
    const { data: recentActivity } = await supabase
      .from('api_usage_logs')
      .select('*')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      agent,
      recent_activity: recentActivity || [],
    });
  } catch (error) {
    console.error('Error in GET /api/agents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/agents/[id] - Update agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateAgentSchema.parse(body);

    // Update agent
    const { data: agent, error: updateError } = await supabase
      .from('agents')
      .update(validatedData)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (updateError || !agent) {
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Error in PATCH /api/agents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete agent (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Error deleting agent:', deleteError);
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/agents/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
