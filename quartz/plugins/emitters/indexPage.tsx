import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import { write } from "./helpers"
import DepGraph from "../../depgraph"

export const IndexPage: QuartzEmitterPlugin = () => {
    // Custom layout for the index page - without ContentMeta, Graph, and Backlinks
    const opts: FullPageLayout = {
        ...sharedPageComponents,
        ...defaultContentPageLayout,
        pageBody: Content(),
        // Create a custom beforeBody array without the ContentMeta component
        beforeBody: [
            ...defaultContentPageLayout.beforeBody.filter(component => {
                // Check component constructor name or string representation to identify ContentMeta
                const componentStr = component.toString()
                return !componentStr.includes("ContentMeta") && !componentStr.includes("contentMeta")
            })
        ],
        // Remove Graph and Backlinks components from the right sidebar
        right: [
            // Only keep TableOfContents
            ...defaultContentPageLayout.right.filter(component => {
                const componentStr = component.toString()
                return componentStr.includes("TableOfContents") &&
                    !componentStr.includes("Graph") &&
                    !componentStr.includes("Backlinks")
            })
        ],
    }

    const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
    const Header = HeaderConstructor()
    const Body = BodyConstructor()

    return {
        name: "IndexPage",
        getQuartzComponents() {
            return [
                Head,
                Header,
                Body,
                ...header,
                ...beforeBody,
                pageBody,
                ...afterBody,
                ...left,
                ...right,
                Footer,
            ]
        },
        async getDependencyGraph(_ctx, content, _resources) {
            // Only process index.md file
            const indexFile = content.find(([_tree, vfile]) => vfile.data.slug === "index")
            if (!indexFile) {
                return new DepGraph<FilePath>()
            }

            const graph = new DepGraph<FilePath>()
            const [_tree, vfile] = indexFile
            graph.addNode(vfile.data.filePath)
            return graph
        },
        async emit(ctx, content, resources): Promise<FilePath[]> {
            const cfg = ctx.cfg.configuration

            // Find the index file
            const indexFile = content.find(([_tree, vfile]) => vfile.data.slug === "index")
            if (!indexFile) {
                return []
            }

            const [tree, vfile] = indexFile
            const slug = "index" as FullSlug

            // Add all files to allFiles
            const allFiles = content.map(([_tree, vfile]) => vfile.data)

            const externalResources = pageResources(slug, vfile.data, resources)
            const componentData: QuartzComponentProps = {
                ctx,
                fileData: vfile.data,
                externalResources,
                cfg,
                children: [],
                tree,
                allFiles,
            }

            return [
                await write({
                    ctx,
                    content: renderPage(cfg, slug, componentData, opts, externalResources),
                    slug,
                    ext: ".html",
                }),
            ]
        },
    }
} 