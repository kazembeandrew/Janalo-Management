import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, Search, Download, FileSpreadsheet, Loader2, Filter } from 'lucide-react';

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
                // Filter out completely empty rows
                const validRows = jsonData.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
                if (validRows.length > 0) {
                    setHeaders(validRows[0] as string[]);
                    setData(validRows.slice(1));
                }
            }
        } catch (error) {
            console.error("Error parsing Excel:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(row => 
        row.some((cell: any) => String(cell || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <div className="p-2 bg-white/10 rounded-lg mr-3">
                            <FileSpreadsheet className="h-5 w-5 text-indigo-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm truncate max-w-[200px] sm:max-w-md">{fileName}</h3>
                            <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-widest">Spreadsheet Preview</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-300" />
                            <input 
                                type="text" 
                                placeholder="Search rows..." 
                                className="bg-white/10 border-none rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-500 w-48 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <X className="h-5 w-5 text-indigo-300" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-gray-50 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Parsing Spreadsheet...</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <FileSpreadsheet className="h-12 w-12 mb-2 opacity-20" />
                            <p className="text-sm font-medium">No data found in this sheet.</p>
                        </div>
                    ) : (
                        <div className="min-w-full inline-block align-middle">
                            <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                                <thead className="bg-white sticky top-0 z-10">
                                    <tr>
                                        {headers.map((h, i) => (
                                            <th key={i} className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm">
                                                {h || `Column ${i + 1}`}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan={headers.length} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                                                No rows match your search criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((row, i) => (
                                            <tr key={i} className="hover:bg-indigo-50/50 transition-colors group">
                                                {headers.map((_, j) => (
                                                    <td key={j} className="px-6 py-3 text-xs text-gray-600 whitespace-nowrap border-b border-gray-50">
                                                        {row[j] !== undefined && row[j] !== null ? String(row[j]) : <span className="text-gray-300">-</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Showing {filteredData.length} of {data.length} rows
                        </p>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-[10px] font-bold text-indigo-600 uppercase hover:underline">Clear Search</button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="sm:hidden relative">
                            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Filter..." 
                                className="bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 w-32"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <a 
                            href={url} 
                            download={fileName}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                        >
                            <Download className="h-3.5 w-3.5" /> Download Original
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};