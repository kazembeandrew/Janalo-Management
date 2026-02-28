import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Camera, Upload, X, Check, Scissors, RotateCw, Maximize } from 'lucide-react';
import { getCroppedImg } from '../utils/image';

interface DocumentUploadProps {
  label: string;
  onUpload: (blob: Blob) => void;
  onRemove: () => void;
  existingUrl?: string | null;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ label, onUpload, onRemove, existingUrl }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [isCropping, setIsCropping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY || '');

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      setRotation(0);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setIsCropping(true);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Initialize crop to 90% of the image, centered
    const initialCrop: Crop = {
      unit: '%',
      x: 5,
      y: 5,
      width: 90,
      height: 90
    };
    
    setCrop(initialCrop);
  };

  const handleSaveCrop = async () => {
    if (completedCrop && imgRef.current) {
        setIsProcessing(true);
        try {
            const image = imgRef.current;
            
            // Calculate scale factors relative to natural dimensions
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            const scaledCrop: PixelCrop = {
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY,
                unit: 'px',
            };

            // Pass rotation to the utility which will handle it
            const blob = await getCroppedImg(imgSrc, scaledCrop, rotation);
            if (blob) {
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                onUpload(blob);
                setImgSrc('');
                setIsCropping(false);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to process image. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    } else {
        setImgSrc('');
        setIsCropping(false);
    }
  };

  const handleCancel = () => {
    setImgSrc('');
    setIsCropping(false);
  };

  const handleAutoCrop = async () => {
    if (!imgSrc) return;
    setIsProcessing(true);
    try {
      const base64 = imgSrc.split(',')[1];
      const mimeType = imgSrc.split(':')[1].split(';')[0];
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = "Analyze this image and provide crop coordinates for the main document in percentages: x, y, width, height. Format: x:10, y:10, width:80, height:60. If the document is rotated, suggest the rotation in degrees (0, 90, 180, 270).";
      const imagePart = {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      };
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      const cropMatch = text.match(/x:(\d+),\s*y:(\d+),\s*width:(\d+),\s*height:(\d+)/);
      const rotMatch = text.match(/rotation:(\d+)/);

      if (cropMatch) {
        const x = parseInt(cropMatch[1]);
        const y = parseInt(cropMatch[2]);
        const width = parseInt(cropMatch[3]);
        const height = parseInt(cropMatch[4]);
        setCrop({ unit: '%', x, y, width, height });
      }
      
      if (rotMatch) {
        setRotation(parseInt(rotMatch[1]));
      }
      
      if (!cropMatch && !rotMatch) {
        alert("Could not detect document area automatically. Please adjust manually.");
      }
    } catch (error) {
      console.error("Auto crop failed:", error);
      alert("Auto crop failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setImgSrc('');
    onRemove();
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
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
                        capture="environment"
                        className="sr-only" 
                        aria-label="Upload or take photo"
                        onChange={onSelectFile}
                    />
                </div>
                <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
            </div>
         </div>
      )}

      {isCropping && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black bg-opacity-95 p-4 overflow-hidden">
          <div className="flex justify-between items-center text-white mb-4">
            <h3 className="text-lg font-bold flex items-center"><Scissors className="mr-2"/> Edit Document</h3>
            <button onClick={handleCancel} className="p-2 hover:bg-white/10 rounded-full" aria-label="Cancel cropping"><X className="h-6 w-6"/></button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            <div style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}>
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    className="max-h-[60vh] max-w-full w-auto object-contain"
                  />
                </ReactCrop>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:flex sm:justify-center gap-3 pb-4">
            <button 
              type="button"
              onClick={rotate}
              className="flex items-center justify-center px-4 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600"
            >
              <RotateCw className="mr-2 h-4 w-4" /> Rotate
            </button>
            <button 
              type="button"
              onClick={handleAutoCrop}
              disabled={isProcessing}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Maximize className="mr-2 h-4 w-4" /> Auto Detect
            </button>
            <button 
              type="button"
              onClick={handleSaveCrop}
              disabled={isProcessing}
              className="col-span-2 sm:col-auto flex items-center justify-center px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-500"
            >
              {isProcessing ? 'Processing...' : (
                <><Check className="mr-2" /> Save & Use</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
          <div className="relative mt-2 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain bg-gray-200" />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1.5 text-center font-medium">
                  Document Ready
              </div>
          </div>
      )}
    </div>
  );
};
