import { createServiceClient } from '../supabase/server';
import { generateActionSummary, determinePriority } from './rule-engine';

export interface CreateApprovalParams {
  agent_id: string;
  owner_id: string;
  rule_id?: string;
  service_connection_id?: string;
  action_type: string;
  action_payload: any;
  expires_in_hours?: number;
}

export interface PendingApproval {
  id: string;
  agent_id: string;
  service_connection_id: string | null;
  rule_id: string | null;
  owner_id: string;
  action_type: string;
  action_payload: any;
  action_summary: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_comment: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new pending approval
 */
export async function createApproval(params: CreateApprovalParams): Promise<PendingApproval> {
  const supabase = createServiceClient();

  // Generate action summary
  const actionSummary = generateActionSummary(params.action_type, params.action_payload);

  // Determine priority
  const priority = determinePriority(params.action_type, params.action_payload);

  // Calculate expiry (default: 24 hours)
  const expiresInHours = params.expires_in_hours || 24;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  // Insert approval
  const { data: approval, error } = await supabase
    .from('pending_approvals')
    .insert({
      agent_id: params.agent_id,
      owner_id: params.owner_id,
      rule_id: params.rule_id,
      service_connection_id: params.service_connection_id,
      action_type: params.action_type,
      action_payload: params.action_payload,
      action_summary: actionSummary,
      priority,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating approval:', error);
    throw new Error('Failed to create approval');
  }

  // Log to history
  await supabase.from('approval_history').insert({
    approval_id: approval.id,
    user_id: params.owner_id,
    action: 'created',
    metadata: { priority, expires_at: expiresAt },
  });

  return approval;
}

/**
 * Approve a pending approval
 */
export async function approveApproval(
  approvalId: string,
  userId: string,
  comment?: string
): Promise<PendingApproval> {
  const supabase = createServiceClient();

  // Update approval status
  const { data: approval, error } = await supabase
    .from('pending_approvals')
    .update({
      status: 'approved',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_comment: comment || null,
    })
    .eq('id', approvalId)
    .eq('status', 'pending') // Only approve if still pending
    .select()
    .single();

  if (error || !approval) {
    throw new Error('Failed to approve or approval not found');
  }

  // Log to history
  await supabase.from('approval_history').insert({
    approval_id: approvalId,
    user_id: userId,
    action: 'approved',
    comment,
  });

  return approval;
}

/**
 * Reject a pending approval
 */
export async function rejectApproval(
  approvalId: string,
  userId: string,
  reason?: string
): Promise<PendingApproval> {
  const supabase = createServiceClient();

  // Update approval status
  const { data: approval, error } = await supabase
    .from('pending_approvals')
    .update({
      status: 'rejected',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_comment: reason || null,
    })
    .eq('id', approvalId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !approval) {
    throw new Error('Failed to reject or approval not found');
  }

  // Log to history
  await supabase.from('approval_history').insert({
    approval_id: approvalId,
    user_id: userId,
    action: 'rejected',
    comment: reason,
  });

  return approval;
}

/**
 * Cancel a pending approval (called by agent or system)
 */
export async function cancelApproval(approvalId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('pending_approvals')
    .update({
      status: 'cancelled',
    })
    .eq('id', approvalId)
    .eq('status', 'pending');

  if (error) {
    throw new Error('Failed to cancel approval');
  }
}

/**
 * Get approval status
 */
export async function getApprovalStatus(approvalId: string): Promise<PendingApproval | null> {
  const supabase = createServiceClient();

  const { data: approval, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .eq('id', approvalId)
    .single();

  if (error || !approval) {
    return null;
  }

  return approval;
}

/**
 * Auto-expire old pending approvals
 * Should be called periodically (e.g., via cron or background job)
 */
export async function expireOldApprovals(): Promise<number> {
  const supabase = createServiceClient();

  // Find expired pending approvals
  const { data: expiredApprovals, error: findError } = await supabase
    .from('pending_approvals')
    .select('id')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (findError || !expiredApprovals || expiredApprovals.length === 0) {
    return 0;
  }

  const expiredIds = expiredApprovals.map((a) => a.id);

  // Update status to expired
  const { error: updateError } = await supabase
    .from('pending_approvals')
    .update({ status: 'expired' })
    .in('id', expiredIds);

  if (updateError) {
    console.error('Error expiring approvals:', updateError);
    return 0;
  }

  return expiredIds.length;
}

/**
 * List pending approvals for a user
 */
export async function listPendingApprovals(
  userId: string,
  filters?: {
    status?: string;
    priority?: string;
    agent_id?: string;
  }
): Promise<PendingApproval[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('pending_approvals')
    .select(`
      *,
      agents (
        name,
        description
      ),
      approval_rules (
        name
      )
    `)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters?.agent_id) {
    query = query.eq('agent_id', filters.agent_id);
  }

  const { data: approvals, error } = await query;

  if (error) {
    console.error('Error listing approvals:', error);
    return [];
  }

  return approvals || [];
}
