/**
 * API Route: Transaction Splitting
 * POST: Create splits for a parent transaction
 * DELETE: Unsplit (remove children, reset parent)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  splitTransaction,
  unsplitTransaction,
  getSplitChildren,
  validateSplitAmounts,
} from "@/lib/categorization/transactionSplitting";
import { supabase } from "@/lib/supabase";
import type { SplitInput } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parent_id, splits } = body as {
      parent_id: string;
      splits: SplitInput[];
    };

    if (!parent_id) {
      return NextResponse.json(
        { error: "parent_id is required" },
        { status: 400 }
      );
    }

    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      return NextResponse.json(
        { error: "At least 2 splits are required" },
        { status: 400 }
      );
    }

    const result = await splitTransaction(parent_id, splits);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      parent_id: result.parentId,
      children: result.children,
      message: `Created ${result.children.length} split transactions`,
    });
  } catch (error) {
    console.error("Split transaction error:", error);
    return NextResponse.json(
      { error: "Failed to split transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parent_id");

    if (!parentId) {
      return NextResponse.json(
        { error: "parent_id query parameter is required" },
        { status: 400 }
      );
    }

    const result = await unsplitTransaction(parentId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      parent_id: result.parentId,
      deleted_count: result.deletedCount,
      message: `Removed ${result.deletedCount} split transactions`,
    });
  } catch (error) {
    console.error("Unsplit transaction error:", error);
    return NextResponse.json(
      { error: "Failed to unsplit transaction" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parent_id");

    if (!parentId) {
      return NextResponse.json(
        { error: "parent_id query parameter is required" },
        { status: 400 }
      );
    }

    const children = await getSplitChildren(parentId);

    return NextResponse.json({
      parent_id: parentId,
      children,
      count: children.length,
    });
  } catch (error) {
    console.error("Get split children error:", error);
    return NextResponse.json(
      { error: "Failed to get split children" },
      { status: 500 }
    );
  }
}
