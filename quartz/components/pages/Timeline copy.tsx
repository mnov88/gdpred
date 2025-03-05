import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import style from "../styles/timeline.scss"

// Helper function to format dates
const formatDate = (dateStr: string): { month: string, year: string, full: string } => {
    try {
        const date = new Date(dateStr);
        return {
            month: date.toLocaleDateString('en-US', { month: 'long' }),
            year: date.toLocaleDateString('en-US', { year: 'numeric' }),
            full: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
    } catch (e) {
        return { month: 'Unknown', year: 'Unknown', full: 'Unknown date' };
    }
};

// Helper function to normalize folder names for case-insensitive comparison
const normalizeString = (str: string): string => {
    return str.toLowerCase().replace(/[\s-_]+/g, '');
};

const Timeline: QuartzComponent = (props: QuartzComponentProps) => {
    const { cfg, allFiles = [] } = props

    // Log environment information
    console.log(`Timeline rendering with baseUrl: ${cfg.baseUrl}`)
    console.log(`Total files available: ${allFiles.length}`)

    // Log the first 5 file paths to see what format they're in
    console.log("Sample file paths:", allFiles.slice(0, 5).map(f => f?.slug || 'undefined'))

    // Log all folder names to help diagnose case sensitivity issues
    const allFolders = new Set<string>();
    allFiles.forEach(file => {
        if (file?.slug && typeof file.slug === 'string') {
            const parts = file.slug.split('/');
            if (parts.length > 1) {
                allFolders.add(parts[0]);
            }
        }
    });
    console.log("All detected folders:", [...allFolders]);

    // More aggressive approach to find case files without relying on specific folder paths
    const caseFiles = allFiles.filter(file => {
        if (!file || typeof file !== 'object') return false

        const slug = file.slug
        const folder = file.frontmatter?.folder
        const title = file.frontmatter?.title
        const caseNumber = file.frontmatter?.['case-number']

        // Check if any of these criteria match to identify a case file
        // 1. Slug contains "case" in any form
        const slugContainsCase = typeof slug === 'string' && normalizeString(slug).includes('case')

        // 2. Slug is in the Case law folder (check multiple forms)
        const slugFolderParts = typeof slug === 'string' ? slug.split('/') : []
        const slugFolder = slugFolderParts.length > 0 ? slugFolderParts[0] : ''
        const normalizedSlugFolder = normalizeString(slugFolder)
        const isInCaseFolder = ['caselaw', 'case'].includes(normalizedSlugFolder)

        // 3. Frontmatter folder is Case law in any form
        const folderIsCase = typeof folder === 'string' &&
            ['caselaw', 'case'].includes(normalizeString(folder))

        // 4. Title starts with C- (likely a case number)
        const titleIsCaseNumber = typeof title === 'string' && /^C-\d+/.test(title)

        // 5. Has case-number field in frontmatter
        const hasCaseNumber = typeof caseNumber === 'string' && caseNumber.trim() !== ''

        // 6. Slug contains C- (common case file naming pattern)
        const slugHasCaseNumber = typeof slug === 'string' && slug.includes('C-')

        // 7. Direct check for exact folder name with various capitalizations
        const exactFolderMatch = typeof slugFolder === 'string' &&
            ['Case law', 'case law', 'Case Law', 'CASE LAW', 'case-law', 'Case-law'].includes(slugFolder)

        const isCase = isInCaseFolder || folderIsCase || titleIsCaseNumber ||
            hasCaseNumber || slugHasCaseNumber || slugContainsCase || exactFolderMatch

        if (isCase) {
            console.log(`Found case file: ${slug || 'unknown'} (reasons: ${[
                isInCaseFolder ? 'case folder' : '',
                folderIsCase ? 'case frontmatter' : '',
                titleIsCaseNumber ? 'case number in title' : '',
                hasCaseNumber ? 'has case-number' : '',
                slugHasCaseNumber ? 'C- in slug' : '',
                slugContainsCase ? 'case in slug' : '',
                exactFolderMatch ? 'exact folder match' : ''
            ].filter(Boolean).join(', ')})`)
        }

        return isCase
    })

    console.log(`Timeline found ${caseFiles.length} case files out of ${allFiles.length} total files`)

    // If no case files found, log more details about all files to diagnose
    if (caseFiles.length === 0) {
        console.log("No case files found. Examining folders:")
        const folders = new Set()
        allFiles.forEach(file => {
            if (file?.slug && typeof file.slug === 'string') {
                const parts = file.slug.split('/')
                if (parts.length > 1) {
                    folders.add(parts[0])
                }
            }
            if (file?.frontmatter?.folder) {
                folders.add(file.frontmatter.folder)
            }
        })
        console.log("Available folders:", [...folders])

        // Log some sample files to help diagnose
        console.log("Sample files for diagnosis:")
        allFiles.slice(0, 10).forEach(file => {
            if (file) {
                console.log({
                    slug: file.slug,
                    title: file.frontmatter?.title,
                    folder: file.frontmatter?.folder,
                    hasDate: !!file.frontmatter?.date || !!file.frontmatter?.created
                });
            }
        });
    }

    // Extract dates and sort
    const timelineItems = caseFiles
        .map(file => ({
            slug: file.slug ?? '',
            title: file.frontmatter?.title ?? file.slug ?? 'Untitled',
            date: file.frontmatter?.date ?? file.frontmatter?.created ?? null,
            caseNumber: file.frontmatter?.['case-number'] ?? '',
            parties: file.frontmatter?.parties ?? '',
        }))
        .filter(item => item.date !== null && typeof item.date === 'string') // Only include items with valid string dates
        .sort((a, b) => {
            try {
                // TypeScript now knows item.date is a string
                return new Date(b.date as string).getTime() - new Date(a.date as string).getTime() // Newest first
            } catch (e) {
                return 0 // If date parsing fails, don't change order
            }
        })

    // Group by month and year
    const groupedItems: Record<string, typeof timelineItems> = {}

    timelineItems.forEach(item => {
        // We've already filtered out null dates and ensured they're strings
        // But let's add an extra safety check
        if (!item.date || typeof item.date !== 'string') return;

        const { month, year } = formatDate(item.date);
        const groupKey = `${month} ${year}`;

        if (!groupedItems[groupKey]) {
            groupedItems[groupKey] = [];
        }

        groupedItems[groupKey].push(item);
    });

    return (
        <div className="timeline">
            {Object.keys(groupedItems).length > 0 ? (
                <div className="timeline-container">
                    {Object.entries(groupedItems).map(([monthYear, items], groupIndex) => (
                        <div key={groupIndex} className="timeline-group">
                            <h3 className="timeline-month-year">{monthYear}</h3>
                            <div className="timeline-items-group">
                                {items.map((item, i) => (
                                    <div key={i} className="timeline-item">
                                        <div className="timeline-content">
                                            <a href={`/${encodeURI(item.slug)}`} className="timeline-title">
                                                {item.caseNumber}
                                                <span className="timeline-title-text">{item.title !== item.caseNumber && item.title ? ` ${item.title}` : ''}</span>
                                            </a>
                                            {item.parties && <div className="timeline-parties">{item.parties}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p>No case law documents found. Please make sure documents are in the "Case law" folder and have a date field in their frontmatter.</p>
            )}
        </div>
    )
}

Timeline.css = style

export default (() => Timeline) satisfies QuartzComponentConstructor 