import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const NowReading: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    // Get ruling-articles from frontmatter
    const rulingArticles = fileData.frontmatter?.["ruling-articles"] || []

    // If no ruling articles, don't display anything
    if (!Array.isArray(rulingArticles) || rulingArticles.length === 0) {
        return null
    }

    return (
        <div class={`ruling-articles ${displayClass ?? ""}`}>
            <div class="ruling-articles-container">
                {rulingArticles.map((article, index) => (
                    <span class="article-chip" key={index}>{article}</span>
                ))}
            </div>
        </div>
    )
}

// Add component styling
NowReading.css = `
.ruling-articles {
  margin: 0.5rem 0 1.5rem 0;
  padding: 0.75rem;
  background-color: var(--light);
  border-radius: 0.5rem;
}

.ruling-articles-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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
    margin: 0.25rem 0 1.25rem 0;
    padding: 0.5rem;
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