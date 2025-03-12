---
title: FAQ pure css
---
# FAQ Example

This page demonstrates how to use the custom FAQ component with pure CSS expand/collapse functionality.

## GDPR Frequently Asked Questions

<div class="faq-container">
  <div class="faq-item">
    <input type="checkbox" id="faq1" class="faq-toggle">
    <label for="faq1" class="faq-question">What is GDPR?</label>
    <div class="faq-answer">
      <p>The General Data Protection Regulation (GDPR) is a regulation in EU law on data protection and privacy in the European Union and the European Economic Area. It also addresses the transfer of personal data outside the EU and EEA areas.</p>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq2" class="faq-toggle">
    <label for="faq2" class="faq-question">When did GDPR come into effect?</label>
    <div class="faq-answer">
      <p>The GDPR was adopted on April 14, 2016, and became enforceable beginning May 25, 2018. The regulation replaced the Data Protection Directive 95/46/EC.</p>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq3" class="faq-toggle">
    <label for="faq3" class="faq-question">What are the key principles of GDPR?</label>
    <div class="faq-answer">
      <p>The GDPR is based on several key principles:</p>
      <ul>
        <li>Lawfulness, fairness, and transparency</li>
        <li>Purpose limitation</li>
        <li>Data minimization</li>
        <li>Accuracy</li>
        <li>Storage limitation</li>
        <li>Integrity and confidentiality (security)</li>
        <li>Accountability</li>
      </ul>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq4" class="faq-toggle">
    <label for="faq4" class="faq-question">What rights do individuals have under GDPR?</label>
    <div class="faq-answer">
      <p>The GDPR provides the following rights for individuals:</p>
      <ul>
        <li>The right to be informed</li>
        <li>The right of access</li>
        <li>The right to rectification</li>
        <li>The right to erasure</li>
        <li>The right to restrict processing</li>
        <li>The right to data portability</li>
        <li>The right to object</li>
        <li>Rights in relation to automated decision making and profiling</li>
      </ul>
    </div>
  </div>
  
  <div class="faq-item">
    <input type="checkbox" id="faq5" class="faq-toggle">
    <label for="faq5" class="faq-question">What are the penalties for non-compliance?</label>
    <div class="faq-answer">
      <p>Organizations can be fined up to 4% of annual global turnover or €20 million (whichever is greater) for the most serious infringements. There is a tiered approach to fines, with a maximum fine of 2% for less severe violations.</p>
    </div>
  </div>
</div>

## How to Use the FAQ Component

To create an FAQ section on your page, use the following HTML structure:

```html
<div class="faq-container">
  <div class="faq-item">
    <input type="checkbox" id="faq1" class="faq-toggle">
    <label for="faq1" class="faq-question">Your question here?</label>
    <div class="faq-answer">
      <p>Your answer here.</p>
    </div>
  </div>
  
  <!-- Add more FAQ items as needed -->
</div>
```

Important notes:
1. Each FAQ item needs a unique ID (faq1, faq2, etc.)
2. The `for` attribute of the label must match the `id` of the checkbox
3. You can include any Markdown-formatted content inside the answer section

The FAQ items will be collapsed by default and can be expanded by clicking on the question. This implementation uses pure CSS with the "checkbox hack" and doesn't require any JavaScript to function. 