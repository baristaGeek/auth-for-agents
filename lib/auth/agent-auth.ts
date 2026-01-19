import { createServiceClient } from '../supabase/server';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const SALT_ROUNDS = 10;

/**
 * Generate a new API key for an agent
 * Format: ak_live_<random_string>
 */
export function generateApiKey(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomString = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `ak_live_${randomString}`;
}

/**
 * Hash an API key using bcrypt
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, SALT_ROUNDS);
}

/**
 * Verify an API key against a hash
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

/**
 * Get API key prefix for display (first 12 chars)
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 15) + '...'; // "ak_live_abc1234..."
}

/**
 * Authenticate an agent using API key from Authorization header
 * Returns agent data if valid, null otherwise
 */
export async function authenticateAgent(apiKey: string) {
  const supabase = createServiceClient();

  // Get the prefix to narrow down search
  const prefix = getApiKeyPrefix(apiKey);

  // Find agents with matching prefix
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('is_active', true)
    .limit(100); // Limit to prevent full table scan

  if (error || !agents || agents.length === 0) {
    return null;
  }

  // Verify the hash for each potential match
  for (const agent of agents) {
    const isValid = await verifyApiKey(apiKey, agent.api_key_hash);
    if (isValid) {
      // Update last_seen_at
      await supabase
        .from('agents')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', agent.id);

      return agent;
    }
  }

  return null;
}

/**
 * Middleware to require agent authentication for API routes
 * Usage: const agent = await requireAgentAuth(request);
 */
export async function requireAgentAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

  const agent = await authenticateAgent(apiKey);

  if (!agent) {
    return { error: 'Invalid API key', status: 401 };
  }

  return { agent };
}

/**
 * Extract agent from request (for use in API routes)
 */
export async function getAgentFromRequest(request: NextRequest) {
  const result = await requireAgentAuth(request);
  if ('error' in result) {
    return null;
  }
  return result.agent;
}
