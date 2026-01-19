import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/auth/agent-auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/agents/[id]/regenerate-key - Regenerate API key
export async function POST(
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

    // Verify agent belongs to user
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const newApiKeyHash = await hashApiKey(newApiKey);
    const newApiKeyPrefix = getApiKeyPrefix(newApiKey);

    // Update agent with new key
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        api_key_hash: newApiKeyHash,
        api_key_prefix: newApiKeyPrefix,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error regenerating API key:', updateError);
      return NextResponse.json({ error: 'Failed to regenerate API key' }, { status: 500 });
    }

    return NextResponse.json({
      api_key: newApiKey,
      api_key_prefix: newApiKeyPrefix,
      message: 'API key regenerated successfully. Store it securely - it won\'t be shown again.',
    });
  } catch (error) {
    console.error('Error in POST /api/agents/[id]/regenerate-key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
