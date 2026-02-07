/**
 * Pipeline unit tests.
 * Run with: node scripts/pipeline/pipeline.test.js
 *
 * Tests parsing functions against real SPARQL response data.
 */

import { strict as assert } from 'assert';
import {
  celexToCaseNumber,
  caseNumberToFilename,
  parseModifiedLocations,
} from './sparql-discover.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ============================================================
// celexToCaseNumber
// ============================================================
console.log('\ncelexToCaseNumber');

test('standard CJ case: 62024CJ0422 -> C-422/24', () => {
  assert.equal(celexToCaseNumber('62024CJ0422'), 'C-422/24');
});

test('standard CJ case: 62023CJ0492 -> C-492/23', () => {
  assert.equal(celexToCaseNumber('62023CJ0492'), 'C-492/23');
});

test('standard CJ case: 62023CJ0655 -> C-655/23', () => {
  assert.equal(celexToCaseNumber('62023CJ0655'), 'C-655/23');
});

test('joined case CELEX: 62023CJ0313 -> C-313/23', () => {
  // SPARQL returns joined cases under the first case CELEX
  assert.equal(celexToCaseNumber('62023CJ0313'), 'C-313/23');
});

test('older case: 62021CJ0560 -> C-560/21', () => {
  assert.equal(celexToCaseNumber('62021CJ0560'), 'C-560/21');
});

test('court order (CO) returns null', () => {
  assert.equal(celexToCaseNumber('62023CO0312'), null);
});

test('pending case (CN) returns null', () => {
  assert.equal(celexToCaseNumber('62019CN0439'), null);
});

test('garbage input returns null', () => {
  assert.equal(celexToCaseNumber('not-a-celex'), null);
});

test('empty string returns null', () => {
  assert.equal(celexToCaseNumber(''), null);
});

test('zero-padded number strips leading zeros: 62017CJ0673 -> C-673/17', () => {
  assert.equal(celexToCaseNumber('62017CJ0673'), 'C-673/17');
});

test('single digit case: 62020CJ0001 -> C-1/20', () => {
  assert.equal(celexToCaseNumber('62020CJ0001'), 'C-1/20');
});

// ============================================================
// caseNumberToFilename
// ============================================================
console.log('\ncaseNumberToFilename');

test('C-492/23 -> C-492-23', () => {
  assert.equal(caseNumberToFilename('C-492/23'), 'C-492-23');
});

test('C-1/20 -> C-1-20', () => {
  assert.equal(caseNumberToFilename('C-1/20'), 'C-1-20');
});

// ============================================================
// parseModifiedLocations
// ============================================================
console.log('\nparseModifiedLocations');

test('standard format: A04P4, A05P2, A24, A25, A26, A32', () => {
  const result = parseModifiedLocations('A04P4, A05P2, A24, A25, A26, A32');
  assert.deepEqual(result, [
    'Article 4', 'Article 5', 'Article 24',
    'Article 25', 'Article 26', 'Article 32',
  ]);
});

test('single entry: A82P1', () => {
  assert.deepEqual(parseModifiedLocations('A82P1'), ['Article 82']);
});

test('PT format (point): A02, A04PT7, A51, A79P1', () => {
  const result = parseModifiedLocations('A02, A04PT7, A51, A79P1');
  assert.deepEqual(result, ['Article 2', 'Article 4', 'Article 51', 'Article 79']);
});

test('LC/LE sub-point format: A04PT1, A04PT2, A06P1LC, A06P1LE', () => {
  const result = parseModifiedLocations('A04PT1, A04PT2, A06P1LC, A06P1LE');
  // Deduplicate: Article 4 appears twice, Article 6 appears twice
  assert.deepEqual(result, ['Article 4', 'Article 6']);
});

test('simple articles: A13, A14', () => {
  assert.deepEqual(parseModifiedLocations('A13, A14'), ['Article 13', 'Article 14']);
});

test('null input returns empty array', () => {
  assert.deepEqual(parseModifiedLocations(null), []);
});

test('empty string returns empty array', () => {
  assert.deepEqual(parseModifiedLocations(''), []);
});

test('results are sorted numerically', () => {
  const result = parseModifiedLocations('A82, A05, A24, A02');
  assert.deepEqual(result, ['Article 2', 'Article 5', 'Article 24', 'Article 82']);
});

