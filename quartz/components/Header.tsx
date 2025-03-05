import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Header: QuartzComponent = ({ children }: QuartzComponentProps) => {
  return children.length > 0 ? <header>{children}</header> : null
}

Header.css = `
header {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 2rem 0;
  color: yellow;
  gap: 1.5rem;
}

header h1 {
  margin: 0;
  font-size: 1rem;
  flex: auto;
  color: red;
}
`

export default (() => Header) satisfies QuartzComponentConstructor
