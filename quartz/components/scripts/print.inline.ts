const printScript = () => {
    // Only add print button on content pages, not on index or special pages
    if (document.body.dataset.slug === "index" || !document.querySelector(".center > article")) {
        return
    }

    // Create print button element
    const printButton = document.createElement("div")
    printButton.className = "print-button"
    printButton.setAttribute("aria-label", "Print page")
    printButton.setAttribute("title", "Print this page")

    // Add printer icon SVG
    printButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
    </svg>
  `

    // Enhanced print function to optimize print view
    printButton.addEventListener("click", () => {
        // Add a class to the body to activate additional print-specific styling
        document.body.classList.add("is-printing")

        // Create a cleaner title for the print
        const originalTitle = document.title
        const pageTitle = document.querySelector("h1")?.textContent || originalTitle
        document.title = pageTitle // Set a cleaner title for the print

        // Get the article content
        const article = document.querySelector(".center > article")

        // Expand any collapsed sections (if using collapsible elements)
        const collapsibles = article?.querySelectorAll(".collapsed, .is-collapsed, details:not([open])")
        const collapsibleStates = new Map()

        if (collapsibles?.length) {
            collapsibles.forEach((el, i) => {
                // Store original state
                if (el instanceof HTMLDetailsElement) {
                    collapsibleStates.set(i, !el.open)
                    el.open = true // Expand for printing
                } else if (el instanceof HTMLElement) {
                    collapsibleStates.set(i, true)
                    el.classList.remove("collapsed", "is-collapsed")
                }
            })
        }

        // Trigger the print dialog
        window.print()

        // Restore original state after printing
        setTimeout(() => {
            // Restore collapsible states
            if (collapsibles?.length) {
                collapsibles.forEach((el, i) => {
                    if (collapsibleStates.get(i)) {
                        if (el instanceof HTMLDetailsElement) {
                            el.open = false
                        } else if (el instanceof HTMLElement) {
                            el.classList.add("collapsed")
                        }
                    }
                })
            }

            // Restore title and remove print class
            document.title = originalTitle
            document.body.classList.remove("is-printing")
        }, 500) // Small delay to ensure print has finished
    })

    // Add button to the body
    document.body.appendChild(printButton)
}

document.addEventListener("DOMContentLoaded", printScript)

// Handle SPA navigation events for Quartz
document.addEventListener("nav", printScript)

export default printScript 