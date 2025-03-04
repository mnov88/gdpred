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

        return (
            // Check slug against our case-insensitive formats
            (slugLower && caseLawFormats.some(format => slugLower.startsWith(format))) ||
            // Check folder against our case-insensitive formats
            (folderLower && ["case law", "case-law", "caselaw"].includes(folderLower))
        )
    })

    console.log(`Timeline found ${caseFiles.length} case files out of ${allFiles.length} total files`)

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