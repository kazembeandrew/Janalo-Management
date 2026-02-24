import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, Search, Download, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ExcelViewerProps {
    url: string;
    fileName: string;
    onClose: () => void;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ url, fileName, onClose }) => {
    const [data, setData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchExcel();
    }, [url]);

    const fetchExcel = async () => {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            if (jsonData.length > 0) {
                setHeaders(jsonData[0] as string[]);
                setData(jsonData.slice(1));
            }
        } catch (error) {
            console.error("Error parsing Excel:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(row => 
        row.some((cell: any) => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <FileSpreadsheet className="h-5 w-5 text-indigo-300 mr-3" />
                        <div>
                            <h3 className="font-bold text-white text-sm">{fileName}</h3>
                            <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-widest">Excel Data Preview</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-300" />
                            <input 
                                type="text" 
                                placeholder="Search rows..." 
                                className="bg-white/10 border-none rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-500 w-48"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="h-5 w-5 text-indigo-300" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-gray-50 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-2" />
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Parsing Spreadsheet...</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {headers.map((h, i) => (
                                        <th key={i} className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredData.map((row, i) => (
                                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                        {headers.map((_, j) => (
                                            <td key={j} className="px-6 py-3 text-xs text-gray-600 whitespace-nowrap">
                                                {row[j] !== undefined ? String(row[j]) : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Showing {filteredData.length} of {data.length} rows
                    </p>
                    <a 
                        href={url} 
                        download={fileName}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        <Download className="h-3.5 w-3.5" /> Download Original
                    </a>
                </div>
            </div>
        </div>
    );
};