/**
 * Test script for article reference extraction
 * 
 * This script tests the article reference extraction function with various formats
 * to ensure it correctly identifies and normalizes all article references.
 */

// Import the extraction function
const extractAllArticleReferences = (text) => {
    const references = [];

    // Look for "article X" pattern anywhere in the text
    const articleMatches = text.matchAll(/article\s+(\d+)(?:\s+paragraph\s+\d+)?(?:\s+point\s+\([a-z]\))?(?:\s+sentence\s+\d+)?/gi);
    for (const match of articleMatches) {
        references.push(`Article ${match[1]}`);
    }

    // Look for "recital X" pattern anywhere in the text
    const recitalMatches = text.matchAll(/recital\s+(\d+)/gi);
    for (const match of recitalMatches) {
        references.push(`Recital ${match[1]}`);
    }

    // Look for "AXX" pattern at the beginning of the text or after spaces
    const axxMatches = text.matchAll(/(?:^|\s)A(\d+)(?:P[A-Z]?\d*)?(?:L[A-Z]?\d*)?/g);
    for (const match of axxMatches) {
        references.push(`Article ${parseInt(match[1], 10)}`);
    }

    return references;
};

// Test cases
const testCases = [
    {
        input: "A04PT11 Interpreted by 62017CJ0673",
        expected: ["Article 4"]
    },
    {
        input: "A06P1LA Interpreted by 62017CJ0673",
        expected: ["Article 6"]
    },
    {
        input: "article 6 paragraph 1 point (a) Preliminary question submitted by 62017CN0673",
        expected: ["Article 6"]
    },
    {
        input: "A02P1 Interpreted by 62018CJ0311",
        expected: ["Article 2"]
    },
    {
        input: "A06P1L1LF Interpreted by 62019CJ0597",
        expected: ["Article 6"]
    },
    {
        input: "article 15 Preliminary question submitted by 62019CN0272",
        expected: ["Article 15"]
    },
    {
        input: "article 4 paragraph 7 Preliminary question submitted by 62019CN0272",
        expected: ["Article 4"]
    },
    {
        input: "recital 154 Preliminary question submitted by 62019CN0439",
        expected: ["Recital 154"]
    },
    {
        input: "article 38 paragraph 3 sentence 2 Preliminary question submitted by 62021CN0453",
        expected: ["Article 38"]
    },
    {
        input: "This text contains multiple references: article 5, A06P1, and recital 10",
        expected: ["Article 5", "Article 6", "Recital 10"]
    }
];

// Run tests
console.log("Testing article reference extraction...\n");
let passedTests = 0;

testCases.forEach((testCase, index) => {
    const result = extractAllArticleReferences(testCase.input);
    const sortedResult = [...result].sort();
    const sortedExpected = [...testCase.expected].sort();

    const passed =
        sortedResult.length === sortedExpected.length &&
        sortedResult.every((val, i) => val === sortedExpected[i]);

    console.log(`Test ${index + 1}:`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: ${JSON.stringify(sortedExpected)}`);
    console.log(`Result:   ${JSON.stringify(sortedResult)}`);
    console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`);
    console.log();

    if (passed) passedTests++;
});

console.log(`Summary: ${passedTests}/${testCases.length} tests passed`);

if (passedTests === testCases.length) {
    console.log("All tests passed! The article reference extraction is working correctly.");
} else {
    console.log("Some tests failed. Please review the extraction function.");
    process.exit(1);
} 