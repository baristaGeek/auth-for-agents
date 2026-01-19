import { encrypt, decrypt } from './encryption';

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers: Array<{ name: string; value: string }>;
    body: { data?: string };
  };
}

/**
 * Gmail OAuth Adapter
 * Handles OAuth flow and Gmail API interactions
 */
export class GmailAdapter {
  private config: GmailOAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`,
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    };

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string, scopes?: string[]): string {
    const scopeList = scopes || this.config.scopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopeList.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return response.json();
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<{ email: string; id: string }> {
    // Use Gmail API to get profile (works with gmail.readonly scope)
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user info: ${error}`);
    }

    const data = await response.json();
    // Gmail API returns: { emailAddress: "user@example.com", messagesTotal: 123, ... }
    return {
      email: data.emailAddress,
      id: data.emailAddress, // Use email as ID
    };
  }

  /**
   * Send email via Gmail API
   */
  async sendEmail(
    accessToken: string,
    params: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }
  ): Promise<{ id: string; threadId: string }> {
    // Create RFC 2822 formatted email
    const emailLines = [
      `To: ${params.to}`,
      params.cc ? `Cc: ${params.cc}` : '',
      params.bcc ? `Bcc: ${params.bcc}` : '',
      `Subject: ${params.subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      params.body,
    ].filter(line => line !== '');

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64url');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    return response.json();
  }

  /**
   * List messages from Gmail
   */
  async listMessages(
    accessToken: string,
    params?: {
      maxResults?: number;
      q?: string;
      labelIds?: string[];
    }
  ): Promise<{ messages: Array<{ id: string; threadId: string }>; resultSizeEstimate: number }> {
    const searchParams = new URLSearchParams();
    if (params?.maxResults) searchParams.set('maxResults', params.maxResults.toString());
    if (params?.q) searchParams.set('q', params.q);
    if (params?.labelIds) params.labelIds.forEach(id => searchParams.append('labelIds', id));

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list messages: ${error}`);
    }

    return response.json();
  }

  /**
   * Get a specific message
   */
  async getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get message: ${error}`);
    }

    return response.json();
  }

  /**
   * Encrypt OAuth tokens for storage
   */
  encryptTokens(tokens: OAuthTokens): {
    access_token_encrypted: string;
    refresh_token_encrypted: string | null;
  } {
    return {
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    };
  }

  /**
   * Decrypt OAuth tokens from storage
   */
  decryptTokens(encrypted: {
    access_token_encrypted: string;
    refresh_token_encrypted: string | null;
  }): { access_token: string; refresh_token: string | null } {
    return {
      access_token: decrypt(encrypted.access_token_encrypted),
      refresh_token: encrypted.refresh_token_encrypted
        ? decrypt(encrypted.refresh_token_encrypted)
        : null,
    };
  }
}

// Export singleton instance
export const gmailAdapter = new GmailAdapter();
