import { createServiceClient } from '../supabase/server';

export interface ApprovalRule {
  id: string;
  owner_id: string;
  agent_id?: string | null;  // Optional: rule can be scoped to specific agent
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  conditions: RuleConditions;
  require_approval: boolean;
  auto_approve_after_hours: number | null;
  notify_channels: any[];
  approvers: string[];
}

export interface RuleConditions {
  // Which agents does this rule apply to?
  agent_ids?: string[]; // Empty/null = all agents

  // Which action types?
  action_types?: string[]; // e.g., ['gmail.send', 'gmail.modify']

  // Pattern matching on action payload
  payload_patterns?: PayloadPattern[];

  // Service provider filters
  service_provider_ids?: string[];
}

export interface PayloadPattern {
  field: string; // JSON path, e.g., "to", "subject", "body"
  operator: 'equals' | 'contains' | 'matches' | 'not_equals' | 'starts_with' | 'ends_with';
  value: string;
  case_sensitive?: boolean;
}

export interface ActionContext {
  agent_id: string;
  action_type: string;
  action_payload: any;
  service_connection_id?: string;
  service_provider_id?: string;
}

/**
 * Evaluate if an action requires approval based on rules
 */
export async function evaluateRules(
  ownerId: string,
  context: ActionContext
): Promise<{ requiresApproval: boolean; matchedRule: ApprovalRule | null }> {
  const supabase = createServiceClient();

  // Fetch active rules for this user (and optionally for this specific agent)
  // Rules can be:
  // 1. User-level (agent_id IS NULL) - applies to all agents
  // 2. Agent-specific (agent_id matches) - applies only to this agent
  const { data: rules, error } = await supabase
    .from('approval_rules')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .or(`agent_id.is.null,agent_id.eq.${context.agent_id}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error || !rules || rules.length === 0) {
    // No rules = no approval needed (fail open)
    return { requiresApproval: false, matchedRule: null };
  }

  // Evaluate rules in priority order
  for (const rule of rules) {
    if (doesRuleMatch(rule, context)) {
      return {
        requiresApproval: rule.require_approval,
        matchedRule: rule,
      };
    }
  }

  // No matching rules = no approval needed
  return { requiresApproval: false, matchedRule: null };
}

/**
 * Check if a rule matches the given action context
 */
function doesRuleMatch(rule: ApprovalRule, context: ActionContext): boolean {
  const conditions = rule.conditions;

  // Check agent_ids filter
  if (conditions.agent_ids && conditions.agent_ids.length > 0) {
    if (!conditions.agent_ids.includes(context.agent_id)) {
      return false;
    }
  }

  // Check action_types filter
  if (conditions.action_types && conditions.action_types.length > 0) {
    if (!conditions.action_types.includes(context.action_type)) {
      return false;
    }
  }

  // Check service_provider_ids filter
  if (conditions.service_provider_ids && conditions.service_provider_ids.length > 0) {
    if (!context.service_provider_id || !conditions.service_provider_ids.includes(context.service_provider_id)) {
      return false;
    }
  }

  // Check payload patterns
  if (conditions.payload_patterns && conditions.payload_patterns.length > 0) {
    for (const pattern of conditions.payload_patterns) {
      if (!matchesPayloadPattern(context.action_payload, pattern)) {
        return false;
      }
    }
  }

  // All conditions matched
  return true;
}

/**
 * Check if payload matches a specific pattern
 */
function matchesPayloadPattern(payload: any, pattern: PayloadPattern): boolean {
  // Get field value from payload using dot notation
  const value = getFieldValue(payload, pattern.field);

  if (value === undefined || value === null) {
    return false;
  }

  const stringValue = String(value);
  let patternValue = pattern.value;

  // Handle case sensitivity
  if (!pattern.case_sensitive) {
    stringValue.toLowerCase();
    patternValue = patternValue.toLowerCase();
  }

  switch (pattern.operator) {
    case 'equals':
      return (pattern.case_sensitive ? stringValue : stringValue.toLowerCase()) ===
             (pattern.case_sensitive ? patternValue : patternValue.toLowerCase());

    case 'not_equals':
      return (pattern.case_sensitive ? stringValue : stringValue.toLowerCase()) !==
             (pattern.case_sensitive ? patternValue : patternValue.toLowerCase());

    case 'contains':
      return (pattern.case_sensitive ? stringValue : stringValue.toLowerCase())
        .includes(pattern.case_sensitive ? patternValue : patternValue.toLowerCase());

    case 'starts_with':
      return (pattern.case_sensitive ? stringValue : stringValue.toLowerCase())
        .startsWith(pattern.case_sensitive ? patternValue : patternValue.toLowerCase());

    case 'ends_with':
      return (pattern.case_sensitive ? stringValue : stringValue.toLowerCase())
        .endsWith(pattern.case_sensitive ? patternValue : patternValue.toLowerCase());

    case 'matches':
      try {
        const regex = new RegExp(patternValue, pattern.case_sensitive ? '' : 'i');
        return regex.test(stringValue);
      } catch (e) {
        console.error('Invalid regex pattern:', patternValue);
        return false;
      }

    default:
      return false;
  }
}

/**
 * Get nested field value from object using dot notation
 * e.g., "user.email" from { user: { email: "test@example.com" } }
 */
function getFieldValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Generate human-readable summary of what an action does
 */
export function generateActionSummary(actionType: string, payload: any): string {
  switch (actionType) {
    case 'gmail.send':
      return `Send email to ${payload.to} with subject "${payload.subject}"`;

    case 'gmail.modify':
      return `Modify email ${payload.message_id}: ${payload.operation}`;

    case 'gmail.read':
      return `Read emails matching: ${payload.query || 'all'}`;

    case 'document.query':
      return `Query document "${payload.document_id}" with: ${payload.query}`;

    case 'document.download':
      return `Download document "${payload.document_id}"`;

    default:
      return `Perform action: ${actionType}`;
  }
}

/**
 * Determine priority level based on action type and payload
 */
export function determinePriority(actionType: string, payload: any): 'low' | 'medium' | 'high' | 'urgent' {
  // Urgent: Sending to external domains, large batches
  if (actionType === 'gmail.send') {
    const recipient = payload.to || '';
    if (recipient.includes('@gmail.com') || recipient.includes('@googlemail.com')) {
      return 'medium';
    }
    return 'high'; // External domain
  }

  // High: Modifying or deleting data
  if (actionType.includes('modify') || actionType.includes('delete')) {
    return 'high';
  }

  // Medium: Document downloads
  if (actionType === 'document.download') {
    return 'medium';
  }

  // Low: Read operations
  if (actionType.includes('read') || actionType.includes('query')) {
    return 'low';
  }

  return 'medium';
}
