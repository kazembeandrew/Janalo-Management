import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Camera, Upload, X, Check, Scissors } from 'lucide-react';
import { getCroppedImg } from '@/utils/image';

interface DocumentUploadProps {
  label: string;
  onUpload: (blob: Blob) => void;
  onRemove: () => void;
  existingUrl?: string | null;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ label, onUpload, onRemove, existingUrl }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setIsCropping(true);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Default to a somewhat central crop if needed, or just let user select
    setCrop(centerAspectCrop(width, height, 16 / 9));
  };

  const handleSaveCrop = async () => {
    if (completedCrop && imgRef.current) {
        setIsProcessing(true);
        try {
            // Calculate scale factors because the displayed image might be smaller than the actual image
            const image = imgRef.current;
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            // Apply scale to the crop coordinates
            const scaledCrop: PixelCrop = {
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY,
                unit: 'px',
            };

            const blob = await getCroppedImg(imgSrc, scaledCrop);
            if (blob) {
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                onUpload(blob);
                setIsCropping(false);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to crop image");
        } finally {
            setIsProcessing(false);
        }
    } else {
        setIsCropping(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setImgSrc('');
    onRemove();
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {previewUrl && (
            <button type="button" onClick={handleRemove} className="text-red-500 hover:text-red-700 text-xs flex items-center">
                <X className="h-3 w-3 mr-1" /> Remove
            </button>
        )}
      </div>

      {!previewUrl && !isCropping && (
         <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-white hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="space-y-1 text-center">
                <Camera className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 justify-center">
                    <span className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                        Upload or Take Photo
                    </span>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        capture="environment" // Hints mobile to use rear camera
                        className="sr-only" 
                        onChange={onSelectFile}
                    />
                </div>
                <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
            </div>
         </div>
      )}

      {/* Cropping Modal / Overlay */}
      {isCropping && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black bg-opacity-90 p-4 overflow-auto">
             <div className="flex justify-between items-center text-white mb-4">
                 <h3 className="text-lg font-bold flex items-center"><Scissors className="mr-2"/> Crop & Compress</h3>
                 <button onClick={() => setIsCropping(false)} className="p-2"><X className="h-6 w-6"/></button>
             </div>
             
             <div className="flex-1 flex items-center justify-center p-4">
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                >
                    <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imgSrc}
                        onLoad={onImageLoad}
                        className="max-h-[70vh] max-w-full w-auto object-contain"
                    />
                </ReactCrop>
             </div>

             <div className="mt-4 flex justify-center pb-4">
                 <button 
                    type="button"
                    onClick={handleSaveCrop}
                    disabled={isProcessing}
                    className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-500"
                 >
                     {isProcessing ? 'Optimizing...' : (
                        <><Check className="mr-2" /> Use Image</>
                     )}
                 </button>
             </div>
          </div>
      )}

      {/* Preview */}
      {previewUrl && (
          <div className="relative mt-2 rounded-lg overflow-hidden border border-gray-200">
              <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                  Ready to upload
              </div>
          </div>
      )}
    </div>
  );
};