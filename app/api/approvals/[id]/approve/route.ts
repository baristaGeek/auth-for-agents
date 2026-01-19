import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { approveApproval } from '@/lib/approval/approval-manager';
import { z } from 'zod';

const approveSchema = z.object({
  comment: z.string().optional(),
});

/**
 * POST /api/approvals/:id/approve
 * User approves a pending approval (dashboard only)
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
    const { comment } = approveSchema.parse(body);

    // Approve the approval
    const approval = await approveApproval(id, user.id, comment);

    return NextResponse.json({
      message: 'Approval granted successfully',
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
    console.error('Error in POST /api/approvals/:id/approve:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
