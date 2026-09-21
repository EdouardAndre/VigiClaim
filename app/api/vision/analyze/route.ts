import { NextResponse } from "next/server";
import { DEFAULT_DEMO_CLAIM_ID } from "@/lib/demo-claims";
import { analyzeClaimPhoto, parseVisionAnalyserProvider } from "@/lib/vision-analyser";

export async function POST(request: Request) {
  try {
    let claimId = DEFAULT_DEMO_CLAIM_ID;
    let provider = parseVisionAnalyserProvider(undefined);

    try {
      const body = await request.json();
      if (body && typeof body.claimId === "string") {
        claimId = body.claimId;
      }
      if (body && typeof body.provider === "string") {
        provider = parseVisionAnalyserProvider(body.provider);
      }
    } catch {
      claimId = DEFAULT_DEMO_CLAIM_ID;
    }

    return NextResponse.json(await analyzeClaimPhoto(claimId, provider));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision analyser unavailable";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
