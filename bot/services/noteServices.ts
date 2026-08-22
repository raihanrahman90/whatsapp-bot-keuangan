import { createNote, getNotesByName } from "../repositories/noteRepository";

export interface NoteSummary {
  name: string;
  fact: string;
  createdAt: Date | null;
}

export async function saveNote(name: string, fact: string): Promise<NoteSummary> {
  const note = await createNote(name, fact);
  return { name: note.name, fact: note.fact, createdAt: note.createdAt };
}

export async function getNotes(name: string): Promise<NoteSummary[]> {
  const notes = await getNotesByName(name);
  return notes.map((note) => ({ name: note.name, fact: note.fact, createdAt: note.createdAt }));
}
