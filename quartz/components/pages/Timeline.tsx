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

const Timeline: QuartzComponent = (props: QuartzComponentProps) => {
    const { cfg, allFiles = [] } = props

    // Log environment information
    console.log(`Timeline rendering with baseUrl: ${cfg.baseUrl}`)
    console.log(`Total files available: ${allFiles.length}`)

    // Log the first 5 file paths to see what format they're in
    console.log("Sample file paths:", allFiles.slice(0, 5).map(f => f?.slug || 'undefined'))

    // Filter for files in the Case law folder with improved case-insensitive matching
    const caseFiles = allFiles.filter(file => {
        if (!file || typeof file !== 'object') return false

        const slug = file.slug
        const folder = file.frontmatter?.folder

        // Convert to lowercase for case-insensitive comparison
        const slugLower = typeof slug === 'string' ? slug.toLowerCase() : null
        const folderLower = typeof folder === 'string' ? folder.toLowerCase() : null

        // Check various forms of the case-law path
        const caseLawFormats = ["case-law/", "case law/", "caselaw/"]

        const matchesSlug = slugLower && caseLawFormats.some(format => slugLower.startsWith(format))
        const matchesFolder = folderLower && ["case law", "case-law", "caselaw"].includes(folderLower)

        // Log matches for diagnostic purposes
        if (matchesSlug || matchesFolder) {
            console.log(`Found matching case file: ${slug || 'unknown'}, folder: ${folder || 'unknown'}`)
        }

        return matchesSlug || matchesFolder
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
        .filter(item => item.date !== null) // Only include items with dates
        .sort((a, b) => {
            try {
                return new Date(b.date).getTime() - new Date(a.date).getTime() // Newest first
            } catch (e) {
                return 0 // If date parsing fails, don't change order
            }
        })

    // Group by month and year
    const groupedItems: Record<string, typeof timelineItems> = {}

    timelineItems.forEach(item => {
        if (!item.date) return;

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
                                            <a href={`/${item.slug}`} className="timeline-title">
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