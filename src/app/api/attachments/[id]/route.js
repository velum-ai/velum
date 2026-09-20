import { verifyId } from "@/lib/sign";
import { readAttachment } from "@/lib/storage";

// Serves one stored image. Auth is the signed `t` token minted when the owning
// chat is loaded - it binds to this exact id, so no account number in the URL.
export async function GET(req, { params }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("t");

  if (!token || verifyId(token) !== id) {
    return new Response("forbidden", { status: 403 });
  }

  const file = await readAttachment(id);
  if (!file) return new Response("not found", { status: 404 });

  return new Response(file.body, {
    headers: {
      "content-type": file.mime,
      "cache-control": "private, max-age=86400, immutable",
      "content-length": String(file.body.length),
    },
  });
}
