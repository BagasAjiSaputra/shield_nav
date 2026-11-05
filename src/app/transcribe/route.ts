import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    let audioBuffer: Buffer | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("audio") || formData.get("file");
      if (file && typeof file !== "string") {
        const bytes = await file.arrayBuffer();
        audioBuffer = Buffer.from(bytes);
      }
    } else {
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        audioBuffer = Buffer.from(arrayBuffer);
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data audio yang diterima" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY tidak ditemukan di .env");
      return NextResponse.json({
        text: "Suara Masuk (Offline)",
      });
    }

    const base64Audio = audioBuffer.toString("base64");
    const prompt = `Transkripsikan rekaman audio ini persis apa adanya ke dalam teks kalimat bahasa Indonesia.
Jika rekaman hanya hening/noise tanpa ada yang berbicara, berikan: "Hening / Tidak Ada Suara".
Wajib berikan respons HANYA dalam format JSON valid tanpa format markdown:
{
  "text": "kalimat ucapan yang diucapkan pengguna"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: "audio/wav",
                  data: base64Audio,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Audio Error:", errText);
      return NextResponse.json({
        text: "Suara Masuk",
      });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json({ text: "Suara Masuk" });
    }

    let resultJson: any;
    try {
      resultJson = JSON.parse(candidateText);
    } catch {
      const cleaned = candidateText.replace(/```json/g, "").replace(/```/g, "").trim();
      resultJson = JSON.parse(cleaned);
    }

    if (Array.isArray(resultJson) && resultJson.length > 0) {
      resultJson = resultJson[0];
    }

    console.log("[SERVER /transcribe] Hasil:", resultJson);
    return NextResponse.json(resultJson);
  } catch (err: any) {
    console.error("Error pada /transcribe:", err);
    return NextResponse.json(
      { text: "Suara Masuk", error: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    endpoint: "/transcribe",
    service: "SHIELD NAV Speech-to-Text API",
  });
}

