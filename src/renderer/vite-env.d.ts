/// <reference types="vite/client" />

import type { AdvancedRenamerApi } from '@shared/contracts';

declare global {
  interface Window {
    advancedRenamer: AdvancedRenamerApi;
  }
}

export {};
