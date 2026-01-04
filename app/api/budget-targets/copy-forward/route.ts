import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceMonth, destMonth, includeExpectedInflows = false } = body;

    // Validate required fields
    if (!sourceMonth || !destMonth) {
      return NextResponse.json(
        { error: "Missing required fields: sourceMonth, destMonth" },
        { status: 400 }
      );
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(sourceMonth) || !monthRegex.test(destMonth)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    // Don't allow copying to the same month
    if (sourceMonth === destMonth) {
      return NextResponse.json(
        { error: "Source and destination months must be different" },
        { status: 400 }
      );
    }

    // Convert to first day of month for database
    const sourceMonthDate = `${sourceMonth}-01`;
    const destMonthDate = `${destMonth}-01`;

    // Check if destination month already has budget targets
    const { data: existingTargets, error: checkError } = await supabase
      .from("budget_targets")
      .select("id")
      .eq("month", destMonthDate)
      .limit(1);

    if (checkError) {
      console.error("Error checking existing budget targets:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing budget targets" },
        { status: 500 }
      );
    }

    if (existingTargets && existingTargets.length > 0) {
      return NextResponse.json(
        { error: "Destination month already has budget targets. Clear them first or choose a different month." },
        { status: 409 }
      );
    }

    // Fetch budget targets from source month
    const { data: sourceTargets, error: fetchError } = await supabase
      .from("budget_targets")
      .select(`
        category_id,
        amount,
        notes
      `)
      .eq("month", sourceMonthDate);

    if (fetchError) {
      console.error("Error fetching source budget targets:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch source budget targets" },
        { status: 500 }
      );
    }

    if (!sourceTargets || sourceTargets.length === 0) {
      return NextResponse.json(
        { error: "No budget targets found in source month" },
        { status: 404 }
      );
    }

    // Prepare budget targets for insertion
    const targetsToInsert = sourceTargets.map(target => ({
      category_id: target.category_id,
      month: destMonthDate,
      amount: target.amount,
      notes: target.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Copy budget targets
    const { data: insertedTargets, error: insertError } = await supabase
      .from("budget_targets")
      .insert(targetsToInsert)
      .select(`
        *,
        categories (
          id,
          name,
          cashflow_group,
          color,
          icon
        )
      `);

    if (insertError) {
      console.error("Error copying budget targets:", insertError);
      
      // Handle unique constraint violation (shouldn't happen due to check above)
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Some budget targets already exist in destination month" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to copy budget targets" },
        { status: 500 }
      );
    }

    let copiedInflows = [];
    let inflowsCopied = 0;

    // Copy expected inflows if requested
    if (includeExpectedInflows) {
      // Check if destination month already has expected inflows
      const { data: existingInflows, error: checkInflowsError } = await supabase
        .from("expected_inflows")
        .select("id")
        .eq("month", destMonthDate)
        .limit(1);

      if (checkInflowsError) {
        console.error("Error checking existing expected inflows:", checkInflowsError);
        return NextResponse.json(
          { error: "Failed to check existing expected inflows" },
          { status: 500 }
        );
      }

      if (existingInflows && existingInflows.length > 0) {
        return NextResponse.json(
          { error: "Destination month already has expected inflows. Clear them first or choose a different month." },
          { status: 409 }
        );
      }

      // Fetch expected inflows from source month
      const { data: sourceInflows, error: fetchInflowsError } = await supabase
        .from("expected_inflows")
        .select(`
          source,
          counterparty_id,
          expected_amount,
          expected_date,
          recurrence,
          category_id,
          notes
        `)
        .eq("month", sourceMonthDate);

      if (fetchInflowsError) {
        console.error("Error fetching source expected inflows:", fetchInflowsError);
        return NextResponse.json(
          { error: "Failed to fetch source expected inflows" },
          { status: 500 }
        );
      }

      if (sourceInflows && sourceInflows.length > 0) {
        // Prepare expected inflows for insertion
        const inflowsToInsert = sourceInflows.map(inflow => ({
          source: inflow.source,
          counterparty_id: inflow.counterparty_id,
          expected_amount: inflow.expected_amount,
          expected_date: inflow.expected_date,
          recurrence: inflow.recurrence,
          category_id: inflow.category_id,
          month: destMonthDate,
          notes: inflow.notes,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // Copy expected inflows
        const { data: insertedInflows, error: insertInflowsError } = await supabase
          .from("expected_inflows")
          .insert(inflowsToInsert)
          .select(`
            *,
            categories (
              id,
              name,
              cashflow_group,
              color,
              icon
            ),
            counterparties (
              id,
              name,
              type,
              notes
            )
          `);

        if (insertInflowsError) {
          console.error("Error copying expected inflows:", insertInflowsError);
          return NextResponse.json(
            { error: "Failed to copy expected inflows" },
            { status: 500 }
          );
        }

        copiedInflows = insertedInflows || [];
        inflowsCopied = copiedInflows.length;
      }
    }

    return NextResponse.json({
      data: {
        targetsCopied: insertedTargets?.length || 0,
        inflowsCopied,
        targets: insertedTargets || [],
        inflows: copiedInflows,
      },
      message: `Successfully copied ${insertedTargets?.length || 0} budget targets${includeExpectedInflows ? ` and ${inflowsCopied} expected inflows` : ""} from ${sourceMonth} to ${destMonth}`,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/budget-targets/copy-forward:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
