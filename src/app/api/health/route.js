import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dodoStatus } from "@/lib/dodo";
import { btcpayConfigured } from "@/lib/btcpay";
import { upstreamConfigured } from "@/lib/upstream";

export const dynamic = "force-dynamic";

// Liveness + DB readiness for the container HEALTHCHECK and uptime monitors.
export async function GET() {
  const { configured, mode } = dodoStatus();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      ts: Date.now(),
      chat: { configured: upstreamConfigured() },
      payments: { configured, mode },
      btcpay: { configured: btcpayConfigured() },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
