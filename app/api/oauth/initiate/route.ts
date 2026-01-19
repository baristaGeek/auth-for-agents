import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth } from '@/lib/auth/agent-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { gmailAdapter } from '@/lib/oauth/gmail-adapter';
import { z } from 'zod';
import crypto from 'crypto';

const initiateOAuthSchema = z.object({
  service_provider_id: z.string(),
  scopes: z.array(z.string()).optional(),
  redirect_url: z.string().url().optional(),
});

/**
 * POST /api/oauth/initiate
 * Agent initiates OAuth flow to request user authorization
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent
    const authResult = await requireAgentAuth(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { agent } = authResult;

    // Parse and validate request
    const body = await request.json();
    const validatedData = initiateOAuthSchema.parse(body);

    const supabase = createServiceClient();

    // Verify service provider exists
    const { data: serviceProvider, error: providerError } = await supabase
      .from('service_providers')
      .select('*')
      .eq('id', validatedData.service_provider_id)
      .eq('is_active', true)
      .single();

    if (providerError || !serviceProvider) {
      return NextResponse.json(
        { error: 'Service provider not found or inactive' },
        { status: 404 }
      );
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('service_connections')
      .select('*')
      .eq('agent_id', agent.id)
      .eq('service_provider_id', validatedData.service_provider_id)
      .eq('status', 'active')
      .single();

    if (existingConnection) {
      return NextResponse.json({
        error: 'Connection already exists',
        connection_id: existingConnection.id,
      }, { status: 409 });
    }

    // Generate unique state token for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Create connection request (expires in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const requestedScopes = validatedData.scopes || serviceProvider.oauth_scopes;

    const { data: connectionRequest, error: requestError } = await supabase
      .from('connection_requests')
      .insert({
        agent_id: agent.id,
        service_provider_id: validatedData.service_provider_id,
        user_id: agent.owner_id,
        scopes: requestedScopes,
        state,
        expires_at: expiresAt,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating connection request:', requestError);
      return NextResponse.json(
        { error: 'Failed to create connection request' },
        { status: 500 }
      );
    }

    // Generate authorization URL
    let authorizationUrl: string;
    if (validatedData.service_provider_id === 'gmail') {
      authorizationUrl = gmailAdapter.getAuthorizationUrl(state, requestedScopes);
    } else {
      // Future: Add more service providers
      return NextResponse.json(
        { error: 'Service provider not yet implemented' },
        { status: 501 }
      );
    }

    // Build the user-facing consent page URL
    const consentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/oauth/authorize?request_id=${connectionRequest.id}`;

    return NextResponse.json({
      request_id: connectionRequest.id,
      authorization_url: consentUrl,
      service_provider: serviceProvider.name,
      scopes: requestedScopes,
      expires_at: expiresAt,
      message: 'User must visit the authorization URL to grant access',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error in POST /api/oauth/initiate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
