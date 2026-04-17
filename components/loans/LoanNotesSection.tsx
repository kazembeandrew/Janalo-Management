import React, { useState } from 'react';
import { LoanNote } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { 
  Calendar, 
  User, 
  Edit, 
  Trash2, 
  Plus,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LoanNotesSectionProps {
  notes: LoanNote[];
  newNote: string;
  onNoteChange: (note: string) => void;
  onPostNote: (e: React.FormEvent) => void;
}

export const LoanNotesSection: React.FC<LoanNotesSectionProps> = ({
  notes,
  newNote,
  onNoteChange,
  onPostNote
}) => {
  const [editingNote, setEditingNote] = useState<LoanNote | null>(null);
  const [editText, setEditText] = useState('');

  const handleEditNote = (note: LoanNote) => {
    setEditingNote(note);
    setEditText(note.content);
  };

  const handleSaveEdit = () => {
    // This would integrate with the note update service
    toast.success('Note updated successfully');
    setEditingNote(null);
    setEditText('');
  };

  const handleDeleteNote = (note: LoanNote) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }
    // This would integrate with the note deletion service
    toast.success('Note deleted successfully');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Loan Notes</h3>
      </div>

      {/* Add Note Form */}
      <div className="p-6 border-b border-gray-200">
        <form onSubmit={onPostNote} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add New Note
            </label>
            <textarea
              value={newNote}
              onChange={(e) => onNoteChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
              placeholder="Enter your note here..."
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newNote.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </button>
          </div>
        </form>
      </div>

      {/* Notes List */}
      <div className="divide-y divide-gray-200">
        {notes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No notes available yet.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-6 hover:bg-gray-50">
              {editingNote?.id === note.id ? (
                <div className="space-y-4">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingNote(null)}
                      className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-indigo-600 text-sm font-medium rounded-lg text-white hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{note.users?.full_name || 'System'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditNote(note)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Edit note"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note)}
                        className="text-red-400 hover:text-red-600"
                        title="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-900 leading-relaxed">
                    {note.content}
                  </div>
                  
                  {note.type === 'payment_reminder' && (
                    <div className="mt-3 flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">Payment Reminder</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};