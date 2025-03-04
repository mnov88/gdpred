import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { TopicExplorer } from "../../components"
import { defaultProcessedContent } from "../vfile"
import { write } from "./helpers"
import DepGraph from "../../depgraph"

export const TopicExplorerPage: QuartzEmitterPlugin = () => {
    // Use the defaultContentPageLayout but replace the Content component with our TopicExplorer component
    const opts: FullPageLayout = {
        ...sharedPageComponents,
        ...defaultContentPageLayout,
        pageBody: TopicExplorer(),
    }

    const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
    const Header = HeaderConstructor()
    const Body = BodyConstructor()

    return {
        name: "TopicExplorerPage",
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
        async getDependencyGraph(_ctx, _content, _resources) {
            return new DepGraph<FilePath>()
        },
        async emit(ctx, content, resources): Promise<FilePath[]> {
            const cfg = ctx.cfg.configuration
            const slug = "topics-explorer" as FullSlug

            const [tree, vfile] = defaultProcessedContent({
                slug,
                text: "# GDPR Topics Explorer\n\nAn interactive explorer for browsing GDPR case law organized by topics.",
                description: "Interactive explorer for GDPR topics and related case law",
                frontmatter: { title: "GDPR Topics Explorer", tags: ["topics", "case-law", "gdpr"] },
            })

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