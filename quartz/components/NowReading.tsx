import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { pathToRoot } from "../util/path"

const NowReading: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Get ruling-articles from frontmatter
  const rulingArticles = fileData.frontmatter?.["ruling-articles"] || []

  // If no ruling articles, don't display anything
  if (!Array.isArray(rulingArticles) || rulingArticles.length === 0) {
    return null
  }

  const baseDir = pathToRoot(fileData.slug!)

  return (
    <div class={`ruling-articles ${displayClass ?? ""}`}>
      <div class="ruling-articles-container">
        {rulingArticles.map((article, index) => {
          // Ensure article is a string
          const articleStr = String(article)
          // Extract the article number for linking - handle both [[Article X]] and Article X formats
          const articleMatch = articleStr.match(/(?:\[\[)?Article\s+(\d+)(?:\]\])?/i)
          const articleNumber = articleMatch ? articleMatch[1] : null
          const linkUrl = articleNumber ? `${baseDir}/Articles/Article-${articleNumber}` : null

          // For display, remove the [[ and ]] if present
          const displayText = articleStr.replace(/\[\[|\]\]/g, '')

          return linkUrl ? (
            <a href={linkUrl} class="article-chip-link" key={index}>
              <span class="article-chip">{displayText}</span>
            </a>
          ) : (
            <span class="article-chip" key={index}>{displayText}</span>
          )
        })}
      </div>
    </div>
  )
}

// Add component styling
NowReading.css = `
.ruling-articles {
  margin: 0.25rem 0 0.75rem 0;
  padding: 0.5rem;
  background-color: var(--light);
  border-radius: 0.5rem;
}

.ruling-articles-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.article-chip-link {
  text-decoration: none;
}

.article-chip {
  display: inline-flex;
  align-items: center;
  background-color: var(--lightgray);
  color: var(--darkgray);
  border-radius: 1rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.2s ease, color 0.2s ease;
  cursor: pointer;
}

.article-chip:hover {
  background-color: var(--secondary);
  color: white;
}

@media (max-width: 800px) {
  .ruling-articles {
    margin: 0.15rem 0 0.5rem 0;
    padding: 0.35rem;
  }
  
  .ruling-articles-container {
    gap: 0.35rem;
  }
  
  .article-chip {
    font-size: 0.85rem;
    padding: 0.2rem 0.6rem;
  }
}
`

export default (() => NowReading) satisfies QuartzComponentConstructor 