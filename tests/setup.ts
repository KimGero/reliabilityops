// tests/setup.ts
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  console.log('🧪 Test setup running...');
});

afterAll(() => {
  console.log('✅ Tests completed');
});