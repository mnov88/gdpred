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

// Helper function to check if a string is in a list case-insensitively
const isInList = (str: string | null | undefined, list: string[]): boolean => {
    if (!str) return false;
    const normalized = normalizeString(str);
    return list.some(item => normalizeString(item) === normalized);
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

    // Find case files using multiple methods, prioritizing frontmatter fields
    const caseFiles = allFiles.filter(file => {
        if (!file || typeof file !== 'object') return false

        // Primary method: Use explicit type field in frontmatter
        if (file.frontmatter?.type && 
            typeof file.frontmatter.type === 'string' && 
            normalizeString(file.frontmatter.type) === 'case') {
            console.log(`Found case by type: ${file.slug}`)
            return true
        }

        // Check for case-number in frontmatter (most reliable)
        if (file.frontmatter?.['case-number']) {
            console.log(`Found case by case-number: ${file.slug}`)
            return true
        }

        // Check explicit case tag
        if (Array.isArray(file.frontmatter?.tags) &&
            file.frontmatter.tags.some(tag =>
                typeof tag === 'string' && 
                ['case', 'case-law', 'caselaw'].some(caseTag => 
                    normalizeString(tag) === normalizeString(caseTag))
            )) {
            console.log(`Found case by tags: ${file.slug}`)
            return true
        }

        // Check in Case law folder
        const slug = file.slug
        if (typeof slug === 'string') {
            const parts = slug.split('/')
            if (parts.length > 0) {
                const folder = normalizeString(parts[0])
                if (['caselaw', 'case', 'caselaw', 'case law'].some(f => normalizeString(f) === folder)) {
                    console.log(`Found case by folder path: ${file.slug}`)
                    return true
                }
            }
        }

        // Check folder frontmatter field
        const frontmatterFolder = file.frontmatter?.folder
        if (typeof frontmatterFolder === 'string' &&
            ['caselaw', 'case', 'case-law', 'case law'].some(f => 
                normalizeString(frontmatterFolder) === normalizeString(f))) {
            console.log(`Found case by frontmatter folder: ${file.slug}`)
            return true
        }

        // Title starts with C- (likely a case number)
        const title = file.frontmatter?.title
        if (typeof title === 'string' && /^C-\d+/i.test(title)) {  // Added 'i' flag for case-insensitive
            console.log(`Found case by C- in title: ${file.slug}`)
            return true
        }

        return false
    })

    console.log(`Timeline found ${caseFiles.length} case files out of ${allFiles.length} total files`)

    // If no case files found, log more details about all files to diagnose
    if (caseFiles.length === 0) {
        console.log("No case files found. Examining folders:")
        const folders = new Set()
        const frontmatterFields = new Set()

        allFiles.forEach(file => {
            if (file?.slug && typeof file.slug === 'string') {
                const parts = file.slug.split('/')
                if (parts.length > 1) {
                    folders.add(parts[0])
                }
            }

            // Log all frontmatter fields to help debug
            if (file?.frontmatter) {
                Object.keys(file.frontmatter).forEach(key => frontmatterFields.add(key))
            }
        })

        console.log("Available folders:", [...folders])
        console.log("Available frontmatter fields:", [...frontmatterFields])

        // Log some sample files to help diagnose
        console.log("Sample files for diagnosis:")
        allFiles.slice(0, 10).forEach(file => {
            if (file) {
                console.log({
                    slug: file.slug,
                    title: file.frontmatter?.title,
                    folder: file.frontmatter?.folder,
                    type: file.frontmatter?.type,
                    tags: file.frontmatter?.tags,
                    hasDate: !!file.frontmatter?.date || !!file.frontmatter?.created,
                    caseNumber: file.frontmatter?.['case-number'],
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
                const aTime = new Date(a.date as string).getTime();
                const bTime = new Date(b.date as string).getTime();
                
                // Check if valid dates were parsed
                if (!isNaN(aTime) && !isNaN(bTime)) {
                    return bTime - aTime; // Newest first
                }
                return 0; // If either date is invalid, don't change order
            } catch (e) {
                console.error("Error sorting timeline items:", e);
                return 0; // If date parsing fails, don't change order
            }
        });

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
                <div className="no-timeline-data">
                    <h3>No case law documents found</h3>
                    <p>Please make sure your case documents have one of the following:</p>
                    <ul>
                        <li>A <code>type: case</code> field in the frontmatter</li>
                        <li>A <code>case-number</code> field in the frontmatter</li>
                        <li>Tags including "case" or "case-law"</li>
                        <li>Are placed in a "Case law" folder</li>
                    </ul>
                    <p>All case documents should also have a <code>date</code> or <code>created</code> field in their frontmatter.</p>
                </div>
            )}
        </div>
    )
}

Timeline.css = style

export default (() => Timeline) satisfies QuartzComponentConstructor 