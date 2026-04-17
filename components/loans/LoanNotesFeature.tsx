import React from 'react';
import type { FormEvent } from 'react';
import type { LoanNote } from '@/types';
import { LoanNotesSection } from '@/components/loans/LoanNotesSection';

export interface LoanNotesFeatureProps {
  notes: LoanNote[];
  newNote: string;
  onNoteChange: (value: string) => void;
  onPostNote: (event: FormEvent) => void | Promise<void>;
}

export const LoanNotesFeature: React.FC<LoanNotesFeatureProps> = ({
  notes,
  newNote,
  onNoteChange,
  onPostNote,
}) => {
  return (
    <LoanNotesSection
      notes={notes}
      newNote={newNote}
      onNoteChange={onNoteChange}
      onPostNote={onPostNote}
    />
  );
};