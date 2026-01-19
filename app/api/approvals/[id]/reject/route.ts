import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rejectApproval } from '@/lib/approval/approval-manager';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().optional(),
});

/**
 * POST /api/approvals/:id/reject
 * User rejects a pending approval (dashboard only)
 */
export async function POST(
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

    // Parse request body
    const body = await request.json();
    const { reason } = rejectSchema.parse(body);

    // Reject the approval
    const approval = await rejectApproval(id, user.id, reason);

    return NextResponse.json({
      message: 'Approval rejected successfully',
      approval: {
        id: approval.id,
        status: approval.status,
        resolved_at: approval.resolved_at,
        resolution_comment: approval.resolution_comment,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error in POST /api/approvals/:id/reject:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
