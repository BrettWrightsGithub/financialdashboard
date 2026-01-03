/**
 * API Route: Bulk Edit Transactions
 * POST: Apply bulk category or flag changes to multiple transactions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  bulkAssignCategory,
  bulkUpdateFlags,
  bulkApproveCategories,
} from "@/lib/categorization/bulkEdit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, transaction_ids, category_id, flags, learn_payee } = body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return NextResponse.json(
        { error: "transaction_ids array is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "assign_category":
        if (!category_id) {
          return NextResponse.json(
            { error: "category_id is required for assign_category action" },
            { status: 400 }
          );
        }
        result = await bulkAssignCategory({
          transaction_ids,
          category_id,
          learn_payee: learn_payee ?? false,
        });
        break;

      case "update_flags":
        if (!flags || typeof flags !== "object") {
          return NextResponse.json(
            { error: "flags object is required for update_flags action" },
            { status: 400 }
          );
        }
        result = await bulkUpdateFlags({
          transaction_ids,
          flags,
        });
        break;

      case "approve":
        result = await bulkApproveCategories(transaction_ids);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: assign_category, update_flags, or approve" },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      message: `Updated ${result.updated} transactions${result.skipped > 0 ? `, skipped ${result.skipped} locked` : ""}`,
    });
  } catch (error) {
    console.error("Bulk edit error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk edit" },
      { status: 500 }
    );
  }
}
