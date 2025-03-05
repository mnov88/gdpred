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
  font-size: 1.5rem;
  font-family: var(--headerFont);
  font-weight: 600;
  color: red;
  margin: 0;
}

.page-title a {
  color: var(--secondary);
  text-decoration: none;
}

.page-title a:hover {
  color: var(--tertiary);
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
