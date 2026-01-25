import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/auth/agent-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createAgentSchema.parse(body);

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    // Insert agent into database
    const { data: agent, error: insertError } = await supabase
      .from('agents')
      .insert({
        owner_id: user.id,
        name: validatedData.name,
        description: validatedData.description,
        metadata: validatedData.metadata || {},
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating agent:', insertError);
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
    }

    // Return agent with full API key (only shown once!)
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        api_key_prefix: agent.api_key_prefix,
        is_active: agent.is_active,
        created_at: agent.created_at,
      },
      api_key: apiKey,
      message: 'Store this API key securely. It won\'t be shown again.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    console.error('Error in POST /api/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/agents - List all agents for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch agents
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching agents:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    // Count pending approvals for each agent
    const agentsWithStats = await Promise.all(
      (agents || []).map(async (agent) => {
        const { count: approvalsCount } = await supabase
          .from('pending_approvals')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)
          .eq('status', 'pending');

        return {
          ...agent,
          pending_approvals_count: approvalsCount || 0,
        };
      })
    );

    return NextResponse.json({ agents: agentsWithStats });
  } catch (error) {
    console.error('Error in GET /api/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
