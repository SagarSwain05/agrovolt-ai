import type { Triplet } from './core';
import { P1 } from './pages1';
import { P2 } from './pages2';
import { P3 } from './pages3';

export const PAGES: Record<string, Triplet> = { ...P1, ...P2, ...P3 };
