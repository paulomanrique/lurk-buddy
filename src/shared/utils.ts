import { randomUUID } from 'node:crypto';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(): string {
  return randomUUID();
}

export function escapeLike(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}
