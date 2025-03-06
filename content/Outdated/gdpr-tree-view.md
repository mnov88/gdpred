---
title: "GDPR Case Law Tree"
---
<div class="tree-container" style="
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 1100px;
  margin: 2rem auto;
  color: #333;
">
  <div class="tree-header" style="
    text-align: center;
    margin-bottom: 3rem;
  ">
    <h1 style="
font-size: 2.2rem;
font-weight: 700;
color: #1a3a5f;
margin-bottom: 0.5rem;
    ">GDPR Case Law Explorer</h1>
    <div style="
height: 4px;
width: 80px;
background-color: #1a3a5f;
margin: 0 auto 1.5rem;
    "></div>
    <p style="
font-size: 1.1rem;
max-width: 700px;
margin: 0 auto;
color: #555;
    ">Browse the hierarchical structure of GDPR case law by concepts, principles, and topics.</p>
  </div>
  <div class="tree-search" style="
    margin-bottom: 2rem;
    position: relative;
  ">
    <input type="text" id="tree-search-input" placeholder="Search case law..." style="
width: 100%;
padding: 0.8rem 1rem 0.8rem 3rem;
border: 1px solid #e2e8f0;
border-radius: 8px;
font-size: 1rem;
box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
position: absolute;
left: 1rem;
top: 50%;
transform: translateY(-50%);
color: #a0aec0;
    ">
<path d="M11 18C14.866 18 18 14.866 18 11C18 7.13401 14.866 4 11 4C7.13401 4 4 7.13401 4 11C4 14.866 7.13401 18 11 18Z" stroke="#a0aec0" stroke-width="2" />
<path d="M20 20L16 16" stroke="#a0aec0" stroke-width="2" stroke-linecap="round" />
    </svg>
  </div>
  <div class="tree-wrapper" style="
    display: flex;
    gap: 2rem;
  ">
    <!-- Tree Navigation -->
    <div class="tree-nav" style="
width: 300px;
flex-shrink: 0;
background-color: #f8f9fa;
border-radius: 8px;
padding: 1.5rem;
box-shadow: 0 2px 5px rgba(0,0,0,0.05);
max-height: 750px;
overflow-y: auto;
    ">
<div class="tree-title" style="
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1.5rem;
">Topic Hierarchy</div>
<!-- Tree Structure -->
<ul class="tree" style="
  list-style-type: none;
  padding: 0;
  margin: 0;
">
  <!-- Category 1 -->
  <li class="tree-item" style="margin-bottom: 0.6rem;">
    <div class="tree-item-header" style="
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 0.5rem 0;
      user-select: none;
    " onclick="toggleTreeItem(this.parentNode)">
      <svg class="tree-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
        margin-right: 8px;
        transform: rotate(0deg);
        transition: transform 0.2s ease;
      ">
        <path d="M12 15.5L4.5 8L5.91 6.59L12 12.67L18.09 6.59L19.5 8L12 15.5Z" fill="#3182ce"/>
      </svg>
      <span class="tree-label" style="
        font-weight: 600;
        color: #2d3748;
      ">GDPR Legal Concepts</span>
    </div>
    <ul class="tree-subtree" style="
      list-style-type: none;
      padding-left: 1.5rem;
      margin: 0.2rem 0 0.8rem;
      display: none;
    ">
      <!-- Subcategory 1 -->
      <li class="tree-item" style="margin-bottom: 0.4rem;">
        <div class="tree-item-header" style="
display: flex;
align-items: center;
cursor: pointer;
padding: 0.4rem 0;
user-select: none;
        " onclick="toggleTreeItem(this.parentNode)">
<svg class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
  margin-right: 8px;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
">
  <path d="M12 15.5L4.5 8L5.91 6.59L12 12.67L18.09 6.59L19.5 8L12 15.5Z" fill="#4299e1"/>
</svg>
<span class="tree-label" style="
  font-weight: 500;
  color: #4a5568;
">Data Processing Principles</span>
        </div>
        <ul class="tree-subtree" style="
list-style-type: none;
padding-left: 1.5rem;
margin: 0.2rem 0 0.8rem;
display: none;
        ">
<!-- Principle 1 -->
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('lawfulness')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Lawfulness of Processing</span>
    <span class="count" style="
      background-color: #ebf4ff;
      color: #3182ce;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">9</span>
  </div>
</li>
<!-- Principle 2 -->
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('minimization')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Data Minimization</span>
    <span class="count" style="
      background-color: #f0fff4;
      color: #38a169;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">3</span>
  </div>
</li>
<!-- Principle 3 -->
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('purpose')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Purpose Limitation</span>
    <span class="count" style="
      background-color: #f8f4ff;
      color: #805ad5;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">3</span>
  </div>
</li>
<!-- Principle 4 -->
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('storage')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Storage Limitation</span>
    <span class="count" style="
      background-color: #feebef;
      color: #e53e3e;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">1</span>
  </div>
