import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getClaimImagePath } from "@/lib/vision-analyser";

type RouteContext = {
  params: Promise<{
    claimId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { claimId } = await context.params;
    const imageBuffer = await readFile(getClaimImagePath(claimId));

    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/jpeg",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim photo unavailable";

    return NextResponse.json({ error: message }, { status: 404 });
  }
}
