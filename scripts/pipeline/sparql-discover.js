import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CASE_LAW_DIR = path.join(ROOT, 'content', 'Case law');
const OUTPUT_FILE = path.join(__dirname, 'new-cases.json');

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql';

const SPARQL_QUERY = `
define sql:signal-void-variables 0

PREFIX cdm:   <http://publications.europa.eu/ontology/cdm#>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX annot: <http://publications.europa.eu/ontology/annotation#>

SELECT
  ?actCelex
  (SAMPLE(?actTitle0)        AS ?actTitle)
  (SAMPLE(?actShortTitle1)   AS ?actShortTitle)
  (SAMPLE(?entryIntoForce0)  AS ?actEntryIntoForce)

  ?caseCelex
  (SAMPLE(?caseNumber0)      AS ?caseNumber)
  (MAX(?caseDate0)           AS ?caseDate)
  (SAMPLE(?caseShortTitle1)  AS ?caseShortTitle)
  (SAMPLE(?caseParties0)     AS ?caseParties)
  (GROUP_CONCAT(DISTINCT STR(?loc0); SEPARATOR=", ") AS ?modifiedLocations)

  (SAMPLE(?caseTitle0)       AS ?caseTitle)
WHERE {
  BIND(<http://publications.europa.eu/resource/celex/32016R0679> AS ?actCelexURI)
  BIND("32016R0679" AS ?actCelex)
  BIND(<http://publications.europa.eu/resource/authority/language/ENG> AS ?lang)

  ?actWork owl:sameAs ?actCelexURI .
  OPTIONAL { ?actWork cdm:resource_legal_date_entry-into-force ?entryIntoForce0 . }

  OPTIONAL {
    ?actExpr cdm:expression_belongs_to_work ?actWork ;
            cdm:expression_uses_language ?lang .
    OPTIONAL { ?actExpr cdm:expression_title ?actTitle0 . }
    OPTIONAL { ?actExpr cdm:expression_title_short ?actShort0 . }
    BIND(COALESCE(STR(?actShort0), STR(?actTitle0)) AS ?actShortTitle1)
  }

  ?caseWork cdm:case-law_interpretes_resource_legal ?actWork .

  OPTIONAL { ?caseWork cdm:resource_legal_id_celex ?caseCelex0 . }
  OPTIONAL { ?caseWork owl:sameAs ?caseCelexURI . }
  BIND(COALESCE(?caseCelex0, REPLACE(STR(?caseCelexURI), "^.*/", "")) AS ?caseCelex)

  OPTIONAL { ?caseWork cdm:work_date_document ?d1 . }
  OPTIONAL { ?caseWork cdm:date_creation_legacy ?d2 . }
  BIND(COALESCE(?d1, ?d2) AS ?caseDate0)

  OPTIONAL {
    ?caseExpr cdm:expression_belongs_to_work ?caseWork ;
             cdm:expression_uses_language ?lang .
    OPTIONAL { ?caseExpr cdm:expression_title ?caseTitle0 . }
    OPTIONAL { ?caseExpr cdm:expression_title_short ?caseShort0 . }
    OPTIONAL { ?caseExpr cdm:expression_case-law_parties ?caseParties0 . }
    OPTIONAL { ?caseExpr cdm:expression_case-law_identifier_case ?caseNumber0 . }

    BIND(
      COALESCE(
        STR(?caseShort0),
        IF(BOUND(?caseTitle0) && CONTAINS(STR(?caseTitle0), "#"),
           STRBEFORE(STR(?caseTitle0), "#"),
           STR(?caseTitle0)
        )
      ) AS ?caseShortTitle1
    )
  }

  OPTIONAL {
    ?ax owl:annotatedSource   ?caseWork ;
        owl:annotatedProperty cdm:case-law_interpretes_resource_legal ;
        owl:annotatedTarget   ?actWork .
    OPTIONAL { ?ax annot:reference_to_modified_location ?loc0 . }
  }
}
GROUP BY ?actCelex ?caseCelex
ORDER BY DESC(MAX(?caseDate0)) ?caseCelex
`;

/**
 * Convert CELEX ID to case number.
 * "62023CJ0492" -> "C-492/23"
 */
export function celexToCaseNumber(celex) {
  const match = celex.match(/^6(\d{4})CJ(\d+)$/);
  if (!match) return null;
  const year = match[1];
  const num = parseInt(match[2], 10);
  const shortYear = year.substring(2);
  return `C-${num}/${shortYear}`;
}

/**
 * Convert case number to filename format.
 * "C-492/23" -> "C-492-23"
 */
