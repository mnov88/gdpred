// Fix case law reference display text
function fixCaseLawLinks() {
    console.log('Running fixCaseLawLinks');

    // Debug DOM structure
    const main = document.querySelector('main');
    console.log('Main content area:', main);

    // Try different selectors
    const allLinks = document.querySelectorAll('a');
    console.log('All links found:', allLinks.length);

    allLinks.forEach(function (link) {
        const text = link.textContent;
        const href = link.getAttribute('href');
        console.log('Link:', { text, href });

        if (text && text.match(/C-\d+-\d+/)) {
            console.log('Matched case law pattern:', text);
            // Replace hyphens with forward slashes in the display text
            const displayText = text.replace(/-(\d+)$/, '/$1');
            console.log('Updating to:', displayText);
            link.textContent = displayText;
        }
    });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixCaseLawLinks);
} else {
    fixCaseLawLinks();
}

// Run on navigation
document.addEventListener('nav', fixCaseLawLinks);

// Also try with a slight delay to ensure content is loaded
document.addEventListener('nav', function () {
    setTimeout(fixCaseLawLinks, 300);
}); 