</li>
        </ul>
      </li>
      <!-- Subcategory 2 -->
      <li class="tree-item" style="margin-bottom: 0.4rem;">
        <div class="tree-item-header" style="
display: flex;
align-items: center;
cursor: pointer;
padding: 0.4rem 0;
user-select: none;
        " onclick="toggleTreeItem(this.parentNode)">
<svg class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
  margin-right: 8px;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
">
  <path d="M12 15.5L4.5 8L5.91 6.59L12 12.67L18.09 6.59L19.5 8L12 15.5Z" fill="#4299e1"/>
</svg>
<span class="tree-label" style="
  font-weight: 500;
  color: #4a5568;
">Controllers and Processors</span>
        </div>
        <ul class="tree-subtree" style="
list-style-type: none;
padding-left: 1.5rem;
margin: 0.2rem 0 0.8rem;
display: none;
        ">
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('controller')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Concept of Controller</span>
    <span class="count" style="
      background-color: #ebf4ff;
      color: #3182ce;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">4</span>
  </div>
</li>
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('joint_control')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Joint Control and Responsibility</span>
    <span class="count" style="
      background-color: #ebf4ff;
      color: #3182ce;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">3</span>
  </div>
</li>
        </ul>
      </li>
      <!-- More subcategories... -->
    </ul>
  </li>
  <!-- Category 2 -->
  <li class="tree-item" style="margin-bottom: 0.6rem;">
    <div class="tree-item-header" style="
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 0.5rem 0;
      user-select: none;
    " onclick="toggleTreeItem(this.parentNode)">
      <svg class="tree-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
        margin-right: 8px;
        transform: rotate(0deg);
        transition: transform 0.2s ease;
      ">
        <path d="M12 15.5L4.5 8L5.91 6.59L12 12.67L18.09 6.59L19.5 8L12 15.5Z" fill="#38a169"/>
      </svg>
      <span class="tree-label" style="
        font-weight: 600;
        color: #2d3748;
      ">Specific Situations</span>
    </div>
    <ul class="tree-subtree" style="
      list-style-type: none;
      padding-left: 1.5rem;
      margin: 0.2rem 0 0.8rem;
      display: none;
    ">
      <!-- Digital Services -->
      <li class="tree-item" style="margin-bottom: 0.4rem;">
        <div class="tree-item-header" style="
display: flex;
align-items: center;
cursor: pointer;
padding: 0.4rem 0;
user-select: none;
        " onclick="toggleTreeItem(this.parentNode)">
<svg class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
  margin-right: 8px;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
">
  <path d="M12 15.5L4.5 8L5.91 6.59L12 12.67L18.09 6.59L19.5 8L12 15.5Z" fill="#48bb78"/>
</svg>
<span class="tree-label" style="
  font-weight: 500;
  color: #4a5568;
">Digital Services</span>
        </div>
        <ul class="tree-subtree" style="
list-style-type: none;
padding-left: 1.5rem;
margin: 0.2rem 0 0.8rem;
display: none;
        ">
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('cookies')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Cookies and Tracking</span>
    <span class="count" style="
      background-color: #f0fff4;
      color: #38a169;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">2</span>
  </div>
</li>
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('social_networks')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Online Social Networks</span>
    <span class="count" style="
      background-color: #f0fff4;
      color: #38a169;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">1</span>
  </div>
</li>
        </ul>
      </li>
      <!-- Employment Context -->
      <li class="tree-item" style="margin-bottom: 0.4rem;">
        <div class="tree-item-header" style="
display: flex;
align-items: center;
cursor: pointer;
padding: 0.4rem 0;
user-select: none;
        " onclick="toggleTreeItem(this.parentNode)">
<svg class="tree-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="
  margin-right: 8px;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
">
  <path d="M12 15.5L4.5 8L5.91 6.59L12 12.67L18.09 6.59L19.5 8L12 15.5Z" fill="#48bb78"/>
</svg>
<span class="tree-label" style="
  font-weight: 500;
  color: #4a5568;
">Employment Context</span>
        </div>
        <ul class="tree-subtree" style="
list-style-type: none;
padding-left: 1.5rem;
margin: 0.2rem 0 0.8rem;
display: none;
        ">
<li class="tree-item" style="margin-bottom: 0.3rem;">
  <div class="tree-item-header" style="
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.35rem 0;
    user-select: none;
  " onclick="loadCases('employee_data')">
    <span class="tree-label" style="
      font-weight: 400;
      color: #4a5568;
    ">Employee Data Processing</span>
    <span class="count" style="
      background-color: #f0fff4;
      color: #38a169;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
      margin-left: 8px;
    ">2</span>
  </div>
</li>
        </ul>
      </li>
    </ul>
  </li>
</ul>
    </div>
    <div class="tree-content" style="
flex-grow: 1;
background-color: white;
border-radius: 8px;
padding: 1.5rem;
box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    ">
<div class="welcome-state" id="welcome-view" style="
  text-align: center;
  padding: 3rem 1rem;
