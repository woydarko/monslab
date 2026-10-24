import { beforeEach } from 'vitest';
import { resetRateLimits } from './server/rateLimit.ts';

beforeEach(() => {
    resetRateLimits();
});
