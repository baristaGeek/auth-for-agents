import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/oauth/status/:requestId
 * Agent polls to check if OAuth authorization is complete
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    // Authenticate agent
    const authResult = await requireAgentAuth(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    const supabase = createServiceClient();

    // Get connection request
    const { data: connectionRequest, error: requestError } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('id', requestId)
      .eq('agent_id', agent.id) // Verify request belongs to this agent
      .single();

    if (requestError || !connectionRequest) {
      return NextResponse.json({ error: 'Connection request not found' }, { status: 404 });
    }

    // Check if expired
    if (new Date(connectionRequest.expires_at) < new Date() && connectionRequest.status === 'pending') {
      await supabase
        .from('connection_requests')
        .update({ status: 'expired' })
        .eq('id', requestId);

      return NextResponse.json({
        status: 'expired',
        message: 'Authorization request has expired',
      });
    }

    // If still pending
    if (connectionRequest.status === 'pending') {
      return NextResponse.json({
        status: 'pending',
        message: 'Waiting for user authorization',
        expires_at: connectionRequest.expires_at,
      });
    }

    // If rejected
    if (connectionRequest.status === 'rejected') {
      return NextResponse.json({
        status: 'rejected',
        message: 'User rejected the authorization request',
      });
    }

    // If completed, get the connection details
    if (connectionRequest.status === 'completed') {
      const { data: connection, error: connectionError } = await supabase
        .from('service_connections')
        .select(`
          id,
          service_provider_id,
          scopes,
          provider_email,
          connected_at,
          status
        `)
        .eq('agent_id', agent.id)
        .eq('service_provider_id', connectionRequest.service_provider_id)
        .eq('status', 'active')
        .single();

      if (connectionError || !connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        status: 'completed',
        message: 'Authorization successful',
        connection: {
          id: connection.id,
          service_provider_id: connection.service_provider_id,
          scopes: connection.scopes,
          provider_email: connection.provider_email,
          connected_at: connection.connected_at,
        },
      });
    }

    // Unknown status
    return NextResponse.json({
      status: connectionRequest.status,
      message: 'Unknown status',
    });
  } catch (error) {
    console.error('Error in GET /api/oauth/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
