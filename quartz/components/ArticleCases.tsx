import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/article-cases.scss"
import { resolveRelative } from "../util/path"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/article-cases.inline"

interface ArticleCasesOptions {
    hideWhenEmpty: boolean
    title: string
    defaultCollapseState: boolean
}

const defaultOptions: ArticleCasesOptions = {
    hideWhenEmpty: true,
    title: "Cases Referencing This Article",
    defaultCollapseState: false
}

export default ((opts?: Partial<ArticleCasesOptions>) => {
    const options: ArticleCasesOptions = { ...defaultOptions, ...opts }

    const ArticleCases: QuartzComponent = ({
        fileData,
        allFiles,
        displayClass,
        cfg,
    }: QuartzComponentProps) => {
        // Extract article number from the current page filename
        const slug = fileData.slug!
        const articleMatch = slug.match(/article[- ](\d+)/i)

        if (!articleMatch) {
            return null // Not an article page
        }

        const articleNumber = articleMatch[1]

        // Find all files that have this article in their ruling-articles frontmatter
        const referencingCases = allFiles.filter(file => {
            const rulingArticles = file.frontmatter?.["ruling-articles"] || []
            if (!Array.isArray(rulingArticles)) return false

            // Check if any ruling article contains this article number
            return rulingArticles.some(article => {
                const articleStr = String(article)
                return articleStr.match(new RegExp(`article\\s*${articleNumber}\\b`, 'i'))
            })
        })

        if (options.hideWhenEmpty && referencingCases.length === 0) {
            return null
        }

        return (
            <div class={classNames(displayClass, "article-cases")}>
                <button
                    type="button"
                    id="article-cases-button"
                    class={options.defaultCollapseState ? "collapsed" : ""}
                    aria-controls="article-cases-content"
                    aria-expanded={!options.defaultCollapseState}
                >
                    <h3>{options.title}</h3>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="fold"
                    >
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div id="article-cases-content" class={options.defaultCollapseState ? "collapsed" : ""}>
                    <ul class="overflow">
                        {referencingCases.length > 0 ? (
                            referencingCases.map((f) => (
                                <li>
                                    <a href={resolveRelative(fileData.slug!, f.slug!)} class="internal" data-for={f.slug}>
                                        <div class="case-title">{f.frontmatter?.title}</div>
                                        {f.frontmatter?.date && (
                                            <div class="case-date">
                                                {new Date(f.frontmatter.date).toLocaleDateString(cfg.locale, {
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </div>
                                        )}
                                        {f.frontmatter?.parties && (
                                            <div class="case-parties">
                                                {String(f.frontmatter.parties)}
                                            </div>
                                        )}
                                    </a>
                                </li>
                            ))
                        ) : (
                            <li>No cases reference this article.</li>
                        )}
                    </ul>
                </div>
            </div>
        )
    }

    ArticleCases.css = style
    ArticleCases.afterDOMLoaded = script

    return ArticleCases
}) satisfies QuartzComponentConstructor 