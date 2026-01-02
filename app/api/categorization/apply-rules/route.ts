import { NextRequest, NextResponse } from "next/server";
import { 
  categorizeTransactions, 
  categorizeUncategorized,
  categorizeByDateRange 
} from "@/lib/categorization";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction_ids, mode, start_date, end_date } = body;

    let result;

    if (mode === "uncategorized") {
      // Categorize all uncategorized transactions
      result = await categorizeUncategorized();
    } else if (mode === "date_range" && start_date && end_date) {
      // Categorize transactions in a date range
      result = await categorizeByDateRange(start_date, end_date);
    } else if (transaction_ids && Array.isArray(transaction_ids)) {
      // Categorize specific transactions
      if (transaction_ids.length === 0) {
        return NextResponse.json(
          { error: "transaction_ids array cannot be empty" },
          { status: 400 }
        );
      }
      if (transaction_ids.length > 1000) {
        return NextResponse.json(
          { error: "Maximum 1000 transactions per request" },
          { status: 400 }
        );
      }
      result = await categorizeTransactions(transaction_ids);
    } else {
      return NextResponse.json(
        { 
          error: "Invalid request. Provide transaction_ids array, mode='uncategorized', or mode='date_range' with start_date/end_date" 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Categorization error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Categorization failed",
        success: false 
      },
      { status: 500 }
    );
  }
}
