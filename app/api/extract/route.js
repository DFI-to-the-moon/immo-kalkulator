export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY nicht konfiguriert" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: "Fehler bei der API-Anfrage" },
      { status: 500 }
    );
  }
}
