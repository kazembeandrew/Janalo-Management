import { PixelCrop } from 'react-image-crop';

// Config for image optimization
const TARGET_MAX_SIZE = 500 * 1024; // 500KB
// We start with parameters that favor quality (targeting ~300-500kb for complex images)
const INITIAL_MAX_DIMENSION = 1600; 

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = getRadianAngle(rotation);

  // 1. Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // 2. Set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // 3. Translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // 4. Draw rotated image onto the temporary canvas
  ctx.drawImage(image, 0, 0);

  // 5. Optimization Loop
  // We define initial target dimensions based on the crop
  let width = pixelCrop.width;
  let height = pixelCrop.height;
  
  // Cap initial dimensions to avoid processing massive raw photos directly
  if (width > INITIAL_MAX_DIMENSION || height > INITIAL_MAX_DIMENSION) {
    const ratio = width / height;
    if (width > height) {
      width = INITIAL_MAX_DIMENSION;
      height = Math.round(INITIAL_MAX_DIMENSION / ratio);
    } else {
      height = INITIAL_MAX_DIMENSION;
      width = Math.round(INITIAL_MAX_DIMENSION * ratio);
    }
  }

  let quality = 0.95; // Start with high quality
  let blob: Blob | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
      // Create a canvas for this attempt
      const attemptCanvas = document.createElement('canvas');
      attemptCanvas.width = width;
      attemptCanvas.height = height;
      const attemptCtx = attemptCanvas.getContext('2d');

      if (!attemptCtx) break;

      // Draw the cropped portion from the rotated source canvas to the attempt canvas
      // This automatically handles resizing if width/height changed in previous loop
      attemptCtx.drawImage(
          canvas,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          width,
          height
      );

      // Convert to blob
      blob = await new Promise((resolve) => {
          attemptCanvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      });

      if (!blob) break;

      // Logic: 
      // 1. If size is <= 500KB, we accept it. 
      //    (Note: If it is naturally < 100KB at Max Res + High Quality, we accept it as is 
      //     because upscaling or inflating file size adds no value).
      // 2. If size > 500KB, we compress or resize and try again.

      if (blob.size <= TARGET_MAX_SIZE) {
          break; // Success
      }

      attempts++;
      
      // Strategy: Drop quality first, then dimensions
      if (quality > 0.7) {
          quality -= 0.15;
      } else if (quality > 0.5) {
          quality -= 0.1;
      } else {
          // If quality is already reasonable/low, reduce dimensions
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
      }
      
      // Safety bottom
      if (width < 300 || quality < 0.3) break; 
  }

  return blob;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

// Returns the new bounding area of a rotated rectangle
function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}