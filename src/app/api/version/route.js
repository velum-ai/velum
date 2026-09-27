import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GIT_SHA / BUILD_TIME are set by deploy/deploy.sh at deploy time, not build
// time, so no image rebuild is needed just to read them. Both are "dev" /
// empty locally.
export async function GET() {
  return NextResponse.json({
    sha: process.env.GIT_SHA || "dev",
    builtAt: process.env.BUILD_TIME || null,
  });
}
