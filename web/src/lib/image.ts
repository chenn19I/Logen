export const MAX_ARTWORK_BYTES = 8 * 1024 * 1024;
export const MAX_ARTWORK_EDGE = 1200;

export interface SeatArtwork {
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
  originalBytes: number;
}

function isAllowed(file: File): boolean {
  if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

async function loadDrawable(
  file: File
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path for browsers with partial support.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be read."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Turns a user-selected file into a bounded data URL. Resizing keeps the
 * portrait usable in localStorage and keeps the mint page fast on mobile.
 */
export async function fileToSeatArtwork(file: File): Promise<SeatArtwork> {
  if (!isAllowed(file)) {
    throw new Error("Use a PNG, JPEG or WebP image.");
  }
  if (file.size > MAX_ARTWORK_BYTES) {
    throw new Error("That image is over 8 MB. Choose a smaller file.");
  }

  const drawable = await loadDrawable(file);
  const sourceWidth =
    drawable instanceof HTMLImageElement
      ? drawable.naturalWidth
      : drawable.width;
  const sourceHeight =
    drawable instanceof HTMLImageElement
      ? drawable.naturalHeight
      : drawable.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("This image has no readable pixels.");
  }

  const scale = Math.min(
    1,
    MAX_ARTWORK_EDGE / Math.max(sourceWidth, sourceHeight)
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot prepare the image.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(drawable, 0, 0, width, height);

  if (drawable instanceof ImageBitmap) {
    drawable.close();
  }

  let dataUrl = canvas.toDataURL("image/webp", 0.86);
  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/png");
  }

  return {
    dataUrl,
    fileName: file.name,
    width,
    height,
    originalBytes: file.size,
  };
}
