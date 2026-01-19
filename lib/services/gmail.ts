import { createServiceClient } from '../supabase/server';
import { gmailAdapter } from '../oauth/gmail-adapter';

export interface GmailServiceConnection {
  id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  provider_email: string;
}

/**
 * Get active Gmail connection for an agent
 */
export async function getGmailConnection(agentId: string): Promise<GmailServiceConnection | null> {
  const supabase = createServiceClient();

  const { data: connection, error } = await supabase
    .from('service_connections')
    .select('*')
    .eq('agent_id', agentId)
    .eq('service_provider_id', 'gmail')
    .eq('status', 'active')
    .single();

  if (error || !connection) {
    return null;
  }

  // Decrypt tokens
  const tokens = gmailAdapter.decryptTokens({
    access_token_encrypted: connection.access_token_encrypted,
    refresh_token_encrypted: connection.refresh_token_encrypted,
  });

  // Check if token is expired and needs refresh
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const bufferMinutes = 5; // Refresh 5 minutes before expiry

    if (now >= new Date(expiresAt.getTime() - bufferMinutes * 60 * 1000)) {
      // Token is expired or about to expire - refresh it
      if (tokens.refresh_token) {
        try {
          const refreshedTokens = await gmailAdapter.refreshAccessToken(tokens.refresh_token);

          // Encrypt new tokens
          const encryptedTokens = gmailAdapter.encryptTokens({
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token || tokens.refresh_token,
            token_type: refreshedTokens.token_type,
            expires_in: refreshedTokens.expires_in,
          });

          // Update connection with new tokens
          const newExpiresAt = refreshedTokens.expires_in
            ? new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString()
            : null;

          await supabase
            .from('service_connections')
            .update({
              access_token_encrypted: encryptedTokens.access_token_encrypted,
              refresh_token_encrypted: encryptedTokens.refresh_token_encrypted,
              token_expires_at: newExpiresAt,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', connection.id);

          // Return refreshed token
          return {
            id: connection.id,
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token || tokens.refresh_token,
            token_expires_at: newExpiresAt,
            provider_email: connection.provider_email,
          };
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          // Fall through to return existing (possibly expired) token
        }
      }
    }
  }

  // Update last_used_at
  await supabase
    .from('service_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', connection.id);

  return {
    id: connection.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: connection.token_expires_at,
    provider_email: connection.provider_email,
  };
}

/**
 * Send email via Gmail
 */
export async function sendGmailEmail(
  connection: GmailServiceConnection,
  params: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  }
): Promise<{ id: string; threadId: string }> {
  return gmailAdapter.sendEmail(connection.access_token, params);
}

/**
 * List Gmail messages
 */
export async function listGmailMessages(
  connection: GmailServiceConnection,
  params?: {
    maxResults?: number;
    q?: string;
    labelIds?: string[];
  }
): Promise<{ messages: Array<{ id: string; threadId: string }>; resultSizeEstimate: number }> {
  return gmailAdapter.listMessages(connection.access_token, params);
}

/**
 * Get a specific Gmail message
 */
export async function getGmailMessage(connection: GmailServiceConnection, messageId: string) {
  return gmailAdapter.getMessage(connection.access_token, messageId);
}
