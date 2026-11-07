import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

interface RevalidateRequestBody {
  paths?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-revalidate-secret");
  const expectedSecret = process.env["REVALIDATE_SECRET"];

  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing revalidation secret",
        },
      },
      { status: 401 },
    );
  }

  let body: RevalidateRequestBody;
  try {
    body = (await req.json()) as RevalidateRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid JSON body",
        },
      },
      { status: 400 },
    );
  }

  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === "string")
    : [];

  if (paths.length === 0) {
    // If no paths specified, revalidate home by default
    paths.push("/");
  }

  const revalidated: string[] = [];
  for (const path of paths) {
    try {
      revalidatePath(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`Failed to revalidate path '${path}':`, err);
    }
  }

  return NextResponse.json({
    revalidated: true,
    paths: revalidated,
    now: Date.now(),
  });
}
