const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5050";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxyRequest(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const path = params.path?.join("/") || "";
    const sourceUrl = new URL(request.url);
    const targetUrl = `${BACKEND_URL.replace(/\/$/, "")}/${path}${sourceUrl.search}`;
    const headers = new Headers(request.headers);

    headers.delete("host");
    headers.delete("content-length");

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Erreur proxy API :", error);

    return Response.json(
      { error: "Backend inaccessible depuis le frontend." },
      { status: 502 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}
