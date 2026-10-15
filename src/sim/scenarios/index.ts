import type { ScenarioDef } from './types.ts';
import { zipper } from './zipper.ts';
import { gridlock, hero } from './gridlock.ts';
import { freeLeft } from './freeLeft.ts';
import { phantom } from './phantom.ts';
import { busBay } from './busBay.ts';
import { zebra } from './zebra.ts';

export const SCENARIOS: ScenarioDef[] = [zipper, gridlock, freeLeft, phantom, busBay, zebra];
export const byId = (id: string) => (id === 'hero' ? hero : SCENARIOS.find((s) => s.id === id)!);
