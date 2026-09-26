import { NextResponse } from "next/server";
import { createProject, renameProject, deleteProject } from "@/lib/account";
import { guardRequest } from "@/lib/guard";

const LIMITS = { key: "projects", limit: 60, windowMs: 60_000 };

const json = (data, status = 200) => NextResponse.json(data, { status });

async function guarded(req) {
  const body = await req.json().catch(() => ({}));
  const g = await guardRequest(req, { ...LIMITS, account: body.account });
  return { body, g };
}

export async function POST(req) {
  const { body, g } = await guarded(req);
  if (g.error) return json({ error: g.error }, g.status);

  const project = await createProject(body.account, body.name);
  return project ? json(project) : json({ error: "invalid request" }, 400);
}

export async function PATCH(req) {
  const { body, g } = await guarded(req);
  if (g.error) return json({ error: g.error }, g.status);

  const result = await renameProject(body.account, body.projectId, body.name);
  return result ? json(result) : json({ error: "invalid request" }, 400);
}

export async function DELETE(req) {
  const { body, g } = await guarded(req);
  if (g.error) return json({ error: g.error }, g.status);

  const ok = await deleteProject(body.account, body.projectId);
  return ok ? json({ ok: true }) : json({ error: "invalid request" }, 400);
}
