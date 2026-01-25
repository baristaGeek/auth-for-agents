import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const payloadPatternSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'matches', 'not_equals', 'starts_with', 'ends_with']),
  value: z.string(),
  case_sensitive: z.boolean().optional(),
});

const ruleConditionsSchema = z.object({
  agent_ids: z.array(z.string()).optional(),
  action_types: z.array(z.string()).optional(),
  service_provider_ids: z.array(z.string()).optional(),
  payload_patterns: z.array(payloadPatternSchema).optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  conditions: ruleConditionsSchema.optional(),
  require_approval: z.boolean().optional(),
  auto_approve_after_hours: z.number().int().min(1).max(168).optional().nullable(),
  notify_channels: z.array(z.any()).optional(),
  approvers: z.array(z.string()).optional(),
});

/**
 * GET /api/approval-rules/:id
 * Get a specific approval rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch rule
    const { data: rule, error: fetchError } = await supabase
      .from('approval_rules')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error in GET /api/approval-rules/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/approval-rules/:id
 * Update an approval rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateRuleSchema.parse(body);

    // Update rule
    const { data: rule, error: updateError } = await supabase
      .from('approval_rules')
      .update(validatedData)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (updateError || !rule) {
      console.error('Error updating rule:', updateError);
      return NextResponse.json({ error: 'Failed to update rule or rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error in PATCH /api/approval-rules/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/approval-rules/:id
 * Delete an approval rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete rule
    const { error: deleteError } = await supabase
      .from('approval_rules')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Error deleting rule:', deleteError);
      return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/approval-rules/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
