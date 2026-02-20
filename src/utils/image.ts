import { PixelCrop } from 'react-image-crop';

const TARGET_MAX_SIZE = 500 * 1024; // 500KB
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
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  let width = pixelCrop.width;
  let height = pixelCrop.height;
  
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

  let quality = 0.95;
  let blob: Blob | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
      const attemptCanvas = document.createElement('canvas');
      attemptCanvas.width = width;
      attemptCanvas.height = height;
      const attemptCtx = attemptCanvas.getContext('2d');

      if (!attemptCtx) break;

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

      blob = await new Promise((resolve) => {
          attemptCanvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      });

      if (!blob) break;

      if (blob.size <= TARGET_MAX_SIZE) {
          break;
      }

      attempts++;
      
      if (quality > 0.7) {
          quality -= 0.15;
      } else if (quality > 0.5) {
          quality -= 0.1;
      } else {
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
      }
      
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

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);

  return {
    width:
      Math.abs(Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height)),
    height:
      Math.abs(Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height)),
  };
}