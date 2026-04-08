export const runtime = "edge";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY nicht konfiguriert." },
      { status: 500 }
    );
  }
  return Response.json({ key: apiKey });
}
