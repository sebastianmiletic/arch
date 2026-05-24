import type { Feature } from './types.js';
export declare function seedFeatures(): void;
export declare function getFeatures(): Feature[];
export declare function updateFeature(id: string, updates: Partial<Feature>): void;
