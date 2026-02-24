import React from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { LoanNote } from '@/types';

interface LoanNotesSectionProps {
  notes: LoanNote[];
  newNote: string;
  onNoteChange: (val: string) => void;
  onPostNote: (e: React.FormEvent) => void;
}

export const LoanNotesSection: React.FC<LoanNotesSectionProps> = ({ 
  notes, 
  newNote, 
  onNoteChange, 
  onPostNote 
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-900 flex items-center">
          <MessageSquare className="h-4 w-4 mr-2 text-indigo-600" />
          Loan Notes
        </h3>
      </div>
      <div className="p-6 space-y-6">
        <form onSubmit={onPostNote} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add a note..." 
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            value={newNote}
            onChange={e => onNoteChange(e.target.value)}
          />
          <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all">
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar pr-2">
          {notes.map(note => (
            <div key={note.id} className={`p-3 rounded-xl border ${note.is_system ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-gray-900">{note.is_system ? 'System' : note.users?.full_name}</span>
                <span className="text-[8px] text-gray-400">{new Date(note.created_at).toLocaleDateString()}</span>
              </div>
              <p className={`text-xs leading-relaxed ${note.is_system ? 'text-gray-500 italic' : 'text-gray-700'}`}>{note.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};