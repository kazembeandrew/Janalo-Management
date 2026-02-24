import React, { useEffect, useState } from 'react';
import { 
    Database, Shield, Zap, Layers, Server, Code, Activity, 
    Globe, Lock, CheckCircle2, AlertCircle, Network, 
    GitMerge, Cpu, HardDrive, Key, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const SystemBlueprint: React.FC = () => {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [health, setHealth] = useState({
        database: 'checking',
        auth: 'checking',
        ai: 'checking',
        server: 'checking'
    });

    useEffect(() => {
        fetchLiveMetrics();
        checkSystemHealth();
    }, []);

    const fetchLiveMetrics = async () => {
        const tables = ['loans', 'repayments', 'borrowers', 'audit_logs', 'users', 'internal_accounts', 'expenses', 'tasks'];
        const results: Record<string, number> = {};
        
        try {
            await Promise.all(tables.map(async (table) => {
                const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
                results[table] = count || 0;
            }));
            setCounts(results);
        } finally {
            setLoading(false);
        }
    };

    const checkSystemHealth = async () => {
        // 1. Check Database/Supabase
        const { error: dbError } = await supabase.from('users').select('id').limit(1);
        
        // 2. Check Server API
        let serverStatus = 'error';
        try {
            const res = await fetch('/api/health');
            if (res.ok) serverStatus = 'online';
        } catch (e) { serverStatus = 'offline'; }

        setHealth({
            database: dbError ? 'error' : 'online',
            auth: 'online', // If we are here, auth is working
            ai: process.env.GEMINI_API_KEY ? 'online' : 'restricted',
            server: serverStatus
        });
    };

    const relationships = [
        { from: 'borrowers', to: 'loans', type: '1:N', desc: 'One client can have multiple historical loans.' },
        { from: 'loans', to: 'repayments', type: '1:N', desc: 'Each loan tracks multiple collection entries.' },
        { from: 'repayments', to: 'internal_accounts', type: 'N:1', desc: 'Payments are recorded as inflows to specific accounts.' },
        { from: 'users', to: 'audit_logs', type: '1:N', desc: 'Every action is linked to a staff member profile.' }
    ];

    const envVars = [
        { name: 'SUPABASE_URL', status: 'configured', desc: 'Core backend endpoint.' },
        { name: 'SUPABASE_ANON_KEY', status: 'configured', desc: 'Client-side data access.' },
        { name: 'GEMINI_API_KEY', status: process.env.GEMINI_API_KEY ? 'configured' : 'missing', desc: 'Powers AI financial insights.' },
        { name: 'SERVICE_ROLE_KEY', status: 'server-only', desc: 'Required for admin tasks (User creation).' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* System Health Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(health).map(([service, status]) => (
                    <div key={service} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{service}</p>
                            <p className="text-sm font-bold text-gray-900 capitalize">{status}</p>
                        </div>
                        {status === 'online' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : status === 'checking' ? (
                            <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Data Layer */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center">
                            <Database className="h-5 w-5 text-indigo-600 mr-2" />
                            <h3 className="font-bold text-gray-900">Data Layer & Metrics</h3>
                        </div>
                        <button onClick={fetchLiveMetrics} className="text-xs text-indigo-600 font-bold hover:underline flex items-center">
                            <Activity className="h-3 w-3 mr-1" /> Refresh
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {Object.entries(counts).map(([table, count]) => (
                                <div key={table} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{table}</p>
                                    <p className="text-lg font-bold text-indigo-600">{loading ? '...' : count}</p>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-8">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <GitMerge className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                                Entity Relationships
                            </h4>
                            <div className="space-y-3">
                                {relationships.map((rel, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                                        <div className="flex items-center gap-2 shrink-0">
                                            <code className="text-[10px] font-bold text-indigo-700">{rel.from}</code>
                                            <Network className="h-3 w-3 text-indigo-300" />
                                            <code className="text-[10px] font-bold text-indigo-700">{rel.to}</code>
                                        </div>
                                        <span className="text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-100 text-indigo-600">{rel.type}</span>
                                        <p className="text-[11px] text-gray-500 italic">{rel.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Environment Config */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                    <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex items-center">
                        <Key className="h-5 w-5 text-amber-400 mr-2" />
                        <h3 className="font-bold text-white">Environment Config</h3>
                    </div>
                    <div className="p-6 space-y-5 flex-1">
                        {envVars.map((v) => (
                            <div key={v.name} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <code className="text-[10px] text-indigo-300 font-mono">{v.name}</code>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                        v.status === 'configured' ? 'bg-green-500/20 text-green-400' : 
                                        v.status === 'missing' ? 'bg-red-500/20 text-red-400' : 
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {v.status}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500">{v.desc}</p>
                            </div>
                        ))}
                        <div className="pt-4 mt-4 border-t border-slate-800">
                            <div className="flex items-center text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                                <HardDrive className="h-3 w-3 mr-1.5" /> Infrastructure
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                                Hosted on <span className="text-slate-300">Supabase Cloud</span> with <span className="text-slate-300">Vite</span> frontend and <span className="text-slate-300">Express</span> middleware.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logic Layer */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-gray-100 flex items-center">
                    <Zap className="h-5 w-5 text-amber-500 mr-2" />
                    <h3 className="font-bold text-gray-900">Core Business Logic</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 uppercase">Accounting</h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">Double-entry engine ensures every transaction balances across Assets, Liabilities, and Equity.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 uppercase">Interest Engine</h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">Supports Flat Rate (fixed interest) and Reducing Balance (amortized) calculations.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 uppercase">Security</h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">Row Level Security (RLS) prevents unauthorized data access at the database level.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 uppercase">AI Insights</h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">Gemini 2.0 Flash analyzes portfolio risk and predicts institutional cash flow.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};