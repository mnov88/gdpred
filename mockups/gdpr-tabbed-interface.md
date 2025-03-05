---
title: "GDPR Case Law Explorer"
---

<div class="gdpr-tabs-container" style="
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 1100px;
  margin: 2rem auto;
  color: #333;
">
  <div class="tabs-header" style="
    text-align: center;
    margin-bottom: 2.5rem;
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
    ">Navigate through GDPR case law by key legal concepts and specific situations.</p>
  </div>

  <!-- Tab Navigation -->
  <div class="tabs-navigation" style="
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 2rem;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 #f8f9fa;
  ">
    <button class="tab-button active" style="
      padding: 1rem 1.5rem;
      background: none;
      border: none;
      border-bottom: 2px solid #3182ce;
      color: #2c5282;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.3s ease;
    " onclick="switchTab(event, 'legal-concepts')">
      <span style="
        display: flex;
        align-items: center;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3182ce"/>
          <path d="M2 17L12 22L22 17V7L12 12L2 7V17Z" fill="#3182ce" fill-opacity="0.5"/>
        </svg>
        GDPR Legal Concepts
      </span>
    </button>
    <button class="tab-button" style="
      padding: 1rem 1.5rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: #4a5568;
      font-weight: 500;
      font-size: 1rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.3s ease;
    " onclick="switchTab(event, 'specific-situations')">
      <span style="
        display: flex;
        align-items: center;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
          <path d="M3 13H11V3H3V13Z" fill="#38a169"/>
          <path d="M3 21H11V15H3V21Z" fill="#38a169"/>
          <path d="M13 21H21V11H13V21Z" fill="#38a169" fill-opacity="0.5"/>
          <path d="M13 9H21V3H13V9Z" fill="#38a169" fill-opacity="0.5"/>
        </svg>
        Specific Situations
      </span>
    </button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    <!-- GDPR Legal Concepts Tab -->
    <div id="legal-concepts" class="tab-pane active" style="display: block;">
      <!-- Filter Section -->
      <div class="filter-section" style="
        margin-bottom: 2rem;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 8px;
      ">
        <div style="
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
        ">
          <label style="
            font-weight: 600;
            color: #2d3748;
            display: flex;
            align-items: center;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
              <path d="M11 18C14.866 18 18 14.866 18 11C18 7.13401 14.866 4 11 4C7.13401 4 4 7.13401 4 11C4 14.866 7.13401 18 11 18Z" stroke="#2d3748" stroke-width="2"/>
              <path d="M20 20L16 16" stroke="#2d3748" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Filter by principle:
          </label>
          <select id="principle-filter" style="
            padding: 0.5rem 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            background-color: white;
            font-size: 0.9rem;
            flex-grow: 1;
            max-width: 400px;
          ">
            <option value="all">All principles</option>
            <option value="lawfulness">Lawfulness of processing</option>
            <option value="minimization">Data minimization</option>
            <option value="purpose">Purpose limitation</option>
            <option value="storage">Storage limitation</option>
            <option value="necessity">Necessity of processing</option>
          </select>
          <button style="
            padding: 0.5rem 1.5rem;
            background-color: #3182ce;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.3s ease;
          " onclick="applyFilter()">Apply</button>
        </div>
      </div>

      <!-- Data Processing Principles Section -->
      <div class="category-section" style="
        margin-bottom: 3rem;
      ">
        <h2 style="
          font-size: 1.5rem;
          color: #2c5282;
          padding-bottom: 0.6rem;
          border-bottom: 2px solid #e1e5e9;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 10px;">
            <path d="M20 6H4V8H20V6Z" fill="#2c5282"/>
            <path d="M20 10H4V12H20V10Z" fill="#2c5282"/>
            <path d="M20 14H4V16H20V14Z" fill="#2c5282"/>
            <path d="M20 18H4V20H20V18Z" fill="#2c5282"/>
          </svg>
          Data Processing Principles
        </h2>
        
        <!-- Cases Grid -->
        <div class="cases-grid" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        ">
          <!-- Case Card 1 -->
          <div class="case-card" data-principles="lawfulness minimization purpose" style="
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
          ">
            <!-- Tags -->
            <div class="case-tags" style="
              position: absolute;
              top: 0;
              right: 0;
              display: flex;
              gap: 0.3rem;
              padding: 0.5rem;
            ">
              <span style="
                background-color: #ebf4ff;
                color: #2c5282;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
              ">Lawfulness</span>
              <span style="
                background-color: #f0fff4;
                color: #38a169;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
              ">Minimization</span>
              <span style="
                background-color: #f8f4ff;
                color: #805ad5;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
              ">Purpose</span>
            </div>
            
            <div class="case-content" style="padding: 1.5rem;">
              <div style="
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: #1a3a5f;
              ">C-205/21</div>
              <h3 style="
                font-size: 1.25rem;
                margin-bottom: 1rem;
                line-height: 1.3;
              ">V.S. v Ministerstvo na vatreshnite raboti</h3>
              <p style="
                font-size: 0.95rem;
                color: #4a5568;
                margin-bottom: 1.5rem;
                line-height: 1.5;
              ">Key case examining principles relating to processing of personal data under GDPR, with focus on purpose limitation and data minimisation.</p>
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              ">
                <span style="
                  font-size: 0.85rem;
                  color: #718096;
                ">January 26, 2023</span>
                <a href="Case%20law/C-205-21" style="
                  display: inline-flex;
                  align-items: center;
                  color: #3182ce;
                  font-weight: 500;
                  text-decoration: none;
                  font-size: 0.9rem;
                ">
                  Read case
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 5px;">
                    <path d="M5 12H19" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          <!-- Case Card 2 -->
          <div class="case-card" data-principles="lawfulness" style="
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
          ">
            <!-- Tags -->
            <div class="case-tags" style="
              position: absolute;
              top: 0;
              right: 0;
              display: flex;
              gap: 0.3rem;
              padding: 0.5rem;
            ">
              <span style="
                background-color: #ebf4ff;
                color: #2c5282;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
              ">Lawfulness</span>
            </div>
            
            <div class="case-content" style="padding: 1.5rem;">
              <div style="
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: #1a3a5f;
              ">C-175/20</div>
              <h3 style="
                font-size: 1.25rem;
                margin-bottom: 1rem;
                line-height: 1.3;
              ">'SS' SIA v Valsts ieņēmumu dienests</h3>
              <p style="
                font-size: 0.95rem;
                color: #4a5568;
                margin-bottom: 1.5rem;
                line-height: 1.5;
              ">Case addressing protection of natural persons with regard to the processing of personal data, lawfulness of processing, and proportionality requirements.</p>
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              ">
                <span style="
                  font-size: 0.85rem;
                  color: #718096;
                ">February 24, 2022</span>
                <a href="Case%20law/C-175-20" style="
                  display: inline-flex;
                  align-items: center;
                  color: #3182ce;
                  font-weight: 500;
                  text-decoration: none;
                  font-size: 0.9rem;
                ">
                  Read case
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 5px;">
                    <path d="M5 12H19" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          <!-- Case Card 3 -->
          <div class="case-card" data-principles="minimization purpose" style="
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
          ">
            <!-- Tags -->
            <div class="case-tags" style="
              position: absolute;
              top: 0;
              right: 0;
              display: flex;
              gap: 0.3rem;
              padding: 0.5rem;
            ">
              <span style="
                background-color: #f0fff4;
                color: #38a169;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
              ">Minimization</span>
              <span style="
                background-color: #f8f4ff;
                color: #805ad5;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
              ">Purpose</span>
            </div>
            
            <div class="case-content" style="padding: 1.5rem;">
              <div style="
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: #1a3a5f;
              ">C-446/21</div>
              <h3 style="
                font-size: 1.25rem;
                margin-bottom: 1rem;
                line-height: 1.3;
              ">Schrems v Meta Platforms Ireland</h3>
              <p style="
                font-size: 0.95rem;
                color: #4a5568;
                margin-bottom: 1.5rem;
                line-height: 1.5;
              ">Landmark case examining online social networks, general terms of use, and personalized advertising under GDPR principles.</p>
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              ">
                <span style="
                  font-size: 0.85rem;
                  color: #718096;
                ">October 4, 2024</span>
                <a href="Case%20law/C-446-21" style="
                  display: inline-flex;
                  align-items: center;
                  color: #3182ce;
                  font-weight: 500;
                  text-decoration: none;
                  font-size: 0.9rem;
                ">
                  Read case
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-left: 5px;">
                    <path d="M5 12H19" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          <!-- Additional case cards would be added here -->
        </div>
      </div>
      
      <!-- Additional principle sections would be added here -->
    </div>
    
    <!-- Specific Situations Tab (Initially Hidden) -->
    <div id="specific-situations" class="tab-pane" style="display: none;">
      <div class="empty-state" style="
        text-align: center;
        padding: 4rem 2rem;
        background-color: #f8f9fa;
        border-radius: 8px;
      ">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto 1.5rem;">
          <path d="M13 13H11V7H13V13Z" fill="#718096"/>
          <path d="M13 17H11V15H13V17Z" fill="#718096"/>
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#718096" stroke-width="2"/>
        </svg>
        <h3 style="
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #4a5568;
        ">Specific Situations Content</h3>
        <p style="
          font-size: 1rem;
          color: #718096;
          max-width: 600px;
          margin: 0 auto;
        ">This tab would contain case law organized by specific situations such as digital services, employment context, public sector, health and medical, etc.</p>
      </div>
    </div>
  </div>
</div>

<style>
.case-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.tab-button:hover {
  color: #3182ce;
}

.tab-button.active {
  color: #2c5282;
  border-bottom-color: #3182ce;
}

@media (max-width: 768px) {
  .cases-grid {
    grid-template-columns: 1fr;
  }
  
  .tabs-navigation {
    justify-content: flex-start;
  }
}
</style>

<script>
function switchTab(event, tabId) {
  // Hide all tab content
  var tabContents = document.querySelectorAll('.tab-pane');
  tabContents.forEach(function(tab) {
    tab.style.display = 'none';
  });
  
  // Remove active class from all tab buttons
  var tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(function(button) {
    button.classList.remove('active');
  });
  
  // Show the selected tab and add active class to the button
  document.getElementById(tabId).style.display = 'block';
  event.currentTarget.classList.add('active');
}

function applyFilter() {
  var selectedPrinciple = document.getElementById('principle-filter').value;
  var caseCards = document.querySelectorAll('.case-card');
  
  caseCards.forEach(function(card) {
    if (selectedPrinciple === 'all') {
      card.style.display = 'block';
    } else {
      var principles = card.getAttribute('data-principles');
      if (principles.includes(selectedPrinciple)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    }
  });
}
</script> 