import { MPEGDecoder } from "mpg123-decoder";

export async function generateWavTts(text: string): Promise<Buffer> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("Text cannot be empty");
  }

  const encoded = encodeURIComponent(cleanText);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encoded}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`TTS Fetch Failed: ${res.status}`);
  }

  const mp3Buf = Buffer.from(await res.arrayBuffer());

  const decoder = new MPEGDecoder();
  await decoder.ready;
  const { channelData, sampleRate } = decoder.decode(mp3Buf);

  if (!channelData || channelData.length === 0 || channelData[0].length === 0) {
    throw new Error("Failed to decode MP3 audio");
  }

  // Mono channel 0
  const samples = channelData[0];
  const pcmBytes = Buffer.alloc(samples.length * 2);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcmBytes.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2);
  }

  // Standard 44-byte WAV header
  const wavHeader = Buffer.alloc(44);
  const totalDataLen = pcmBytes.length;
  const totalChunkLen = totalDataLen + 36;
  const byteRate = sampleRate * 1 * 2; // mono 16-bit

  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(totalChunkLen, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM format
  wavHeader.writeUInt16LE(1, 22); // mono
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(2, 32); // block align
  wavHeader.writeUInt16LE(16, 34); // bits per sample
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(totalDataLen, 40);

  decoder.free();
  return Buffer.concat([wavHeader, pcmBytes]);
}
