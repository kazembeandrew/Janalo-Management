import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { usePresence } from '@/context/PresenceContext';
import { Send, User, Search, MessageSquare, Plus, X, Check, ArrowLeft, Phone, Video, Info, UserPlus, ExternalLink, Paperclip, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface ConversationSummary {
  conversation_id: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  attachment_path?: string;
  attachment_name?: string;
  attachment_type?: string;
}

interface UserListItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface BorrowerListItem {
    id: string;
    full_name: string;
}

export const Messages: React.FC = () => {
  const { profile } = useAuth();
  const { onlineUsers } = usePresence();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Typing State
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Attachment State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showAttachClientModal, setShowAttachClientModal] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  // Data Lists
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [borrowers, setBorrowers] = useState<BorrowerListItem[]>([]);
  
  // Search States
  const [userSearch, setUserSearch] = useState('');
  const [convoSearch, setConvoSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('inbox-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedConvo) {
      fetchMessages(selectedConvo.conversation_id);
      markAsRead(selectedConvo.conversation_id);

      // Presence Channel for Typing Indicators
      const presenceChannel = supabase.channel(`typing-${selectedConvo.conversation_id}`, {
          config: { presence: { key: profile?.id } }
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const typing = new Set<string>();
            for (const key in state) {
                const presences = state[key] as any[];
                if (presences.some(p => p.is_typing && p.typing_to === selectedConvo.conversation_id)) {
                    if (key !== profile?.id) typing.add(key);
                }
            }
            setTypingUsers(typing);
        })
        .subscribe();

      const msgChannel = supabase
        .channel(`convo-${selectedConvo.conversation_id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'direct_messages',
            filter: `conversation_id=eq.${selectedConvo.conversation_id}`
        }, (payload) => {
            const newMsg = payload.new as Message;
            setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            markAsRead(selectedConvo.conversation_id);
            scrollToBottom();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(presenceChannel);
        supabase.removeChannel(msgChannel);
      };
    }
  }, [selectedConvo, profile]);

  const fetchConversations = async () => {
    const { data, error } = await supabase.rpc('get_my_conversations_details');
    if (!error) setConversations(data || []);
    setLoading(false);
  };

  const fetchMessages = async (convoId: string) => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });
    
    if (!error) {
        setMessages(data || []);
        scrollToBottom();
    }
  };

  const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .neq('id', profile?.id);
      
      if (!error) setUsers(data || []);
  };

  const fetchBorrowers = async () => {
      const { data, error } = await supabase
        .from('borrowers')
        .select('id, full_name')
        .order('full_name', { ascending: true });
      
      if (!error) setBorrowers(data || []);
  };

  const markAsRead = async (convoId: string) => {
    if (!profile) return;
    
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .eq('is_read', false);

    setConversations(prev => prev.map(c => 
        c.conversation_id === convoId ? { ...c, unread_count: 0 } : c
    ));
  };

  const handleTyping = () => {
      if (!selectedConvo || !profile) return;
      
      const channel = supabase.channel(`typing-${selectedConvo.conversation_id}`);
      channel.track({
          is_typing: true,
          typing_to: selectedConvo.conversation_id,
          user_id: profile.id
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
          channel.track({
              is_typing: false,
              typing_to: selectedConvo.conversation_id,
              user_id: profile.id
          });
      }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedConvo || !profile) return;

      setIsUploading(true);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `chat-attachments/${selectedConvo.conversation_id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('loan-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: msgError } = await supabase.from('direct_messages').insert({
              conversation_id: selectedConvo.conversation_id,
              sender_id: profile.id,
              content: `Sent an attachment: ${file.name}`,
              attachment_path: filePath,
              attachment_name: file.name,
              attachment_type: file.type
          });

          if (msgError) throw msgError;
          toast.success("File sent");
      } catch (error: any) {
          console.error(error);
          toast.error("Failed to upload file");
      } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedConvo || !profile) return;

    try {
      const { error } = await supabase.from('direct_messages').insert({
        conversation_id: selectedConvo.conversation_id,
        sender_id: profile.id,
        content: content.trim()
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;
      sendMessage(newMessage);
      setNewMessage('');
  };

  const attachClient = (borrower: BorrowerListItem) => {
      const ref = `[CLIENT_REF:${borrower.id}:${borrower.full_name}]`;
      sendMessage(ref);
      setShowAttachClientModal(false);
  };

  const startNewChat = async (recipient: UserListItem) => {
      if (!profile) return;
      setIsCreatingChat(true);
      
      try {
          const existing = conversations.find(c => c.other_user_id === recipient.id);
          if (existing) {
              setSelectedConvo(existing);
              setShowNewChatModal(false);
              return;
          }

          const { data: convoId, error } = await supabase.rpc('create_new_conversation', {
              recipient_id: recipient.id
          });

          if (error) throw error;

          const newConvo: ConversationSummary = {
              conversation_id: convoId,
              other_user_id: recipient.id,
              other_user_name: recipient.full_name,
              last_message: '',
              last_message_at: new Date().toISOString(),
              unread_count: 0
          };

          setConversations(prev => [newConvo, ...prev]);
          setSelectedConvo(newConvo);
          setShowNewChatModal(false);
      } catch (error) {
          console.error("Error starting chat:", error);
          alert("Failed to start conversation.");
      } finally {
          setIsCreatingChat(false);
      }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const renderMessageContent = (msg: Message, isMe: boolean) => {
      const clientRefRegex = /\[CLIENT_REF:([^:]+):([^\]]+)\]/;
      const match = msg.content.match(clientRefRegex);

      if (match) {
          const [, id, name] = match;
          return (
              <div className={`p-4 rounded-2xl border shadow-sm max-w-xs ${isMe ? 'bg-indigo-700 border-indigo-500 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
                  <div className="flex items-center gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${isMe ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                          {name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Linked Client</p>
                          <p className="font-bold truncate">{name}</p>
                      </div>
                  </div>
                  <Link 
                    to={`/borrowers/${id}`}
                    className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                        isMe 
                        ? 'bg-white/10 hover:bg-white/20 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                      View Profile <ExternalLink className="h-3 w-3" />
                  </Link>
              </div>
          );
      }

      if (msg.attachment_path) {
          const isImage = msg.attachment_type?.startsWith('image/');
          const { data: pUrl } = supabase.storage.from('loan-documents').getPublicUrl(msg.attachment_path);
          const url = pUrl.publicUrl;

          return (
              <div className={`p-2 rounded-2xl shadow-sm border ${isMe ? 'bg-indigo-600 border-indigo-500' : 'bg-white border-gray-100'}`}>
                  {isImage ? (
                      <div className="relative cursor-pointer group" onClick={() => setViewImage(url)}>
                          <img src={url} alt="Attachment" className="max-w-[240px] rounded-xl object-cover max-h-[300px]" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                              <ZoomIn className="text-white h-6 w-6" />
                          </div>
                      </div>
                  ) : (
                      <a href={url} target="_blank" rel="noreferrer" className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-white/10 text-white' : 'bg-gray-50 text-gray-900'}`}>
                          <Paperclip className="h-5 w-5 shrink-0" />
                          <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{msg.attachment_name}</p>
                              <p className="text-[10px] opacity-70 uppercase font-bold">Download File</p>
                          </div>
                      </a>
                  )}
              </div>
          );
      }

      return (
          <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
              isMe 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
          }`}>
              {msg.content}
          </div>
      );
  };

  const filteredUsers = users.filter(u => {
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const search = userSearch.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const filteredBorrowers = borrowers.filter(b => 
    (b.full_name || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredConversations = conversations.filter(c => 
    (c.other_user_name || '').toLowerCase().includes(convoSearch.toLowerCase()) ||
    (c.last_message || '').toLowerCase().includes(convoSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      {/* Conversation List View */}
      {!selectedConvo ? (
        <div className="w-full flex flex-col">
          <div className="p-6 border-b border-gray-50 bg-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
              <button 
                onClick={() => { fetchUsers(); setShowNewChatModal(true); }}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                title="New Chat"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                value={convoSearch}
                onChange={(e) => setConvoSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
               <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
               </div>
            ) : filteredConversations.length === 0 ? (
               <div className="p-12 text-center">
                   <div className="bg-gray-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="h-8 w-8 text-gray-300" />
                   </div>
                   <p className="text-gray-500 text-sm font-medium">No conversations found</p>
                   <button 
                      onClick={() => { fetchUsers(); setShowNewChatModal(true); }}
                      className="mt-4 text-indigo-600 text-sm font-bold hover:text-indigo-700"
                   >
                       Start a new chat
                   </button>
               </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredConversations.map(convo => (
                  <div 
                    key={convo.conversation_id}
                    onClick={() => setSelectedConvo(convo)}
                    className="px-6 py-5 cursor-pointer transition-all hover:bg-indigo-50/30 group"
                  >
                    <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                            <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl group-hover:scale-105 transition-transform">
                                {(convo.other_user_name || 'U').charAt(0)}
                            </div>
                            {onlineUsers.has(convo.other_user_id) && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 border-2 border-white rounded-full"></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className={`text-base truncate ${convo.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                    {convo.other_user_name}
                                </h4>
                                {convo.last_message_at && (
                                    <span className="text-xs text-gray-400 font-medium">
                                        {new Date(convo.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <p className={`text-sm truncate ${convo.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                    {convo.last_message?.startsWith('[CLIENT_REF:') ? '📎 Linked a client' : (convo.last_message || 'No messages yet')}
                                </p>
                                {convo.unread_count > 0 && (
                                    <span className="flex-shrink-0 bg-indigo-600 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center">
                                        {convo.unread_count}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Chat Viewer View */
        <div className="w-full flex flex-col bg-gray-50/30">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedConvo(null)}
                        className="p-2 -ml-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Back to list"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                        {(selectedConvo.other_user_name || 'U').charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 leading-tight">{selectedConvo.other_user_name}</h3>
                        <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${onlineUsers.has(selectedConvo.other_user_id) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {onlineUsers.has(selectedConvo.other_user_id) ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Phone className="h-5 w-5" /></button>
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Video className="h-5 w-5" /></button>
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Info className="h-5 w-5" /></button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.map((msg, idx) => {
                    const isMe = msg.sender_id === profile?.id;
                    const showDate = idx === 0 || new Date(messages[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                    
                    return (
                        <React.Fragment key={msg.id}>
                            {showDate && (
                                <div className="flex justify-center my-8">
                                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full uppercase tracking-widest">
                                        {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            )}
                            <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] group ${isMe ? 'items-end' : 'items-start'}`}>
                                    {renderMessageContent(msg, isMe)}
                                    <div className={`flex items-center gap-1 mt-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                        {isMe && (
                                            <Check className={`h-3 w-3 ${msg.is_read ? 'text-indigo-500' : 'text-gray-300'}`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                
                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="bg-white border border-gray-100 px-4 py-2 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Typing...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-gray-100">
                <form onSubmit={handleSendText} className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button 
                            type="button"
                            onClick={() => { fetchBorrowers(); setShowAttachClientModal(true); }}
                            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                            title="Link Client"
                        >
                            <UserPlus className="h-5 w-5" />
                        </button>
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                            title="Attach Image"
                        >
                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*,application/pdf" 
                            onChange={handleFileUpload}
                        />
                    </div>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                            placeholder="Type your message..."
                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-indigo-600 text-white rounded-2xl p-3 hover:bg-indigo-700 disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm" onClick={() => setViewImage(null)}>
              <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
                  <X className="h-6 w-6" />
              </button>
              <img src={viewImage} alt="Full View" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-gray-900">New Message</h3>
                      <button onClick={() => setShowNewChatModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-all">
                          <X className="h-5 w-5" />
                      </button>
                  </div>
                  <div className="p-6">
                      <div className="relative mb-6">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="text"
                            placeholder="Search team members..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                          />
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                          {filteredUsers.length === 0 ? (
                              <div className="py-12 text-center">
                                  <User className="h-12 w-12 text-gray-100 mx-auto mb-3" />
                                  <p className="text-gray-400 text-sm">No team members found</p>
                              </div>
                          ) : (
                              filteredUsers.map(user => (
                                  <button
                                    key={user.id}
                                    onClick={() => startNewChat(user)}
                                    disabled={isCreatingChat}
                                    className="w-full flex items-center p-3 rounded-2xl hover:bg-indigo-50 transition-all text-left group active:scale-[0.98]"
                                  >
                                      <div className="h-11 w-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg mr-4 group-hover:bg-indigo-200 transition-colors">
                                          {(user.full_name || 'U').charAt(0)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <p className="font-bold text-gray-900 truncate">{user.full_name}</p>
                                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{(user.role || 'User').replace('_', ' ')}</p>
                                      </div>
                                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                                          <Plus className="h-5 w-5" />
                                      </div>
                                  </button>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Attach Client Modal */}
      {showAttachClientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-gray-900">Link Client</h3>
                      <button onClick={() => setShowAttachClientModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-all">
                          <X className="h-5 w-5" />
                      </button>
                  </div>
                  <div className="p-6">
                      <div className="relative mb-6">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="text"
                            placeholder="Search clients..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                          />
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                          {filteredBorrowers.length === 0 ? (
                              <div className="py-12 text-center">
                                  <User className="h-12 w-12 text-gray-100 mx-auto mb-3" />
                                  <p className="text-gray-400 text-sm">No clients found</p>
                              </div>
                          ) : (
                              filteredBorrowers.map(borrower => (
                                  <button
                                    key={borrower.id}
                                    onClick={() => attachClient(borrower)}
                                    className="w-full flex items-center p-3 rounded-2xl hover:bg-indigo-50 transition-all text-left group active:scale-[0.98]"
                                  >
                                      <div className="h-11 w-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg mr-4 group-hover:bg-indigo-200 transition-colors">
                                          {(borrower.full_name || 'C').charAt(0)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <p className="font-bold text-gray-900 truncate">{borrower.full_name}</p>
                                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Borrower</p>
                                      </div>
                                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                                          <Plus className="h-5 w-5" />
                                      </div>
                                  </button>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};