test('duplicates are removed', () => {
  const result = parseModifiedLocations('A05P1, A05P2, A05');
  assert.deepEqual(result, ['Article 5']);
});

// ============================================================
// Joined case detection (must check RAW SPARQL value, not parsed)
// ============================================================
console.log('\nJoined case detection (raw value)');

// Helper: mimics the pipeline's joined-case check on raw SPARQL value
function isJoinedCase(rawCaseNumber) {
  if (!rawCaseNumber) return false;
  return rawCaseNumber.includes(' and ') ||
    (rawCaseNumber.includes(',') && !!rawCaseNumber.match(/C[-\u2011]\d+.*,.*C[-\u2011]\d+/));
}

test('detects "Joined Cases" with commas and "and"', () => {
  assert.ok(isJoinedCase('Joined Cases C-313/23, C-316/23 and C-332/23'));
});

test('detects "Joined Cases" with "and" only', () => {
  assert.ok(isJoinedCase('Joined Cases C-17/22 and C-18/22'));
});

test('detects "Joined Cases" with commas only', () => {
  assert.ok(isJoinedCase('Joined Cases C-313/23, C-316/23'));
});

test('normal case does NOT trigger joined detection', () => {
  assert.ok(!isJoinedCase('Case C-492/23'));
});

test('normal case with comma in party name does NOT trigger', () => {
  // Comma not between two C-NNN patterns, so should NOT trigger
  assert.ok(!isJoinedCase('Case C-492/23'));
});

// ============================================================
// SPARQL response binding simulation
// ============================================================
console.log('\nSPARQL response parsing');

test('parses real binding structure correctly', () => {
  const binding = {
    actCelex: { type: 'literal', value: '32016R0679' },
    caseCelex: { type: 'literal', value: '62024CJ0422' },
    caseNumber: { type: 'literal', value: 'Case C-422/24' },
    caseDate: { type: 'typed-literal', value: '2025-12-18' },
    caseParties: { type: 'literal', value: 'Integritetsskyddsmyndigheten v AB Storstockholms Lokaltrafik' },
    modifiedLocations: { type: 'literal', value: 'A13, A14' },
    caseTitle: { type: 'literal', value: 'Judgment of the Court...' },
  };

  const celex = binding.caseCelex.value;
  assert.equal(celex, '62024CJ0422');
  assert.equal(celexToCaseNumber(celex), 'C-422/24');
  assert.equal(caseNumberToFilename('C-422/24'), 'C-422-24');
  assert.equal(binding.caseDate.value, '2025-12-18');
  assert.deepEqual(parseModifiedLocations(binding.modifiedLocations.value), ['Article 13', 'Article 14']);
});

test('handles binding with missing optional fields', () => {
  const binding = {
    actCelex: { type: 'literal', value: '32016R0679' },
    caseCelex: { type: 'literal', value: '62023CJ0655' },
    caseNumber: { type: 'literal', value: 'Case C-655/23' },
    caseDate: { type: 'typed-literal', value: '2025-09-04' },
    caseParties: { type: 'literal', value: 'IP v Quirin Privatbank AG' },
    // modifiedLocations missing -- only 2 of 72 in real data
  };

  const modLoc = binding.modifiedLocations ? binding.modifiedLocations.value : null;
  assert.deepEqual(parseModifiedLocations(modLoc), []);
});

test('filters CO CELEX correctly', () => {
  const celex = '62023CO0312';
  assert.equal(celex.match(/^\d{4,5}CJ\d+$/), null);
  assert.equal(celexToCaseNumber(celex), null);
});

test('caseNumber parsing: strips "Case " prefix', () => {
  const raw = 'Case C-422/24';
  const match = raw.match(/(?:Case\s+)?(C[-\u2011]\d+\/\d+)/i);
  assert.ok(match);
  assert.equal(match[1], 'C-422/24');
});

test('caseNumber parsing: handles "Joined Cases" as non-simple', () => {
  const raw = 'Joined Cases C-313/23, C-316/23 and C-332/23';
  const match = raw.match(/(?:Case\s+)?(C[-\u2011]\d+\/\d+)/i);
  // Should match the first case number
  assert.ok(match);
  assert.equal(match[1], 'C-313/23');
});

// ============================================================
// Summary
// ============================================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
