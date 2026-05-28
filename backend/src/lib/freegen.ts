const BASE_URL = "https://image.pollinations.ai/prompt";

/** Generates an image from a text prompt via Pollinations.ai. Returns the image as a Buffer. */
export async function generateImage(
  prompt: string,
  _ratioId = "9:16",
): Promise<{ imageBuffer: Buffer; imageUrl: string }> {
  const imageUrl = `${BASE_URL}/${encodeURIComponent(prompt)}?width=720&height=1280&nologo=true`;

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Pollinations error: ${res.status}`);

  const imageBuffer = Buffer.from(await res.arrayBuffer());
  return { imageBuffer, imageUrl };
}
