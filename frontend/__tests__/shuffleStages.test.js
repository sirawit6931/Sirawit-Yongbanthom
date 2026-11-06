const fc = require('fast-check');

// ใช้ implementation ตัวจริงจาก frontend/utils/learningEngine.js (Single Source of Truth)
// — learningEngine.js เป็น pure CommonJS module (ไม่มี dependency RN/Firebase) จึง require ตรงใน Jest ได้
// — เดิมไฟล์นี้ก๊อป logic มาวาง ทำให้ test หลุดจากตัวจริง: ถ้าตัวจริง regress test จะยังเขียวอยู่ดี
const { shuffleStages } = require('../utils/learningEngine');

/**
 * Validates: Requirements 1.1
 */
test('Feature: vocabulary-learning-module, Property 1: shuffleStages result has length 4 with all stages', () => {
  const expectedStages = new Set(['matching', 'spelling', 'fillblank', 'pronunciation']);

  fc.assert(
    fc.property(fc.constant(null), () => {
      const result = shuffleStages();

      // length must be 4
      expect(result.length).toBe(4);

      // must contain all 4 stages
      const resultSet = new Set(result);
      for (const stage of expectedStages) {
        expect(resultSet.has(stage)).toBe(true);
      }

      // no duplicates
      expect(new Set(result).size).toBe(4);
    }),
    { numRuns: 100 }
  );
});

/**
 * Validates: Requirements 1.2, 1.3
 */
test('Feature: vocabulary-learning-module, Property 2: result[0] is always matching', () => {
  fc.assert(
    fc.property(fc.constant(null), () => {
      const result = shuffleStages();
      expect(result[0]).toBe('matching');
    }),
    { numRuns: 100 }
  );
});

/**
 * Validates: Requirements 1.4
 */
test('Feature: vocabulary-learning-module, Property 3: all 6 permutations appear in 600 runs', () => {
  fc.assert(
    fc.property(fc.constant(null), () => {
      const seen = new Set();
      for (let i = 0; i < 600; i++) {
        const result = shuffleStages();
        seen.add(result.slice(1).join(','));
      }
      // All 6 permutations of ['spelling', 'fillblank', 'pronunciation'] must appear
      expect(seen.size).toBe(6);
    }),
    { numRuns: 1 }
  );
});
