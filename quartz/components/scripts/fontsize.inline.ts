// Check if we have a saved font size, otherwise use default (1 = 100%)
const savedFontSize = parseFloat(localStorage.getItem("article-font-size") ?? "1")
document.documentElement.style.setProperty("--article-font-size", savedFontSize.toString())

document.addEventListener("nav", () => {
    // Initialize the font size label with the current value
    const fontSizeLabel = document.getElementById("font-size-label")
    if (fontSizeLabel) {
        fontSizeLabel.textContent = `${Math.round(savedFontSize * 100)}%`
    }

    // Function to update font size
    const updateFontSize = (newSize: number) => {
        // Limit font size between 70% and 200%
        const clampedSize = Math.max(0.7, Math.min(2.0, newSize))

        // Update CSS variable
        document.documentElement.style.setProperty("--article-font-size", clampedSize.toString())

        // Update the display label if it exists
        if (fontSizeLabel) {
            fontSizeLabel.textContent = `${Math.round(clampedSize * 100)}%`
        }

        // Save to localStorage
        localStorage.setItem("article-font-size", clampedSize.toString())

        // Create and dispatch a custom event
        const event = new CustomEvent("fontsizechange", {
            detail: { size: clampedSize }
        })
        document.dispatchEvent(event)
    }

    // Decrease font size button
    const decreaseButton = document.getElementById("font-decrease")
    if (decreaseButton) {
        const decreaseFontSize = () => {
            const currentSize = parseFloat(document.documentElement.style.getPropertyValue("--article-font-size") || "1")
            updateFontSize(currentSize - 0.1)
        }

        decreaseButton.addEventListener("click", decreaseFontSize)
        window.addCleanup(() => decreaseButton.removeEventListener("click", decreaseFontSize))
    }

    // Increase font size button
    const increaseButton = document.getElementById("font-increase")
    if (increaseButton) {
        const increaseFontSize = () => {
            const currentSize = parseFloat(document.documentElement.style.getPropertyValue("--article-font-size") || "1")
            updateFontSize(currentSize + 0.1)
        }

        increaseButton.addEventListener("click", increaseFontSize)
        window.addCleanup(() => increaseButton.removeEventListener("click", increaseFontSize))
    }
}) 