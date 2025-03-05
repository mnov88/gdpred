import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/print.inline"

function PrintButton(): QuartzComponent {
    function Component() {
        // Empty component, all functionality is in the script
        return null
    }

    // Add the script to be executed after DOM is loaded
    Component.afterDOMLoaded = script

    return Component
}

export default (() => PrintButton()) satisfies QuartzComponentConstructor 