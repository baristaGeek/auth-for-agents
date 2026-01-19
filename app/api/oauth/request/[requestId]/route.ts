import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/oauth/request/:requestId
 * Get connection request details for authorization page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const supabase = await createClient();

    // Get authenticated user (must be logged in to see this)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connection request with related data
    const { data: connectionRequest, error: requestError } = await supabase
      .from('connection_requests')
      .select(`
        *,
        agents (
          name,
          description
        ),
        service_providers (
          name,
          description
        )
      `)
      .eq('id', requestId)
      .eq('user_id', user.id) // Verify request belongs to this user
      .single();

    if (requestError || !connectionRequest) {
      return NextResponse.json({ error: 'Connection request not found' }, { status: 404 });
    }

    // Check if expired
    if (new Date(connectionRequest.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Request has expired' }, { status: 410 });
    }

    // Check if already completed
    if (connectionRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${connectionRequest.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: connectionRequest.id,
      agent_name: connectionRequest.agents.name,
      agent_description: connectionRequest.agents.description,
      service_provider_name: connectionRequest.service_providers.name,
      service_provider_id: connectionRequest.service_provider_id,
      scopes: connectionRequest.scopes,
      expires_at: connectionRequest.expires_at,
      state: connectionRequest.state,
    });
  } catch (error) {
    console.error('Error in GET /api/oauth/request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/oauth/request/:requestId
 * Deny/reject a connection request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update request status to rejected
    const { error: updateError } = await supabase
      .from('connection_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error rejecting request:', updateError);
      return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/oauth/request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
