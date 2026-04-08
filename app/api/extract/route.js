// Edge Runtime umgeht das 4.5 MB Body-Limit von Serverless Functions
// indem der Request-Body direkt an Anthropic durchgestreamt wird
export const runtime = "edge";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY nicht konfiguriert. Bitte in Vercel Environment Variables setzen." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: request.body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return Response.json(
      { error: "Fehler bei der API-Anfrage: " + err.message },
      { status: 500 }
    );
  }
}
