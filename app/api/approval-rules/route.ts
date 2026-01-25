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

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(0),
  conditions: ruleConditionsSchema,
  require_approval: z.boolean().default(true),
  auto_approve_after_hours: z.number().int().min(1).max(168).optional().nullable(),
  notify_channels: z.array(z.any()).default([]),
  approvers: z.array(z.string()).default([]),
});

/**
 * POST /api/approval-rules
 * Create a new approval rule
 */
export async function POST(request: NextRequest) {
  try {
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
    const validatedData = createRuleSchema.parse(body);

    // Insert rule
    const { data: rule, error: insertError } = await supabase
      .from('approval_rules')
      .insert({
        owner_id: user.id,
        name: validatedData.name,
        description: validatedData.description,
        is_active: validatedData.is_active,
        priority: validatedData.priority,
        conditions: validatedData.conditions,
        require_approval: validatedData.require_approval,
        auto_approve_after_hours: validatedData.auto_approve_after_hours,
        notify_channels: validatedData.notify_channels,
        approvers: validatedData.approvers,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating rule:', insertError);
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error in POST /api/approval-rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/approval-rules
 * List all approval rules for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('is_active');

    // Build query
    let query = supabase
      .from('approval_rules')
      .select('*')
      .eq('owner_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data: rules, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching rules:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (error) {
    console.error('Error in GET /api/approval-rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
