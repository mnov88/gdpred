import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content, Graph } from "../../components"
import { write } from "./helpers"
import DepGraph from "../../depgraph"

export const CustomIndexPage: QuartzEmitterPlugin = () => {
    // Custom layout for the index page - without ContentMeta (date), Graph, and ArticleTitle
    const opts: FullPageLayout = {
        ...sharedPageComponents,
        pageBody: Content(),
        // Create a custom beforeBody array without the ContentMeta or ArticleTitle components
        beforeBody: [
            // Only include components from defaultContentPageLayout.beforeBody that are NOT ContentMeta or ArticleTitle
            ...defaultContentPageLayout.beforeBody.filter(component => {
                const componentStr = component.toString()
                return !componentStr.includes("ContentMeta") &&
                    !componentStr.includes("contentMeta") &&
                    !componentStr.includes("ArticleTitle")
            })
        ],
        // Keep the left sidebar as is
        left: [...defaultContentPageLayout.left],
        // Add Graph above TableOfContents, but remove Backlinks
        right: [
            Graph(),
            ...defaultContentPageLayout.right.filter(component => {
                const componentStr = component.toString()
                return componentStr.includes("TableOfContents") &&
                    !componentStr.includes("Backlinks")
            })
        ],
        // Empty afterBody 
        afterBody: []
    }

    const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
    const Header = HeaderConstructor()
    const Body = BodyConstructor()

    return {
        name: "CustomIndexPage",
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
            if (vfile.data.filePath) {
                graph.addNode(vfile.data.filePath)
            }
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