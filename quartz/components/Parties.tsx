import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Parties: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    // Get parties from frontmatter
    const parties = fileData.frontmatter?.parties

    // If no parties, don't display anything
    if (!parties || typeof parties !== 'string') {
        return null
    }

    return (
        <div class={`parties-subtitle ${displayClass ?? ""}`}>
            <h2 class="parties-text">{parties}</h2>
        </div>
    )
}

// Add component styling
Parties.css = `
.parties-subtitle {
  margin: 0.5rem 0 1rem 0;
  width: 75%;
}

.parties-text {
  font-size: 1.2rem;
  font-weight: 400;
  font-style: italic;
  color: var(--darkgray);
  margin: 0;
  line-height: 1.4;
  word-wrap: break-word;
  hyphens: auto;
}

@media (max-width: 800px) {
  .parties-subtitle {
    margin: 0.25rem 0 0.75rem 0;
    width: 100%; /* Full width on mobile */
  }
  
  .parties-text {
    font-size: 1.1rem;
  }
}
`

export default (() => Parties) satisfies QuartzComponentConstructor 