<!DOCTYPE html>

<html lang="en">

  

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Case Law Grouping Examples</title>

<style>

body {

font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;

line-height: 1.6;

color: #333;

max-width: 1200px;

margin: 0 auto;

padding: 20px;

}

  

h1,

h2,

h3,

h4 {

color: #284b63;

}

  

h1 {

text-align: center;

margin-bottom: 2rem;

}

  

.example-container {

margin-bottom: 4rem;

padding-bottom: 2rem;

border-bottom: 1px solid #eaeaea;

}

  

.example-description {

margin-bottom: 2rem;

}

  

/* Example 1: Collapsible Nested Structure */

.collapsible-container {

margin-bottom: 2rem;

}

  

.article-toggle {

display: none;

}

  

.article-item {

margin-bottom: 1rem;

border: 1px solid #ddd;

border-radius: 8px;

overflow: hidden;

}

  

.article-header {

background-color: #f5f5f5;

padding: 1rem;

cursor: pointer;

font-weight: 600;

display: flex;

justify-content: space-between;

align-items: center;

}

  

.article-header:hover {

background-color: #e9e9e9;

}

  

.article-header::after {

content: '+';

font-size: 1.2rem;

transition: transform 0.3s ease;

}

  

.article-toggle:checked+.article-header::after {

content: '−';

}

  

.article-content {

max-height: 0;

overflow: hidden;

transition: max-height 0.3s ease;

}

  

.article-toggle:checked~.article-content {

max-height: 2000px;

}

  

.case-list {

padding: 1rem;

}

  

.case-item {

margin-bottom: 0.75rem;

padding: 0.75rem;

background-color: #f9f9f9;

border-radius: 4px;

border-left: 4px solid #284b63;

}

  

.case-meta {

font-size: 0.85rem;

color: #666;

margin-top: 0.5rem;

}

  

/* Example 2: Card Grid Layout */

.grid-container {

display: grid;

grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));

gap: 1.5rem;

}

  

.article-card {

border: 1px solid #ddd;

border-radius: 8px;

overflow: hidden;

box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

transition: transform 0.2s ease, box-shadow 0.2s ease;

}

  

.article-card:hover {

transform: translateY(-3px);

box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

}

  

.article-card-header {

background-color: #284b63;

color: white;

padding: 1rem;

}

  

.article-card-title {

margin: 0;

font-size: 1.3rem;

}

  

.article-card-content {

padding: 1rem;

}

  

.article-card-description {

border-bottom: 1px solid #eee;

padding-bottom: 0.75rem;

margin-bottom: 0.75rem;

}

  

.related-cases-title {

font-weight: 500;

margin-bottom: 0.5rem;

}

  

.case-tag {

display: inline-block;

background-color: #e5f0f8;

color: #284b63;

padding: 0.25rem 0.5rem;

margin: 0.25rem;

border-radius: 4px;

font-size: 0.9rem;

transition: background-color 0.2s ease;

}

  

.case-tag:hover {

background-color: #d0e5f5;

}

  

/* Example 3: Timeline with Connected Articles */

.timeline-layout {

position: relative;

margin: 2rem 0;

}

  

.timeline-line {

position: absolute;

top: 0;

bottom: 0;

left: 50%;

width: 4px;

background-color: #eaeaea;

transform: translateX(-50%);

}

  

.timeline-item {

position: relative;

margin-bottom: 2rem;

display: flex;

}

  

.timeline-item:nth-child(odd) {

justify-content: flex-end;

}

  

.timeline-case {

width: 45%;

padding: 1.5rem;

background-color: white;

border: 1px solid #ddd;

border-radius: 8px;

box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

z-index: 1;

}

  

.timeline-case h3 {

margin-top: 0;

}

  

.timeline-case::before {

content: '';

position: absolute;

top: 30px;

width: 16px;

height: 16px;

background-color: #284b63;

border-radius: 50%;

z-index: 2;

}

  

.timeline-item:nth-child(odd) .timeline-case::before {

left: calc(-9% + 2px);

}

  

.timeline-item:nth-child(even) .timeline-case::before {

right: calc(-9% + 2px);

}

  

.related-articles {

margin-top: 1rem;

padding-top: 0.5rem;

border-top: 1px dashed #ddd;

}

  

.article-link {

display: block;

margin: 0.5rem 0;

padding: 0.5rem;

background-color: #f5f7fa;

border-left: 3px solid #284b63;

border-radius: 0 4px 4px 0;

transition: background-color 0.2s ease;

}

  

.article-link:hover {

background-color: #edf2f7;

}

  

@media (max-width: 768px) {

.timeline-line {

left: 24px;

}

  

.timeline-item,

.timeline-item:nth-child(odd) {

justify-content: flex-start;

padding-left: 48px;

}

  

.timeline-case {

width: 100%;

}

  

.timeline-item .timeline-case::before,

.timeline-item:nth-child(odd) .timeline-case::before,

.timeline-item:nth-child(even) .timeline-case::before {

left: -24px;

}

}

