import { NextRequest, NextResponse } from "next/server";
import { generateWavTts } from "@/lib/tts";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text") || searchParams.get("q") || "Ada objek di depan";

    const wavBuffer = await generateWavTts(text);

    return new Response(wavBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wavBuffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("TTS GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = body.text || "Ada objek di depan";

    const wavBuffer = await generateWavTts(text);

    return new Response(wavBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wavBuffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("TTS POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
