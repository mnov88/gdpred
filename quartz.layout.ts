import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.Parties(),
    Component.ContentMeta(),
    Component.NowReading(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    //   Component.FontSizeAdjuster(),
    Component.Explorer({
      sortFn: (a, b) => {
        // Check if we're in the Case law folder (handling both "Case law" and "Case-law" paths)
        const isAInCaseLaw = a.file?.slug?.startsWith("Case-law/") || 
                            a.file?.slug?.startsWith("Case law/") || 
                            a.name === "Case-law" || 
                            a.name === "Case law";
        const isBInCaseLaw = b.file?.slug?.startsWith("Case-law/") || 
                            b.file?.slug?.startsWith("Case law/") || 
                            b.name === "Case-law" || 
                            b.name === "Case law";
                            
        if (isAInCaseLaw || isBInCaseLaw) {
          // If comparing two files in Case law folder
          if (a.file && b.file) {
            // Check if both files have valid date frontmatter
            const aDate = a.file.frontmatter?.date;
            const bDate = b.file.frontmatter?.date;
            
            const aHasDate = typeof aDate === 'string' && aDate.trim() !== '';
            const bHasDate = typeof bDate === 'string' && bDate.trim() !== '';
            
            if (aHasDate && bHasDate) {
              // Sort by date (newest first)
              return new Date(bDate as string).getTime() - 
                     new Date(aDate as string).getTime();
            } else if (aHasDate) {
              // A has date, B doesn't - A comes first
              return -1;
            } else if (bHasDate) {
              // B has date, A doesn't - B comes first
              return 1;
            }
          }
          
          // Keep the default folder/file sorting for other cases
          if ((!a.file && !b.file) || (a.file && b.file)) {
            return a.displayName.localeCompare(b.displayName, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }
          if (a.file && !b.file) {
            return 1;
          } else {
            return -1;
          }
        } else {
          // Use default sort for all other folders
          if ((!a.file && !b.file) || (a.file && b.file)) {
            return a.displayName.localeCompare(b.displayName, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }
          if (a.file && !b.file) {
            return 1;
          } else {
            return -1;
          }
        }
      },
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    // Component.FontSizeAdjuster(),
    Component.Explorer({
      sortFn: (a, b) => {
        // Check if we're in the Case law folder (handling both "Case law" and "Case-law" paths)
        const isAInCaseLaw = a.file?.slug?.startsWith("Case-law/") || 
                            a.file?.slug?.startsWith("Case law/") || 
                            a.name === "Case-law" || 
                            a.name === "Case law";
        const isBInCaseLaw = b.file?.slug?.startsWith("Case-law/") || 
                            b.file?.slug?.startsWith("Case law/") || 
                            b.name === "Case-law" || 
                            b.name === "Case law";
                            
        if (isAInCaseLaw || isBInCaseLaw) {
          // If comparing two files in Case law folder
          if (a.file && b.file) {
            // Check if both files have valid date frontmatter
            const aDate = a.file.frontmatter?.date;
            const bDate = b.file.frontmatter?.date;
            
            const aHasDate = typeof aDate === 'string' && aDate.trim() !== '';
            const bHasDate = typeof bDate === 'string' && bDate.trim() !== '';
            
            if (aHasDate && bHasDate) {
              // Sort by date (newest first)
              return new Date(bDate as string).getTime() - 
                     new Date(aDate as string).getTime();
            } else if (aHasDate) {
              // A has date, B doesn't - A comes first
              return -1;
            } else if (bHasDate) {
              // B has date, A doesn't - B comes first
              return 1;
            }
          }
          
          // Keep the default folder/file sorting for other cases
          if ((!a.file && !b.file) || (a.file && b.file)) {
            return a.displayName.localeCompare(b.displayName, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }
          if (a.file && !b.file) {
            return 1;
          } else {
            return -1;
          }
        } else {
          // Use default sort for all other folders
          if ((!a.file && !b.file) || (a.file && b.file)) {
            return a.displayName.localeCompare(b.displayName, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }
          if (a.file && !b.file) {
            return 1;
          } else {
            return -1;
          }
        }
      },
    }),
  ],
  right: [],
}