</style>

</head>

  

<body>

<h1>Case Law Grouping Examples</h1>

  

<!-- Example 1: Collapsible Nested Structure -->

<div class="example-container">

<h2>Example 1: Collapsible Nested Structure</h2>

<div class="example-description">

<p>This layout uses collapsible sections similar to your FAQ, with articles as main items and related cases

nested inside. Click on an article to expand and see its related cases.</p>

</div>

  

<div class="collapsible-container">

<div class="article-item">

<input type="checkbox" id="article-1" class="article-toggle">

<label for="article-1" class="article-header">Article: The Evolution of Privacy Law in Digital

Spaces</label>

<div class="article-content">

<div class="case-list">

<p>This article examines how privacy law has evolved in response to technological advancements

and digital communication.</p>

<h4>Related Cases:</h4>

<div class="case-item">

<strong>Carpenter v. United States (2018)</strong>

<p>Established that the government needs a warrant to access cell phone location data.</p>

<div class="case-meta">Supreme Court | June 22, 2018</div>

</div>

<div class="case-item">

<strong>Riley v. California (2014)</strong>

<p>Required police to get a warrant before searching the contents of a cell phone seized

during an arrest.</p>

<div class="case-meta">Supreme Court | June 25, 2014</div>

</div>

<div class="case-item">

<strong>United States v. Jones (2012)</strong>

<p>Found that attaching a GPS tracking device to a vehicle constitutes a search under the

### Fourth Amendment.</p>

<div class="case-meta">Supreme Court | January 23, 2012</div>

</div>

</div>

</div>

</div>

  

<div class="article-item">

<input type="checkbox" id="article-2" class="article-toggle">

<label for="article-2" class="article-header">Article: First Amendment Protections in the Internet

Age</label>

<div class="article-content">

<div class="case-list">

<p>This article explores how courts have applied First Amendment principles to online speech and

digital platforms.</p>

<h4>Related Cases:</h4>

<div class="case-item">

<strong>Packingham v. North Carolina (2017)</strong>

<p>Held that a state law prohibiting registered sex offenders from accessing social media

websites violated the First Amendment.</p>

<div class="case-meta">Supreme Court | June 19, 2017</div>

</div>

<div class="case-item">

<strong>Elonis v. United States (2015)</strong>

<p>Addressed the standard for determining when threatening statements on social media

constitute true threats.</p>

<div class="case-meta">Supreme Court | June 1, 2015</div>

</div>

</div>

</div>

</div>

  

<div class="article-item">

<input type="checkbox" id="article-3" class="article-toggle">

<label for="article-3" class="article-header">Article: Copyright Law and Digital Content

Creation</label>

<div class="article-content">

<div class="case-list">

<p>This article analyzes how copyright law has been applied to digital content creation and

distribution.</p>

<h4>Related Cases:</h4>

<div class="case-item">

<strong>Google LLC v. Oracle America, Inc. (2021)</strong>

<p>Ruled that Google's copying of Oracle's Java SE API was fair use, with significant

implications for software development.</p>

<div class="case-meta">Supreme Court | April 5, 2021</div>

</div>

<div class="case-item">

<strong>Capitol Records, LLC v. ReDigi Inc. (2018)</strong>

<p>Found that the resale of digital music files violated copyright law's reproduction right.

</p>

<div class="case-meta">2nd Circuit | December 12, 2018</div>

</div>

</div>

</div>

</div>

</div>

</div>

  

<!-- Example 2: Card Grid Layout -->

<div class="example-container">

<h2>Example 2: Card Grid Layout</h2>

<div class="example-description">

<p>This layout uses a responsive card grid to display articles with their related cases shown as tags. It

provides a more visual, at-a-glance view of the relationships.</p>

</div>

  

<div class="grid-container">

<div class="article-card">

<div class="article-card-header">

<h3 class="article-card-title">Data Privacy Regulations</h3>

</div>

<div class="article-card-content">

<div class="article-card-description">

<p>An examination of recent court decisions shaping data privacy regulations in the technology

sector.</p>

</div>

<div class="related-cases">

<h4 class="related-cases-title">Related Cases:</h4>

<a href="#" class="case-tag">FTC v. Facebook (2023)</a>

<a href="#" class="case-tag">In re Google Privacy Policy (2021)</a>

<a href="#" class="case-tag">hiQ Labs v. LinkedIn (2022)</a>

<a href="#" class="case-tag">TransUnion v. Ramirez (2021)</a>

</div>

</div>

</div>

  

<div class="article-card">

<div class="article-card-header">

