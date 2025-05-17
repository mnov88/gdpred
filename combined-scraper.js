async function tryGetCaseMetadataFromXml(celexRef) {
    try {
        const response = await axios.get(
            `https://publications.europa.eu/resource/celex/${celexRef}`,
            {
                headers: {
                    'Accept': 'application/xml;notice=branch',
                    'Accept-Language': 'eng'
                },
                timeout: 10000
            }
        );

        const result = await parseXmlString(response.data);

        // Try multiple paths to find the expression
        const expression =
            result?.NOTICE?.WORK?.[0]?.WORK_HAS_EXPRESSION?.[0]?.EMBEDDED_NOTICE?.[0]?.EXPRESSION?.[0] ||
            result?.NOTICE?.EXPRESSION?.[0] ||
            result?.NOTICE?.WORK?.[0]?.EXPRESSION?.[0];

        if (!expression) {
            console.log(`No expression found in XML for ${celexRef}`);
            return null;
        }

        // Try multiple paths for case number with detailed logging
        let caseNumber = null;
        const possibleCaseIdPaths = [
            expression['EXPRESSION_CASE-LAW_IDENTIFIER_CASE']?.[0],
            expression['CASE-LAW_IDENTIFIER_CASE']?.[0],
            expression['IDENTIFIER_CASE']?.[0],
            result?.NOTICE?.WORK?.[0]?.['CASE-LAW_IDENTIFIER_CASE']?.[0]
        ];

        for (const path of possibleCaseIdPaths) {
            if (path?.VALUE?.[0]) {
                caseNumber = path.VALUE[0]
                    .replace(/^Case\s+/i, '')  // Remove "Case " prefix
                    .replace(/\//g, '-')       // Replace / with -
                    .replace(/‑/g, '-')        // Replace unicode hyphen
                    .replace(/\s+/g, '-')      // Replace spaces with hyphens
                    .trim();

                // Ensure C- prefix
                if (!caseNumber.startsWith('C-')) {
                    caseNumber = caseNumber.startsWith('C') ?
                        `C-${caseNumber.substring(1)}` :
                        `C-${caseNumber}`;
                }
                break;
            }
        }

        // Try multiple paths for title with language preference
        let title = null;
        let titleLanguage = null;

        // First try to find English title
        const expressions = result?.NOTICE?.EXPRESSION || [];
        for (const expr of expressions) {
            if (expr.EXPRESSION_USES_LANGUAGE?.[0]?.IDENTIFIER?.[0] === 'ENG' &&
                expr.EXPRESSION_TITLE?.[0]?.VALUE?.[0]) {
                title = expr.EXPRESSION_TITLE[0].VALUE[0].trim();
                titleLanguage = 'ENG';
                break;
            }
        }

        // Fallback to any available title if English not found
        if (!title) {
            const possibleTitlePaths = [
                expression.EXPRESSION_TITLE?.[0]?.VALUE?.[0],
                expression.TITLE?.[0]?.VALUE?.[0],
                result?.NOTICE?.WORK?.[0]?.EXPRESSION_TITLE?.[0]?.VALUE?.[0]
            ];

            for (const titlePath of possibleTitlePaths) {
                if (titlePath) {
                    title = titlePath.trim();
                    break;
                }
            }
        }

        // Extract parties with improved pattern matching
        let parties = null;
        if (title) {
            // Try multiple patterns for party extraction
            const partyPatterns = [
                /—\s*([^(]+?)\s*(?:\(|$)/,           // Standard format
                /between\s+([^(]+?)\s*(?:\(|$)/i,    // "between" format
                /:\s*([^(]+?)\s*(?:\(|$)/            // Colon format
            ];

            for (const pattern of partyPatterns) {
                const match = title.match(pattern);
                if (match && match[1]) {
                    parties = match[1].trim()
                        .replace(/\s+/g, ' ')         // Normalize spaces
                        .replace(/[""]/g, '"');       // Normalize quotes
                    break;
                }
            }
        }

        // Get AG name with improved extraction
        let agName = null;
        const agPaths = [
            result?.NOTICE?.WORK?.[0]?.['WORK_CREATED_BY_AGENT']?.[0]?.PREFLABEL?.[0],
            result?.NOTICE?.WORK?.[0]?.['CASE-LAW_DELIVERED_BY_ADVOCATE-GENERAL']?.[0]?.SAMEAS?.[0]?.URI?.[0]?.IDENTIFIER?.[0],
            expression?.['CASE-LAW_DELIVERED_BY_ADVOCATE-GENERAL']?.[0]?.VALUE?.[0]
        ];

        for (const path of agPaths) {
            if (path) {
                agName = path.trim();
                break;
            }
        }

        const metadata = {
            caseNumber,
            parties,
            title,
            titleLanguage,
            agName
        };

        // Log successful extraction
        console.log(`Extracted metadata for ${celexRef}:`, metadata);

        return metadata;

    } catch (error) {
        console.error(`XML metadata fetch failed for ${celexRef}:`, error.message);
        if (error.response?.status) {
            console.error(`Status code: ${error.response.status}`);
        }
        return null;
    }
} 