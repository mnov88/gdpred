import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import TimelineConstructor from "../../components/pages/Timeline"
import { defaultProcessedContent } from "../vfile"
import { write } from "./helpers"
import DepGraph from "../../depgraph"

export const TimelinePage: QuartzEmitterPlugin = () => {
    // Get Timeline constructor
    const Timeline = TimelineConstructor()

    // Use the defaultContentPageLayout but replace the Content component with our Timeline component
    const opts: FullPageLayout = {
        ...sharedPageComponents,
        ...defaultContentPageLayout,
        pageBody: Timeline,
    }

    const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
    const Header = HeaderConstructor()
    const Body = BodyConstructor()

    return {
        name: "TimelinePage",
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
            const slug = "timeline" as FullSlug

            const [tree, vfile] = defaultProcessedContent({
                slug,
                text: "# Case Law Timeline\n\nA chronological timeline of all case law documents in the GDPR Vault.",
                description: "A chronological timeline of all case law documents",
                frontmatter: {
                    title: "Case Law Timeline",
                    tags: ["timeline", "case-law"],
                    contentCount: content.length
                },
            })

            // Add all files to allFiles
            const allFiles = content.map(([_tree, vfile]) => vfile.data)

            // Add debug logging
            console.log(`TimelinePage emitter processing ${allFiles.length} files`)

            // Log a few sample files to verify content
            if (allFiles.length > 0) {
                console.log("Sample files for timeline:", allFiles.slice(0, 3).map(file => ({
                    slug: file.slug,
                    title: file.frontmatter?.title,
                    type: file.frontmatter?.type
                })))
            }

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