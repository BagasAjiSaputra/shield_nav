import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    let imageBuffer: Buffer | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("image") || formData.get("file");
      if (file && typeof file !== "string") {
        const bytes = await file.arrayBuffer();
        imageBuffer = Buffer.from(bytes);
      }
    } else {
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        imageBuffer = Buffer.from(arrayBuffer);
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data gambar yang diterima" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY tidak ditemukan di .env, mengembalikan fallback");
      return NextResponse.json({
        object: "ada_objek",
        description: "Ada objek di depan",
        confidence: 0.8,
      });
    }

    const base64Image = imageBuffer.toString("base64");
    const prompt = `Anda adalah sistem kecerdasan buatan navigasi visual SHIELD NAV untuk tunanetra.
Analisis foto ini yang diambil dari kamera kacamata pengguna.
Tugas Anda:
1. Identifikasi objek utama, rintangan, perkakas, manusia, atau benda yang ada tepat di depan kamera.
2. Meskipun pencahayaan ruangan agak gelap, redup, atau remang-remang, analisa siluet, bentuk, tekstur, dan kontur untuk mengenali benda (contoh: orang, laptop, layar monitor/hp, meja, kursi, botol, tangan, pintu, tangga, tiang, dinding, buku, lemari, dll).
3. Jika terlihat orang/manusia, sebutkan 'orang'.
4. Jika terlihat mobil, sebutkan 'mobil'.
5. Jika terlihat motor, sebutkan 'motor'.
6. Jika jalanan atau ruangan di depan benar-benar lapang dan kosong tanpa halangan, sebutkan 'aman'.
7. Untuk benda lain yang dikenali, sebutkan nama bendanya dalam 1-2 kata Bahasa Indonesia sederhana dan umum (misal: 'laptop', 'meja', 'kursi', 'botol', 'pintu', 'tangga', 'layar').
8. HANYA jika gambar benar-benar 100% hitam pekat atau rusak tanpa informasi visual apa pun, sebutkan 'tidak_dikenali'.

Wajib berikan respons HANYA dalam format JSON valid tanpa format markdown:
{
  "object": "nama_objek",
  "description": "penjelasan singkat posisi atau kondisi objek dalam bahasa Indonesia",
  "confidence": 0.95
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
                  mime_type: "image/jpeg",
                  data: base64Image,
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
      console.error("Gemini API Error:", errText);
      return NextResponse.json({
        object: "ada_objek",
        description: "Ada objek di depan (fallback)",
        confidence: 0.7,
      });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json({
        object: "ada_objek",
        description: "Ada objek di depan",
        confidence: 0.7,
      });
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

    console.log("[SERVER /detect_object] Hasil:", resultJson);
    return NextResponse.json(resultJson);
  } catch (err: any) {
    console.error("Error pada /detect_object:", err);
    return NextResponse.json(
      { object: "ada_objek", description: "Ada objek di depan", error: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    endpoint: "/detect_object",
    service: "SHIELD NAV Object Detection API",
  });
}

