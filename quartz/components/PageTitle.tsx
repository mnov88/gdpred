import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={baseDir}>{title}</a>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1rem;
  font-family: 'Press Start 2P', monospace;
  font-weight: 400;
  color:rgb(88, 101, 201);
  margin: 0;
  letter-spacing: 0.5px;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 1);
  line-height: 1.6;
}

.page-title a {
  color: #4a6fa5;
  text-decoration: none;
}

.page-title a:hover {
  color: #6e93c8;
  text-shadow: 1px 1px 1px rgba(28, 28, 28, 0.15);
  transition: all 0.2s ease;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
