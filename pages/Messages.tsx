import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User, ArrowRight, Clock, Send, Hash, Activity, Paperclip, File, X, Image as ImageIcon, Loader, FileText } from 'lucide-react';
import { DirectMessage, UserProfile } from '../types';

interface InboxItem {
  id: string;
  content: string;
  created_at: string;
  is_system: boolean;
  users: {
    full_name: string;
  };
  loan_id: string;
  loans: {
    borrowers: {
      full_name: string;
    };
    status: string;
  };
}

export const Messages: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'activity'>('chat');

  // --- ACTIVITY LOG STATE ---
  const [activityMessages, setActivityMessages] = useState<InboxItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // --- CHAT STATE ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<UserProfile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatLoading, setChatLoading] = useState(false);
  
  // --- ATTACHMENT STATE ---
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'activity') {
        fetchActivity();
    } else {
        fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeTab]);

  // --- ACTIVITY LOG LOGIC ---
  const fetchActivity = async () => {
    if (!profile) return;
    setActivityLoading(true);
    try {
      let query = supabase
        .from('loan_notes')
        .select(`
          id,
          content,
          created_at,
          is_system,
          user_id,
          users (full_name),
          loan_id,
          loans!inner (
            id,
            officer_id,
            status,
            borrowers (full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (profile.role === 'loan_officer') {
        query = query.eq('loans.officer_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setActivityMessages(data as any[] || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  // --- CHAT LOGIC ---
  const fetchUsers = async () => {
      if(!profile) return;
      try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .neq('id', profile.id) // Exclude self
            .order('full_name');
          
          if(error) throw error;
          setUsers(data as UserProfile[]);
      } catch (error) {
          console.error("Error fetching users", error);
      }
  };

  const handleSelectUser = async (user: UserProfile) => {
      setActiveRecipient(user);
      setChatHistory([]);
      setChatLoading(true);
      setAttachment(null);
      setUploadProgress(0);
      
      // Find existing conversation between me and this user
      const { data: myConvos } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', profile?.id);
      const myConvoIds = myConvos?.map(c => c.conversation_id) || [];
      
      if (myConvoIds.length > 0) {
          const { data: targetConvos } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', user.id)
            .in('conversation_id', myConvoIds);
          
          if (targetConvos && targetConvos.length > 0) {
              const cid = targetConvos[0].conversation_id;
              setConversationId(cid);
              fetchChatHistory(cid);
              return;
          }
      }
      
      // No conversation exists yet
      setConversationId(null);
      setChatLoading(false);
  };

  const fetchChatHistory = async (cid: string) => {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true });
      
      setChatHistory(data || []);
      setChatLoading(false);
      scrollToBottom();
  };

  const scrollToBottom = () => {
      setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  };

  // Real-time Subscription
  useEffect(() => {
      if (!conversationId) return;

      const channel = supabase
        .channel(`chat:${conversationId}`)
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` },
            (payload) => {
                const newMsg = payload.new as DirectMessage;
                setChatHistory(prev => {
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
                scrollToBottom();
            }
        )
        .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [conversationId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setAttachment(e.target.files[0]);
          setUploadProgress(0);
      }
  };

  const simulateUploadProgress = async () => {
    // Simulate progress steps: 0 -> 20 -> 50 -> 80 -> 100
    setUploadProgress(10);
    await new Promise(r => setTimeout(r, 200));
    setUploadProgress(30);
    await new Promise(r => setTimeout(r, 300));
    setUploadProgress(60);
    await new Promise(r => setTimeout(r, 300));
    setUploadProgress(90);
    await new Promise(r => setTimeout(r, 200));
  };

  const uploadAttachment = async (file: File, cid: string): Promise<string> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${cid}/${fileName}`;
      
      // Run visual simulation
      await simulateUploadProgress();

      const { error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file);
      
      if (error) throw error;
      setUploadProgress(100);
      return filePath;
  };

  const getAttachmentUrl = (path: string) => {
      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      return data.publicUrl;
  }

  // UUID Generator Polyfill
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!newMessage.trim() && !attachment) || !profile || !activeRecipient) return;
      
      setIsUploading(true);

      try {
          let cid = conversationId;

          // Create conversation if it doesn't exist on first message
          // Use client-generated ID to avoid RLS 'select' recursion on insert
          if (!cid) {
              cid = generateUUID();
              
              // 1. Insert Conversation
              const { error: convError } = await supabase.from('conversations').insert({ id: cid });
              if (convError) throw convError;

              // 2. Insert Participants (Batch if possible, or sequential)
              const { error: partError } = await supabase.from('conversation_participants').insert([
                  { conversation_id: cid, user_id: profile.id },
                  { conversation_id: cid, user_id: activeRecipient.id }
              ]);
              if (partError) throw partError;
              
              setConversationId(cid);
          }

          let attachmentPath = null;
          let attachmentName = null;
          let attachmentType = null;

          if (attachment) {
              attachmentPath = await uploadAttachment(attachment, cid);
              attachmentName = attachment.name;
              attachmentType = attachment.type.startsWith('image/') ? 'image' : 'file'; 
          }

          const { error } = await supabase.from('direct_messages').insert({
              conversation_id: cid,
              sender_id: profile.id,
              content: newMessage.trim(),
              // @ts-ignore
              attachment_path: attachmentPath,
              // @ts-ignore
              attachment_name: attachmentName,
              // @ts-ignore
              attachment_type: attachmentType
          });

          if (error) throw error;
          setNewMessage('');
          setAttachment(null);
          setUploadProgress(0);
          
          // Force fetch if it was a new conversation to ensure local state sync
          if (!conversationId && cid) {
              fetchChatHistory(cid); 
          }

      } catch (error: any) {
          console.error("Send failed", error);
          alert(`Failed to send message: ${error.message || 'Unknown error'}`);
      } finally {
          setIsUploading(false);
          setUploadProgress(0);
      }
  };

  const getInitials = (name: string | null | undefined) => {
      return (name || '?').charAt(0).toUpperCase();
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            <p className="text-sm text-gray-500">Communications center</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex">
            <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'chat' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'
                }`}
            >
                <MessageSquare className="h-4 w-4 mr-2" /> Direct Chat
            </button>
            <button
                onClick={() => setActiveTab('activity')}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'activity' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'
                }`}
            >
                <Activity className="h-4 w-4 mr-2" /> Loan Activity
            </button>
        </div>
      </div>

      {activeTab === 'activity' ? (
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100 flex-1 overflow-y-auto">
            {activityLoading ? (
            <div className="p-8 text-center text-gray-500">Loading activity...</div>
            ) : activityMessages.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
                <div className="bg-gray-100 p-3 rounded-full mb-4">
                    <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium">No activity yet</h3>
                <p className="text-gray-500 text-sm mt-1">System notifications and notes will appear here.</p>
            </div>
            ) : (
            <ul className="divide-y divide-gray-200">
                {activityMessages.map((msg) => (
                <li key={msg.id} className="hover:bg-gray-50 transition-colors">
                    <div 
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => navigate(`/loans/${msg.loan_id}`)}
                    >
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center">
                            {msg.is_system ? (
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mr-2 font-medium">System</span>
                            ) : (
                                <div className="flex items-center mr-2">
                                    <User className="h-3 w-3 text-gray-400 mr-1" />
                                    <span className="text-xs font-bold text-gray-700">{msg.users?.full_name || 'Unknown User'}</span>
                                </div>
                            )}
                            <span className="text-sm text-gray-500">
                                referenced loan for <span className="font-medium text-gray-900">{msg.loans?.borrowers?.full_name || 'Unknown Borrower'}</span>
                            </span>
                        </div>
                        <div className="flex items-center text-xs text-gray-400">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(msg.created_at).toLocaleString()}
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <p className={`text-sm ${msg.is_system ? 'text-gray-500 italic' : 'text-gray-800'}`}>
                            {msg.content}
                        </p>
                        <ArrowRight className="h-4 w-4 text-gray-300 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </div>
      ) : (
          <div className="flex flex-1 bg-white shadow rounded-lg overflow-hidden border border-gray-200">
              {/* Users Sidebar */}
              <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
                  <div className="p-4 border-b border-gray-200">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Colleagues</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      {users.map(u => (
                          <div 
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`p-4 flex items-center cursor-pointer hover:bg-white transition-colors border-b border-gray-100 ${activeRecipient?.id === u.id ? 'bg-white border-l-4 border-l-indigo-600' : ''}`}
                          >
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3 shrink-0">
                                  {getInitials(u.full_name)}
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-gray-900">{u.full_name || 'Unknown User'}</p>
                                  <p className="text-xs text-gray-500 capitalize">{u.role?.replace('_', ' ')}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Chat Window */}
              <div className="w-2/3 flex flex-col bg-white">
                  {activeRecipient ? (
                      <>
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
                            <h3 className="font-bold text-gray-900 flex items-center">
                                <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                                {activeRecipient.full_name || 'Unknown User'}
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                            {chatLoading ? (
                                <div className="text-center text-gray-400 text-sm mt-10">Loading conversation...</div>
                            ) : chatHistory.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm mt-10">
                                    <Hash className="h-10 w-10 mx-auto mb-2 opacity-20"/>
                                    Start a conversation with {activeRecipient.full_name}
                                </div>
                            ) : (
                                chatHistory.map(msg => {
                                    const isMe = msg.sender_id === profile?.id;
                                    // @ts-ignore
                                    const hasAttachment = !!msg.attachment_path;
                                    // @ts-ignore
                                    const isImage = msg.attachment_type === 'image';
                                    
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-lg shadow-sm overflow-hidden ${
                                                isMe 
                                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                                            }`}>
                                                {hasAttachment && (
                                                    <div className="mb-2">
                                                        {isImage ? (
                                                            // @ts-ignore
                                                            <a href={getAttachmentUrl(msg.attachment_path)} target="_blank" rel="noreferrer">
                                                                <img 
                                                                    // @ts-ignore
                                                                    src={getAttachmentUrl(msg.attachment_path)} 
                                                                    alt="Attachment" 
                                                                    className="max-w-full h-auto rounded-sm cursor-pointer hover:opacity-90"
                                                                />
                                                            </a>
                                                        ) : (
                                                            // @ts-ignore
                                                            <a href={getAttachmentUrl(msg.attachment_path)} target="_blank" rel="noreferrer" className={`flex items-center p-3 rounded ${isMe ? 'bg-indigo-700' : 'bg-gray-100'} hover:opacity-80`}>
                                                                <div className={`p-2 rounded-full mr-3 ${isMe ? 'bg-indigo-600' : 'bg-white'}`}>
                                                                    <FileText className={`h-6 w-6 ${isMe ? 'text-white' : 'text-gray-500'}`} />
                                                                </div>
                                                                <div className="flex flex-col overflow-hidden">
                                                                    {/* @ts-ignore */}
                                                                    <span className="text-sm font-medium truncate max-w-[150px]">{msg.attachment_name || 'Attached File'}</span>
                                                                    <span className="text-xs opacity-75 uppercase">Document</span>
                                                                </div>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                {(msg.content || !hasAttachment) && (
                                                    <div className="px-4 py-2">
                                                        <p className="text-sm break-words">{msg.content}</p>
                                                    </div>
                                                )}
                                                
                                                <p className={`text-[10px] px-4 pb-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 bg-white border-t border-gray-200">
                             {/* Attachment Preview with Progress */}
                             {attachment && (
                                <div className="mb-3">
                                    <div className="flex items-center bg-gray-100 p-2 rounded-lg inline-block w-full max-w-sm">
                                        {attachment.type.startsWith('image/') ? (
                                            <ImageIcon className="h-4 w-4 text-gray-500 mr-2" />
                                        ) : (
                                            <File className="h-4 w-4 text-gray-500 mr-2" />
                                        )}
                                        <div className="flex-1 mr-2 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-700 truncate">{attachment.name}</span>
                                                <span className="text-xs text-gray-500 ml-2">{(attachment.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                            {isUploading && (
                                                <div className="w-full bg-gray-300 rounded-full h-1.5 mt-1">
                                                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                        {!isUploading && (
                                            <button onClick={() => setAttachment(null)} className="text-gray-500 hover:text-red-500">
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    {isUploading && (
                                        <p className="text-xs text-indigo-600 mt-1 font-medium animate-pulse">Uploading file... please wait.</p>
                                    )}
                                </div>
                             )}

                            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-100 mb-0.5"
                                    title="Attach File"
                                    disabled={isUploading}
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileSelect}
                                    disabled={isUploading}
                                />
                                
                                <textarea 
                                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none disabled:bg-gray-100"
                                    placeholder={isUploading ? "Uploading attachment..." : "Type a message..."}
                                    rows={1}
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage(e);
                                        }
                                    }}
                                    disabled={isUploading}
                                />
                                <button 
                                    type="submit"
                                    disabled={(!newMessage.trim() && !attachment) || isUploading}
                                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 mb-0.5 transition-colors"
                                >
                                    {isUploading ? <Loader className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                                </button>
                            </form>
                        </div>
                      </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                          <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                          <p>Select a colleague to start chatting</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};