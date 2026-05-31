import { NextResponse } from "next/server";
import { assertBundleName, readDashboardBundle } from "@/lib/gcs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ bundle: string }> }) {
  try {
    const { bundle } = await params;
    assertBundleName(bundle);
    const data = await readDashboardBundle(bundle);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard API error";
    const status = message.startsWith("Unknown dashboard bundle") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
