import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import ArticleTitle from "../ArticleTitle"
import style from "../styles/topicExplorer.scss"
import { FullSlug, resolveRelative } from "../../util/path"

// Helper function to count cases in a category
const countCasesInCategory = (topics: Record<string, any[]>) => {
    return Object.values(topics).reduce((sum, cases) => sum + cases.length, 0)
}

// Helper function to parse case number from slug
const getCaseNumberFromSlug = (slug: string): string => {
    const match = slug.match(/C-(\d+-\d+)/)
    return match ? `C-${match[1]}` : slug.split('/').pop() || ''
}

const TopicExplorer: QuartzComponent = (props: QuartzComponentProps) => {
    const { allFiles, fileData, displayClass } = props

    // Get all case law files
    const caseFiles = allFiles.filter(file => {
        if (!file || !file.slug) return false

        const slug = file.slug
        const folder = file.frontmatter?.folder

        return (
            (typeof slug === 'string' && (
                slug.startsWith("Case-law/") ||
                slug.toLowerCase().startsWith("case-law/")
            )) ||
            (typeof folder === 'string' && (
                folder === "Case law" ||
                folder === "Case-law"
            ))
        )
    })

    // Build topic structure from Topics.md content
    // This is a simplified version - in the actual implementation,
    // we would parse the Topics.md file or use frontmatter tags

    // Example structure for demo purposes
    const topicStructure: Record<string, Record<string, any[]>> = {
        "Data processing principles": {
            "Lawfulness of processing": caseFiles.filter(f =>
                f.slug?.includes("C-175-20") ||
                f.slug?.includes("C-205-21") ||
                f.slug?.includes("C-306-21") ||
                f.slug?.includes("C-34-21") ||
                f.slug?.includes("C-394-23") ||
                f.slug?.includes("C-60-22") ||
                f.slug?.includes("C-621-22")
            ),
            "Data minimization": caseFiles.filter(f =>
                f.slug?.includes("C-205-21") ||
                f.slug?.includes("C-394-23") ||
                f.slug?.includes("C-446-21")
            ),
            "Purpose limitation": caseFiles.filter(f =>
                f.slug?.includes("C-205-21") ||
                f.slug?.includes("C-77-21") ||
                f.slug?.includes("C-446-21")
            ),
            "Storage limitation": caseFiles.filter(f =>
                f.slug?.includes("C-77-21")
            ),
            "Necessity of processing": caseFiles.filter(f =>
                f.slug?.includes("C-65-23") ||
                f.slug?.includes("C-621-22") ||
                f.slug?.includes("C-667-21")
            ),
            "Legitimate interests": caseFiles.filter(f =>
                f.slug?.includes("C-621-22")
            ),
        },
        "Controllers and processors": {
            "Concept of controller": caseFiles.filter(f =>
                f.slug?.includes("C-231-22") ||
                f.slug?.includes("C-272-19") ||
                f.slug?.includes("C-807-21") ||
                f.slug?.includes("C-461-22")
            ),
            "Joint control and responsibility": caseFiles.filter(f =>
                f.slug?.includes("C-683-21") ||
                f.slug?.includes("C-604-22") ||
                f.slug?.includes("C-60-22")
            ),
            "Accountability and liability": caseFiles.filter(f =>
                f.slug?.includes("C-340-21") ||
                f.slug?.includes("C-741-21") ||
                f.slug?.includes("C-687-21") ||
                f.slug?.includes("C-667-21")
            ),
        },
        "Data subject rights": {
            "Right of access": caseFiles.filter(f =>
                f.slug?.includes("C-307-22") ||
                f.slug?.includes("C-487-21") ||
                f.slug?.includes("C-272-19") ||
                f.slug?.includes("C-579-21")
            ),
            "Right to erasure": caseFiles.filter(f =>
                f.slug?.includes("C-129-21") ||
                f.slug?.includes("C-200-23") ||
                f.slug?.includes("C-231-22") ||
                f.slug?.includes("C-60-22")
            ),
            "Right to object": caseFiles.filter(f =>
                f.slug?.includes("C-394-23")
            ),
        }
    }

    return (
        <div className={`topic-explorer ${displayClass ?? ""}`}>
            <h1 className="article-title">GDPR Topics Explorer</h1>

            <div className="filters">
                <input type="text" placeholder="Filter topics..." className="topic-filter" />
            </div>

            {Object.entries(topicStructure).map(([category, topics], categoryIndex) => (
                <details className="topic-category" open key={categoryIndex}>
                    <summary className="category-header">
                        <h2 className="category-name">{category}</h2>
                        <span className="case-count">{countCasesInCategory(topics)}</span>
                    </summary>
                    <div className="topic-list">
                        {Object.entries(topics).map(([topic, cases], topicIndex) => (
                            <details className="topic-item" key={`${categoryIndex}-${topicIndex}`}>
                                <summary className="topic-header">
                                    <h3 className="topic-name">{topic}</h3>
                                    <span className="case-count">{cases.length}</span>
                                </summary>
                                <ul className="case-list">
                                    {cases.map((caseFile, caseIndex) => {
                                        if (!caseFile.slug) return null

                                        const caseNumber = caseFile.frontmatter?.['case-number'] ||
                                            getCaseNumberFromSlug(caseFile.slug)

                                        return (
                                            <li className="case-item" key={`${categoryIndex}-${topicIndex}-${caseIndex}`}>
                                                <a
                                                    href={resolveRelative(fileData.slug!, caseFile.slug as FullSlug)}
                                                    className="case-link"
                                                >
                                                    <span className="case-number">{caseNumber}</span>
                                                    <span className="case-title">{caseFile.frontmatter?.title}</span>
                                                </a>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </details>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    )
}

TopicExplorer.css = style

export default (() => TopicExplorer) satisfies QuartzComponentConstructor 