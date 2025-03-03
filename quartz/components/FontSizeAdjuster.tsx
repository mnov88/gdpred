// @ts-ignore: this is safe for the same reason as darkmode.inline.ts
import fontSizeScript from "./scripts/fontsize.inline"
import styles from "./styles/fontsize.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const FontSizeAdjuster: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
        <div class={classNames(displayClass, "fontsize-adjuster")}>
            <button id="font-decrease" aria-label="Decrease font size">
                <span class="font-icon small">A</span>
            </button>
            <span id="font-size-label" aria-hidden="true">100%</span>
            <button id="font-increase" aria-label="Increase font size">
                <span class="font-icon large">A</span>
            </button>
        </div>
    )
}

FontSizeAdjuster.beforeDOMLoaded = fontSizeScript
FontSizeAdjuster.css = styles

export default (() => FontSizeAdjuster) satisfies QuartzComponentConstructor 