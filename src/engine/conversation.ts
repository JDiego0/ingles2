/**
 * Motor de conversaciones ramificadas (predefinidas, sin IA).
 * Elige la siguiente intervención según palabras clave de la respuesta.
 */
import type { Conversation, ConversationNode } from '../types/content';
import { wordCount } from './answer';

export function nodeById(conv: Conversation, id: string): ConversationNode | undefined {
  return conv.nodes.find((n) => n.id === id);
}

export interface Transition {
  next: string | null;
  react?: string;
}

export function nextNode(node: ConversationNode, answer: string): Transition {
  const text = ' ' + answer.toLowerCase().replace(/[’]/g, "'").replace(/[^a-záéíóúñü0-9'\s-]/g, ' ') + ' ';
  for (const b of node.branches ?? []) {
    if (b.match.some((m) => text.includes(m.toLowerCase()))) return { next: b.next, react: b.react };
  }
  return { next: node.next ?? null };
}

/** ¿La respuesta es demasiado corta para el nodo? (se pide un poco más, una sola vez). */
export function tooShort(node: ConversationNode, answer: string): boolean {
  return wordCount(answer) < (node.minWords ?? 3);
}

/** Recorrido más largo posible (para mostrar progreso aproximado). */
export function maxDepth(conv: Conversation): number {
  const memo = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    const n = nodeById(conv, id);
    if (!n) return 0;
    const next = [...(n.branches ?? []).map((b) => b.next), ...(n.next ? [n.next] : [])];
    const s = new Set(seen).add(id);
    const d = 1 + Math.max(0, ...next.map((x) => visit(x, s)));
    memo.set(id, d);
    return d;
  };
  return visit(conv.start, new Set());
}
