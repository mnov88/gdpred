function toggleArticleCases(this: HTMLElement) {
    this.classList.toggle("collapsed")
    this.setAttribute(
        "aria-expanded",
        this.getAttribute("aria-expanded") === "true" ? "false" : "true",
    )
    const content = this.nextElementSibling as HTMLElement | undefined
    if (!content) return
    content.classList.toggle("collapsed")
}

function setupArticleCases() {
    const articleCasesButton = document.getElementById("article-cases-button")
    if (articleCasesButton) {
        articleCasesButton.addEventListener("click", toggleArticleCases)
        window.addCleanup(() => articleCasesButton.removeEventListener("click", toggleArticleCases))
    }
}

document.addEventListener("nav", setupArticleCases) 