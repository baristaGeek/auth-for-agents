import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { gmailAdapter } from '@/lib/oauth/gmail-adapter';

/**
 * GET /api/oauth/callback
 * Handles OAuth callback from service providers (Google)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Unknown error';
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Missing code or state`
      );
    }

    const supabase = createServiceClient();

    // Find the connection request by state
    const { data: connectionRequest, error: requestError } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('state', state)
      .eq('status', 'pending')
      .single();

    if (requestError || !connectionRequest) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Invalid or expired request`
      );
    }

    // Check if request has expired
    if (new Date(connectionRequest.expires_at) < new Date()) {
      await supabase
        .from('connection_requests')
        .update({ status: 'expired' })
        .eq('id', connectionRequest.id);

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Request expired`
      );
    }

    // Get service provider details
    const { data: serviceProvider } = await supabase
      .from('service_providers')
      .select('*')
      .eq('id', connectionRequest.service_provider_id)
      .single();

    if (!serviceProvider) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Service provider not found`
      );
    }

    // Exchange code for tokens based on provider
    let tokens;
    let userInfo;

    if (connectionRequest.service_provider_id === 'gmail') {
      tokens = await gmailAdapter.exchangeCodeForTokens(code);
      userInfo = await gmailAdapter.getUserInfo(tokens.access_token);
    } else {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Provider not implemented`
      );
    }

    // Encrypt tokens
    const encryptedTokens = gmailAdapter.encryptTokens(tokens);

    // Calculate token expiry
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Create service connection
    const { data: connection, error: connectionError } = await supabase
      .from('service_connections')
      .insert({
        agent_id: connectionRequest.agent_id,
        service_provider_id: connectionRequest.service_provider_id,
        user_id: connectionRequest.user_id,
        access_token_encrypted: encryptedTokens.access_token_encrypted,
        refresh_token_encrypted: encryptedTokens.refresh_token_encrypted,
        token_expires_at: tokenExpiresAt,
        scopes: connectionRequest.scopes,
        provider_user_id: userInfo.id,
        provider_email: userInfo.email,
        provider_metadata: { email: userInfo.email },
        status: 'active',
      })
      .select()
      .single();

    if (connectionError) {
      console.error('Error creating service connection:', connectionError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Failed to create connection`
      );
    }

    // Update connection request status
    await supabase
      .from('connection_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', connectionRequest.id);

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_success=true&service=${serviceProvider.name}`
    );
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?oauth_error=Internal server error`
    );
  }
}
