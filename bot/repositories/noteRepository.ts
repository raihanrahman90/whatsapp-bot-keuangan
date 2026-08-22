import prisma = require("../config/prisma");

export async function createNote(name: string, fact: string) {
  return prisma.note.create({
    data: { name, fact, createdAt: new Date() }
  });
}

export async function getNotesByName(name: string) {
  return prisma.note.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
    orderBy: { createdAt: "asc" }
  });
}
