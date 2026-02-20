import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { usePresence } from '@/context/PresenceContext';
import { Send, User, Search, MessageSquare, Plus, X, Check, MoreVertical, Phone, Video, Info } from 'lucide-react';

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
}

interface UserListItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export const Messages: React.FC = () => {
  const { profile } = useAuth();
  const { onlineUsers } = usePresence();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [convoSearch, setConvoSearch] = useState('');
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

      const channel = supabase
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
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConvo]);

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo || !profile) return;

    const tempMsg = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('direct_messages').insert({
        conversation_id: selectedConvo.conversation_id,
        sender_id: profile.id,
        content: tempMsg
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(tempMsg);
    }
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

  const filteredUsers = users.filter(u => {
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const search = userSearch.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const filteredConversations = conversations.filter(c => 
    (c.other_user_name || '').toLowerCase().includes(convoSearch.toLowerCase()) ||
    (c.last_message || '').toLowerCase().includes(convoSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      {/* Sidebar: Conversation List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-100 flex flex-col ${selectedConvo ? 'hidden md:flex' : 'flex'}`}>
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
            filteredConversations.map(convo => (
              <div 
                key={convo.conversation_id}
                onClick={() => setSelectedConvo(convo)}
                className={`px-6 py-4 cursor-pointer transition-all border-l-4 ${
                    selectedConvo?.conversation_id === convo.conversation_id 
                    ? 'bg-indigo-50/50 border-indigo-600' 
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                            {(convo.other_user_name || 'U').charAt(0)}
                        </div>
                        {onlineUsers.has(convo.other_user_id) && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                            <h4 className={`text-sm truncate ${convo.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                {convo.other_user_name}
                            </h4>
                            {convo.last_message_at && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                    {new Date(convo.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <p className={`text-xs truncate ${convo.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                {convo.last_message || 'No messages yet'}
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
            ))
          )}
        </div>
      </div>

      {/* Main: Chat Window */}
      <div className={`flex-1 flex flex-col bg-gray-50/30 ${!selectedConvo ? 'hidden md:flex' : 'flex'}`}>
        {selectedConvo ? (
            <>
                {/* Chat Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSelectedConvo(null)}
                            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-6 w-6" />
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
                                        <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                            isMe 
                                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                        }`}>
                                            {msg.content}
                                        </div>
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
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-gray-100">
                    <form onSubmit={sendMessage} className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
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
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100 mb-6">
                    <MessageSquare className="h-16 w-16 text-indigo-100" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Your Inbox</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
                    Select a conversation from the sidebar to start messaging your team members.
                </p>
                <button 
                    onClick={() => { fetchUsers(); setShowNewChatModal(true); }}
                    className="mt-8 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                    New Conversation
                </button>
            </div>
        )}
      </div>

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
    </div>
  );
};