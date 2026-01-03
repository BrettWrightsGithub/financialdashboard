import { NextRequest, NextResponse } from "next/server";
import { 
  getAllRules, 
  createRule, 
  updateRule, 
  deleteRule,
  updateRulePriorities 
} from "@/lib/categorization";

// GET - Fetch all rules
export async function GET() {
  try {
    const rules = await getAllRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching rules:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

// POST - Create a new rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.assign_category_id) {
      return NextResponse.json(
        { error: "name and assign_category_id are required" },
        { status: 400 }
      );
    }

    const rule = await createRule({
      name: body.name,
      description: body.description || null,
      priority: body.priority ?? 0,
      is_active: body.is_active ?? true,
      match_merchant_contains: body.match_merchant_contains || null,
      match_merchant_exact: body.match_merchant_exact || null,
      match_amount_min: body.match_amount_min ?? null,
      match_amount_max: body.match_amount_max ?? null,
      match_account_id: body.match_account_id || null,
      match_account_subtype: body.match_account_subtype || null,
      match_direction: body.match_direction || null,
      assign_category_id: body.assign_category_id,
      assign_is_transfer: body.assign_is_transfer ?? null,
      assign_is_pass_through: body.assign_is_pass_through ?? null,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create rule" },
      { status: 500 }
    );
  }
}

// PUT - Update a rule or batch update priorities
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Batch priority update
    if (body.priority_updates && Array.isArray(body.priority_updates)) {
      await updateRulePriorities(body.priority_updates);
      return NextResponse.json({ success: true });
    }

    // Single rule update
    if (!body.id) {
      return NextResponse.json(
        { error: "id is required for update" },
        { status: 400 }
      );
    }

    const { id, ...updates } = body;
    const rule = await updateRule(id, updates);

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error updating rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update rule" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a rule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    await deleteRule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete rule" },
      { status: 500 }
    );
  }
}
