import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText } from 'lucide-react';

interface PDFViewerProps {
    url: string;
    fileName: string;
    onClose: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, fileName, onClose }) => {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <FileText className="h-5 w-5 text-indigo-300 mr-3" />
                        <div>
                            <h3 className="font-bold text-white text-sm">{fileName}</h3>
                            <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-widest">PDF Document</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Zoom Controls */}
                        <button 
                            onClick={handleZoomOut}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-4 w-4 text-indigo-300" />
                        </button>
                        <span className="text-xs text-indigo-300 font-bold w-12 text-center">{zoom}%</span>
                        <button 
                            onClick={handleZoomIn}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="h-4 w-4 text-indigo-300" />
                        </button>
                        <div className="w-px h-6 bg-indigo-700 mx-2" />
                        {/* Rotate */}
                        <button 
                            onClick={handleRotate}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Rotate"
                        >
                            <RotateCw className="h-4 w-4 text-indigo-300" />
                        </button>
                        <div className="w-px h-6 bg-indigo-700 mx-2" />
                        {/* Download */}
                        <a 
                            href={url}
                            download={fileName}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Download"
                        >
                            <Download className="h-4 w-4 text-indigo-300" />
                        </a>
                        {/* Close */}
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-2"
                            title="Close"
                        >
                            <X className="h-5 w-5 text-indigo-300" />
                        </button>
                    </div>
                </div>

                {/* PDF Content */}
                <div className="flex-1 bg-gray-100 overflow-auto">
                    <iframe 
                        src={`${url}#zoom=${zoom / 100}`}
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                        style={{ 
                            transform: `rotate(${rotation}deg)`,
                            transformOrigin: 'center center'
                        }}
                    />
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Use controls above to zoom and rotate
                    </p>
                    <a 
                        href={url} 
                        download={fileName}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        <Download className="h-3.5 w-3.5" /> Download PDF
                    </a>
                </div>
            </div>
        </div>
    );
};