">
  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMiAyTDIgN0wxMiAxMkwyMiA3TDEyIDJaIiBmaWxsPSIjMzE4MmNlIi8+PHBhdGggZD0iTTIgMTdMMTIgMjJMMjIgMTdWN0wxMiAxMkwyIDdWMTdaIiBmaWxsPSIjMzE4MmNlIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==" style="
    width: 80px;
    height: 80px;
    margin-bottom: 1.5rem;
  " alt="GDPR Icon">
  <h2 style="
    font-size: 1.8rem;
    color: #2d3748;
    margin-bottom: 1rem;
  ">GDPR Case Law Explorer</h2>
  <p style="
    font-size: 1.1rem;
    color: #718096;
    max-width: 600px;
    margin: 0 auto 2rem;
    line-height: 1.6;
  ">Select a topic from the tree view to browse relevant case law. The interactive tree allows you to navigate through categories, principles, and specific situations.</p>
  <div style="
    display: inline-flex;
    background-color: #ebf8ff;
    border-radius: 8px;
    padding: 1rem 1.5rem;
    color: #2b6cb0;
    align-items: center;
  ">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 12px;">
      <path d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#2b6cb0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Start by clicking on a category or subcategory to expand the tree
  </div>
<div id="case-list-view" style="display: none;">
  <!-- Will be populated by JavaScript -->
  <div class="case-list-header" style="
    margin-bottom: 1.5rem;
  ">
    <h2 id="case-list-title" style="
      font-size: 1.5rem;
      color: #2d3748;
      margin-bottom: 0.5rem;
    ">Lawfulness of Processing</h2>
    <p id="case-list-description" style="
      font-size: 1rem;
      color: #718096;
    ">Cases related to the principle of lawfulness of processing under GDPR.</p>
  </div>
  <div id="case-list-container">
    <!-- Sample Case Item -->
    <div class="case-item" style="
      border-bottom: 1px solid #e2e8f0;
      padding: 1.2rem 0;
    ">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.6rem;
      ">
        <h3 style="
font-size: 1.25rem;
margin: 0;
        ">
<a href="Case%20law/C-175-20" style="
  color: #2c5282;
  text-decoration: none;
  font-weight: 600;
">'SS' SIA v Valsts ieņēmumu dienests (C-175/20)</a>
        </h3>
        <span style="
font-size: 0.85rem;
color: #718096;
        ">February 24, 2022</span>
      </div>
      <p style="
        font-size: 0.95rem;
        color: #4a5568;
        margin-bottom: 0.8rem;
        line-height: 1.5;
      ">Case addressing protection of natural persons with regard to the processing of personal data, lawfulness of processing, and proportionality requirements.</p>
      <div style="
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      ">
        <span style="
background-color: #ebf4ff;
color: #2c5282;
padding: 0.3rem 0.6rem;
border-radius: 4px;
font-size: 0.8rem;
font-weight: 500;
        ">Lawfulness</span>
        <span style="
background-color: #e6fffa;
color: #319795;
padding: 0.3rem 0.6rem;
border-radius: 4px;
font-size: 0.8rem;
font-weight: 500;
        ">Proportionality</span>
      </div>
  </div>
</div>
    </div>
  </div>
</div>
<style>
/* Tree item expansion styles */
.tree-item.expanded > .tree-item-header > .tree-icon {
  transform: rotate(90deg);
}
.tree-item.expanded > .tree-subtree {
  display: block;
}
/* Responsive styles */
@media (max-width: 768px) {
  .tree-wrapper {
    flex-direction: column;
  }
  .tree-nav {
    width: 100%;
    max-height: 400px;
    margin-bottom: 1.5rem;
  }
}
</style>
<script>
function toggleTreeItem(item) {
  item.classList.toggle('expanded');
}
function loadCases(principle) {
  // Hide welcome view
  document.getElementById('welcome-view').style.display = 'none';
  // Show case list view
  document.getElementById('case-list-view').style.display = 'block';
  // Set the title based on the selected principle
  let title = '';
  let description = '';
  switch(principle) {
    case 'lawfulness':
title = 'Lawfulness of Processing';
description = 'Cases related to the principle of lawfulness of processing under GDPR.';
break;
    case 'minimization':
title = 'Data Minimization';
description = 'Cases addressing the principle of data minimization under GDPR.';
break;
    case 'purpose':
title = 'Purpose Limitation';
description = 'Cases examining the principle of purpose limitation under GDPR.';
break;
    case 'storage':
title = 'Storage Limitation';
description = 'Cases related to the principle of storage limitation under GDPR.';
break;
    // Add more cases as needed
    default:
title = 'GDPR Cases';
description = 'A collection of cases related to GDPR implementation.';
  }
  document.getElementById('case-list-title').textContent = title;
  document.getElementById('case-list-description').textContent = description;
  // In a real application, this would fetch and populate cases
  // For this mockup, we're just showing the UI
}
// Initialize tree view
document.addEventListener('DOMContentLoaded', function() {
  // Tree search functionality would be implemented here
});
</script> 