<h3 class="article-card-title">AI and Intellectual Property</h3>

</div>

<div class="article-card-content">

<div class="article-card-description">

<p>Analysis of emerging case law surrounding artificial intelligence and intellectual property

rights.</p>

</div>

<div class="related-cases">

<h4 class="related-cases-title">Related Cases:</h4>

<a href="#" class="case-tag">Thaler v. Perlmutter (2023)</a>

<a href="#" class="case-tag">Authors Guild v. OpenAI (2023)</a>

<a href="#" class="case-tag">Getty Images v. Stability AI (2023)</a>

</div>

</div>

</div>

  

<div class="article-card">

<div class="article-card-header">

<h3 class="article-card-title">Platform Liability</h3>

</div>

<div class="article-card-content">

<div class="article-card-description">

<p>Explores the evolving legal landscape of platform liability for user-generated content.</p>

</div>

<div class="related-cases">

<h4 class="related-cases-title">Related Cases:</h4>

<a href="#" class="case-tag">Gonzalez v. Google (2023)</a>

<a href="#" class="case-tag">Force v. Facebook (2019)</a>

<a href="#" class="case-tag">Enigma Software v. Malwarebytes (2019)</a>

</div>

</div>

</div>

  

<div class="article-card">

<div class="article-card-header">

<h3 class="article-card-title">Digital Accessibility Law</h3>

</div>

<div class="article-card-content">

<div class="article-card-description">

<p>Reviews key court decisions defining website accessibility requirements under the ADA.</p>

</div>

<div class="related-cases">

<h4 class="related-cases-title">Related Cases:</h4>

<a href="#" class="case-tag">Robles v. Domino's Pizza (2019)</a>

<a href="#" class="case-tag">Gil v. Winn-Dixie (2021)</a>

<a href="#" class="case-tag">Haynes v. Dunkin' Donuts (2018)</a>

</div>

</div>

</div>

</div>

</div>

  

<!-- Example 3: Timeline with Connected Articles -->

<div class="example-container">

<h2>Example 3: Timeline with Connected Articles</h2>

<div class="example-description">

<p>This layout presents cases in a chronological timeline format, with related articles linked to each case.

It emphasizes the historical development of case law while showing which articles reference each case.

</p>

</div>

  

<div class="timeline-layout">

<div class="timeline-line"></div>

  

<div class="timeline-item">

<div class="timeline-case">

<h3>Smith v. Maryland (1979)</h3>

<div class="case-date">June 20, 1979</div>

<p>Established the "third-party doctrine," holding that individuals have no legitimate expectation

of privacy in information voluntarily turned over to third parties.</p>

<div class="related-articles">

<h4>Referenced in Articles:</h4>

<a href="#" class="article-link">The Evolution of Privacy Law in Digital Spaces</a>

<a href="#" class="article-link">Third-Party Doctrine in the Digital Age</a>

</div>

</div>

</div>

  

<div class="timeline-item">

<div class="timeline-case">

<h3>Sony Corp. v. Universal City Studios (1984)</h3>

<div class="case-date">January 17, 1984</div>

<p>Established the "substantial non-infringing use" doctrine for technologies that could be used for

copyright infringement.</p>

<div class="related-articles">

<h4>Referenced in Articles:</h4>

<a href="#" class="article-link">Copyright Law and Digital Content Creation</a>

<a href="#" class="article-link">Fair Use in Technology Development</a>

</div>

</div>

</div>

  

<div class="timeline-item">

<div class="timeline-case">

<h3>Reno v. ACLU (1997)</h3>

<div class="case-date">June 26, 1997</div>

<p>Established that speech on the internet is entitled to the highest level of First Amendment

protection.</p>

<div class="related-articles">

<h4>Referenced in Articles:</h4>

<a href="#" class="article-link">First Amendment Protections in the Internet Age</a>

<a href="#" class="article-link">Content Moderation and Free Speech</a>

</div>

</div>

</div>

  

<div class="timeline-item">

<div class="timeline-case">

<h3>Carpenter v. United States (2018)</h3>

<div class="case-date">June 22, 2018</div>

<p>Limited the third-party doctrine, holding that the government needs a warrant to access cell

phone location records.</p>

<div class="related-articles">

<h4>Referenced in Articles:</h4>

<a href="#" class="article-link">The Evolution of Privacy Law in Digital Spaces</a>

<a href="#" class="article-link">Modern Surveillance and the Fourth Amendment</a>

<a href="#" class="article-link">Location Data Privacy</a>

</div>

</div>

</div>

</div>

</div>

  

<script>

// Initialize all article toggles as collapsed

document.addEventListener('DOMContentLoaded', function () {

const articleToggles = document.querySelectorAll('.article-toggle');

articleToggles.forEach(toggle => {

toggle.checked = false;

});

});

</script>

</body>

  

</html>