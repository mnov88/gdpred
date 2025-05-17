/**
 * Test script for case number extraction
 * 
 * This script tests the case number extraction function with various formats
 * to ensure it correctly identifies and normalizes all case numbers.
 */

// Import the extraction function
const extractCaseNumber = (text) => {
    const caseNumberMatch =
        text.match(/Case\s+([C]-\s*\d+[\/-]\d+)/i) ||
        text.match(/([C]-\s*\d+[\/-]\d+)/i) ||
        text.match(/Case\s+([C]\s+\d+[\/-]\d+)/i) ||
        text.match(/([C]\s+\d+[\/-]\d+)/i);

    if (caseNumberMatch && caseNumberMatch[1]) {
        let caseNumber = caseNumberMatch[1].trim()
            .replace(/\s+/g, '-')
            .replace(/\//, '-');

        if (!caseNumber.includes('-')) {
            caseNumber = `C-${caseNumber.substring(1)}`;
        }

        return caseNumber;
    }
    return null;
};

// Test cases
const testCases = [
    {
        input: 'Judgment of the Court (Second Chamber) of 16 November 2016. Wolfgang Schmidt v Christiane Schmidt. Request for a preliminary ruling from the Landesgericht für Zivilrechtssachen Wien. Reference for a preliminary ruling — Area of freedom, security and justice — Regulation (EU) No 1215/2012 — Jurisdiction and the recognition and enforcement of judgments in civil and commercial matters — Scope — First subparagraph of Article 24(1) — Exclusive jurisdiction in matters relating to rights in rem in immovable property — Article 7(1)(a) — Special jurisdiction in matters relating to a contract — Action seeking the avoidance of a contract of gift of immovable property and the removal of an entry in the land register evidencing a right of ownership. Case C-417/15.',
        expected: 'C-417-15'
    },
    {
        input: 'Case C 417/15',
        expected: 'C-417-15'
    },
    {
        input: 'Case C-417/15',
        expected: 'C-417-15'
    },
    {
        input: 'C-417/15',
        expected: 'C-417-15'
    },
    {
        input: 'C 417/15',
        expected: 'C-417-15'
    },
    {
        input: 'Case C-417-15',
        expected: 'C-417-15'
    },
    {
        input: 'This text contains a case number C-123/45 somewhere in the middle.',
        expected: 'C-123-45'
    },
    {
        input: 'No case number here',
        expected: null
    }
];

// Run tests
console.log("Testing case number extraction...\n");
let passedTests = 0;

testCases.forEach((testCase, index) => {
    const result = extractCaseNumber(testCase.input);
    const passed = result === testCase.expected;

    console.log(`Test ${index + 1}:`);
    console.log(`Input: "${testCase.input.length > 100 ? testCase.input.substring(0, 100) + '...' : testCase.input}"`);
    console.log(`Expected: ${testCase.expected === null ? 'null' : testCase.expected}`);
    console.log(`Result:   ${result === null ? 'null' : result}`);
    console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`);
    console.log();

    if (passed) passedTests++;
});

console.log(`Summary: ${passedTests}/${testCases.length} tests passed`);

if (passedTests === testCases.length) {
    console.log("All tests passed! The case number extraction is working correctly.");
} else {
    console.log("Some tests failed. Please review the extraction function.");
    process.exit(1);
} 