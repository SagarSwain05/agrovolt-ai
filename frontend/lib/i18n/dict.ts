import { CORE, type Triplet } from './core';
import { PAGES } from './pages';

export type { Triplet };
export const DICT: Record<string, Triplet> = { ...CORE, ...PAGES };
