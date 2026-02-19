import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { Send, User, Search, MessageSquare, Clock } from 'lucide-react';

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

export const Messages: React.FC = () => {
  const { profile } = useAuth();
  const { onlineUsers } = usePresence();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();

    // Subscribe to new messages globally to update conversation list
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

      // Subscribe to messages in this conversation
      const channel = supabase
        .channel(`convo-${selectedConvo.conversation_id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'direct_messages',
            filter: `conversation_id=eq.${selectedConvo.conversation_id}`
        }, (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
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

  const markAsRead = async (convoId: string) => {
    if (!profile) return;
    
    // 1. Update DB
    const { error } = await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .eq('is_read', false); // Only update if not already read
    
    if (error) console.error("Error marking as read:", error);

    // 2. Update Local State (Sidebar)
    setConversations(prev => prev.map(c => 
        c.conversation_id === convoId ? { ...c, unread_count: 0 } : c
    ));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo || !profile) return;

    try {
      const { error } = await supabase.from('direct_messages').insert({
        conversation_id: selectedConvo.conversation_id,
        sender_id: profile.id,
        content: newMessage.trim()
      });

      if (error) throw error;
      setNewMessage('');
      // Optimistic update handled by subscription
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
      {/* Sidebar: Conversation List */}
      <div className={`w-full md:w-1/3 border-r border-gray-200 flex flex-col ${selectedConvo ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-indigo-600" /> Inbox
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : conversations.length === 0 ? (
             <div className="p-8 text-center text-gray-500">
                 <p>No messages yet.</p>
             </div>
          ) : (
            conversations.map(convo => (
              <div 
                key={convo.conversation_id}
                onClick={() => setSelectedConvo(convo)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConvo?.conversation_id === convo.conversation_id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                    <span className={`font-medium ${convo.unread_count > 0 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                        {convo.other_user_name}
                    </span>
                    {convo.last_message_at && (
                        <span className="text-xs text-gray-400">
                            {new Date(convo.last_message_at).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <p className={`text-sm truncate w-4/5 ${convo.unread_count > 0 ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                        {convo.last_message || 'No messages'}
                    </p>
                    {convo.unread_count > 0 && (
                        <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {convo.unread_count}
                        </span>
                    )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main: Chat Window */}
      <div className={`w-full md:w-2/3 flex flex-col ${!selectedConvo ? 'hidden md:flex' : 'flex'}`}>
        {selectedConvo ? (
            <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                    <div className="flex items-center">
                        <button 
                            onClick={() => setSelectedConvo(null)}
                            className="md:hidden mr-3 text-gray-500"
                        >
                            ← Back
                        </button>
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                            {(selectedConvo.other_user_name || 'User').charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{selectedConvo.other_user_name || 'Unknown User'}</h3>
                            {onlineUsers.has(selectedConvo.other_user_id) ? (
                                <span className="text-xs text-green-600 flex items-center">
                                    <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span> Online
                                </span>
                            ) : (
                                <span className="text-xs text-gray-400 flex items-center">
                                    <span className="h-2 w-2 bg-gray-300 rounded-full mr-1"></span> Offline
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((msg, index) => {
                        const isMe = msg.sender_id === profile?.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
                                    isMe 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                }`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-200">
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button 
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </form>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a contact from the left to start chatting</p>
            </div>
        )}
      </div>
    </div>
  );
};
