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
  font-family: 'Press Start 2P';
  color: var(--secondary);
  line-height: 1.8;
  padding: 0.5em;
  border-radius: 4px;
  
  /* Base size for mobile devices */
  font-size: 0.9rem;
  
  /* Scale up for larger devices */
  @media (min-width: 768px) {
    font-size: 1.3rem;
  }
  
  /* Even larger for desktop */
  @media (min-width: 1024px) {
    font-size: 2.2rem;
  }
}


`

export default (() => PageTitle) satisfies QuartzComponentConstructor
