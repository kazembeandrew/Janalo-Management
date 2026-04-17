import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { querySystemAI } from '@/services/aiService';
import { Sparkles, Send, Bot, User, RefreshCw, AlertCircle, Terminal, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import toast from 'react-hot-toast';

export const SystemAIChat: React.FC = () => {
    const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const getSystemContext = async () => {
        // Gather a snapshot of the system for the AI
        const [
            { data: stats },
            { data: logs },
            { data: tasks },
            { data: accounts }
        ] = await Promise.all([
            supabase.rpc('get_dashboard_stats'),
            supabase.from('audit_logs').select('action, entity_type, details, created_at').order('created_at', { ascending: false }).limit(15),
            supabase.from('tasks').select('title, status, priority').neq('status', 'completed'),
            supabase.from('internal_accounts').select('name, balance, account_code')
        ]);

        return {
            stats,
            recent_audit_logs: logs,
            active_tasks: tasks,
            liquidity_summary: accounts
        };
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userQuery = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
        setIsLoading(true);

        try {
            const context = await getSystemContext();
            const response = await querySystemAI(userQuery, context);
            setMessages(prev => [...prev, { role: 'ai', content: response }]);
        } catch (error) {
            toast.error("AI failed to respond");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[600px]">
            <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center">
                    <div className="p-2 bg-indigo-500/20 rounded-lg mr-3">
                        <Sparkles className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">System Architect AI</h3>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Full System Context Enabled</p>
                    </div>
                </div>
                <button 
                    onClick={() => setMessages([])}
                    className="text-slate-500 hover:text-white transition-colors"
                    title="Clear Chat"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                        <Bot className="h-12 w-12 text-indigo-400" />
                        <div className="max-w-xs">
                            <p className="text-sm text-slate-300 font-medium">How can I help you optimize Janalo today?</p>
                            <div className="mt-4 grid grid-cols-1 gap-2">
                                <button onClick={() => setInput("Analyze recent audit logs for any errors or anomalies.")} className="text-[10px] bg-slate-800 text-slate-300 p-2 rounded-lg hover:bg-slate-700 transition-all text-left flex items-center">
                                    <ChevronRight className="h-3 w-3 mr-1" /> Check for system errors
                                </button>
                                <button onClick={() => setInput("Suggest 3 ways to improve our collection efficiency based on current stats.")} className="text-[10px] bg-slate-800 text-slate-300 p-2 rounded-lg hover:bg-slate-700 transition-all text-left flex items-center">
                                    <ChevronRight className="h-3 w-3 mr-1" /> Improve collection efficiency
                                </button>
                                <button onClick={() => setInput("Review our liquidity and suggest if we can disburse more loans.")} className="text-[10px] bg-slate-800 text-slate-300 p-2 rounded-lg hover:bg-slate-700 transition-all text-left flex items-center">
                                    <ChevronRight className="h-3 w-3 mr-1" /> Liquidity analysis
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800 border border-slate-700'}`}>
                                {msg.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-indigo-400" />}
                            </div>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                            }`}>
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <Markdown>
                                        {msg.content}
                                    </Markdown>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="flex gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-indigo-400" />
                            </div>
                            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analyzing System...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-800/30 border-t border-slate-800">
                <form onSubmit={handleSend} className="flex gap-3">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about system health, errors, or improvements..."
                        className="flex-1 bg-slate-900 border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <button 
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </form>
                <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <span className="flex items-center"><Terminal className="h-3 w-3 mr-1" /> Logs Analyzed</span>
                    <span className="flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Error Detection</span>
                </div>
            </div>
        </div>
    );
};