export function caseNumberToFilename(caseNumber) {
  return caseNumber.replace('/', '-');
}

/**
 * Parse modifiedLocations from SPARQL into article references.
 * "A04P4, A05P2, A24, A25" -> ["Article 4", "Article 5", "Article 24", "Article 25"]
 */
export function parseModifiedLocations(modLoc) {
  if (!modLoc) return [];
  return [...new Set(
    modLoc.split(/,\s*/)
      .map(code => {
        const match = code.match(/^A(\d+)/);
        return match ? `Article ${parseInt(match[1], 10)}` : null;
      })
      .filter(Boolean)
  )].sort((a, b) => {
    return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
  });
}

/**
 * Parse case number from the SPARQL caseNumber field.
 * "Case C-492/23" -> "C-492/23"
 */
function parseCaseNumber(rawCaseNumber) {
  if (!rawCaseNumber) return null;
  const match = rawCaseNumber.match(/(?:Case\s+)?(C[-‑]\d+\/\d+)/i);
  if (match) {
    return match[1].replace(/‑/g, '-');
  }
  return null;
}

/**
 * Get set of existing case filenames (without extension).
 */
function getExistingCases() {
  const existing = new Set();
  if (!fs.existsSync(CASE_LAW_DIR)) return existing;

  const files = fs.readdirSync(CASE_LAW_DIR);
  for (const file of files) {
    if (file.endsWith('.md') && !file.endsWith('.backup') && !file.endsWith('.bak_auto')) {
      existing.add(file.replace('.md', ''));
    }
  }
  return existing;
}

/**
 * Query SPARQL endpoint and return parsed results.
 */
async function querySparql() {
  const body = new URLSearchParams({ query: SPARQL_QUERY });

  const response = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Discover new cases not yet in the repo.
 * Returns array of case objects.
 */
export async function discoverNewCases() {
  console.log('[SPARQL] Querying Publications Office for GDPR case law...');

  const data = await querySparql();
  const bindings = data.results?.bindings || [];
  console.log(`[SPARQL] Got ${bindings.length} total case records from SPARQL.`);

  const existingCases = getExistingCases();
  console.log(`[SPARQL] Found ${existingCases.size} existing case files in content/Case law/.`);

  const newCases = [];

  for (const binding of bindings) {
    const caseCelex = binding.caseCelex?.value;
    if (!caseCelex) continue;

    // Only process Court of Justice judgments (CJ), not pending cases (CN)
    if (!caseCelex.match(/^\d{4,5}CJ\d+$/)) continue;

    // Try to get case number from SPARQL caseNumber field, fall back to CELEX parsing
    let caseNumber = parseCaseNumber(binding.caseNumber?.value);
    if (!caseNumber) {
      caseNumber = celexToCaseNumber(caseCelex);
    }
    if (!caseNumber) continue;

    const filename = caseNumberToFilename(caseNumber);

    // Skip if already exists
    if (existingCases.has(filename)) continue;

    // Skip joined cases for now (flag for manual review)
    if (caseNumber.includes(' and ') || caseNumber.includes(',')) {
      console.log(`[SPARQL] Skipping joined case: ${caseNumber} (${caseCelex})`);
      continue;
    }

    newCases.push({
      caseCelex,
      caseNumber,
      filename,
      caseDate: binding.caseDate?.value || null,
      caseParties: binding.caseParties?.value || null,
      caseShortTitle: binding.caseShortTitle?.value || null,
      caseTitle: binding.caseTitle?.value || null,
      modifiedLocations: binding.modifiedLocations?.value || null,
    });
  }

  // Deduplicate by caseCelex
  const seen = new Set();
  const dedupedCases = newCases.filter(c => {
    if (seen.has(c.caseCelex)) return false;
    seen.add(c.caseCelex);
    return true;
  });

  console.log(`[SPARQL] Found ${dedupedCases.length} new case(s) not in repo.`);

  if (dedupedCases.length > 0) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dedupedCases, null, 2));
    console.log(`[SPARQL] Wrote new-cases.json with ${dedupedCases.length} entries.`);
  }

  return dedupedCases;
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  discoverNewCases()
    .then(cases => {
      if (cases.length === 0) {
        console.log('[SPARQL] No new cases found.');
        process.exit(1);
      }
      for (const c of cases) {
        console.log(`  - ${c.caseNumber} (${c.caseCelex}) ${c.caseDate || 'no date'}`);
      }
    })
    .catch(err => {
      console.error('[SPARQL] Error:', err.message);
      process.exit(2);
    });
}
