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
        const isAInCaseLaw = a.file?.slug?.includes("Case law/") || 
                             a.file?.slug?.includes("Case-law/") || 
                             a.name === "Case law" || 
                             a.name === "Case-law";
        const isBInCaseLaw = b.file?.slug?.includes("Case law/") || 
                             b.file?.slug?.includes("Case-law/") || 
                             b.name === "Case law" || 
                             b.name === "Case-law";
                            
        if (isAInCaseLaw && isBInCaseLaw) {
          // If comparing two files in Case law folder
          if (a.file && b.file) {
            // Check if both files have valid date frontmatter
            const aDate = a.file.frontmatter?.date;
            const bDate = b.file.frontmatter?.date;
            
            if (typeof aDate === 'string' && typeof bDate === 'string') {
              try {
                // Convert dates to timestamps and sort newest first
                const aTimestamp = new Date(aDate).getTime();
                const bTimestamp = new Date(bDate).getTime();
                
                // Check if valid dates were parsed
                if (!isNaN(aTimestamp) && !isNaN(bTimestamp)) {
                  return bTimestamp - aTimestamp; // newest first
                }
              } catch (e) {
                // Fall back to alphabetical if date parsing fails
                console.error("Error parsing dates:", e);
              }
            }
          }
        }
        
        // Default sorting (folders first, then alphabetical)
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
        const isAInCaseLaw = a.file?.slug?.includes("Case law/") || 
                             a.file?.slug?.includes("Case-law/") || 
                             a.name === "Case law" || 
                             a.name === "Case-law";
        const isBInCaseLaw = b.file?.slug?.includes("Case law/") || 
                             b.file?.slug?.includes("Case-law/") || 
                             b.name === "Case law" || 
                             b.name === "Case-law";
                            
        if (isAInCaseLaw && isBInCaseLaw) {
          // If comparing two files in Case law folder
          if (a.file && b.file) {
            // Check if both files have valid date frontmatter
            const aDate = a.file.frontmatter?.date;
            const bDate = b.file.frontmatter?.date;
            
            if (typeof aDate === 'string' && typeof bDate === 'string') {
              try {
                // Convert dates to timestamps and sort newest first
                const aTimestamp = new Date(aDate).getTime();
                const bTimestamp = new Date(bDate).getTime();
                
                // Check if valid dates were parsed
                if (!isNaN(aTimestamp) && !isNaN(bTimestamp)) {
                  return bTimestamp - aTimestamp; // newest first
                }
              } catch (e) {
                // Fall back to alphabetical if date parsing fails
                console.error("Error parsing dates:", e);
              }
            }
          }
        }
        
        // Default sorting (folders first, then alphabetical)
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
      },
    }),
  ],
  right: [],
}
