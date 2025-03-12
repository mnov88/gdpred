---
title: FAQ callout
---

# FAQ Using Callouts

This page demonstrates how to use customized callouts for FAQ functionality.

## GDPR Frequently Asked Questions

> [!faq]- What is GDPR?
> The General Data Protection Regulation (GDPR) is a regulation in EU law on data protection and privacy in the European Union and the European Economic Area. It also addresses the transfer of personal data outside the EU and EEA areas.

> [!faq]- When did GDPR come into effect?
> The GDPR was adopted on April 14, 2016, and became enforceable beginning May 25, 2018. The regulation replaced the Data Protection Directive 95/46/EC.

> [!faq]- What are the key principles of GDPR?
> The GDPR is based on several key principles:
> 
> - Lawfulness, fairness, and transparency
> - Purpose limitation
> - Data minimization
> - Accuracy
> - Storage limitation
> - Integrity and confidentiality (security)
> - Accountability

> [!faq]- What rights do individuals have under GDPR?
> The GDPR provides the following rights for individuals:
>
> - The right to be informed
> - The right of access
> - The right to rectification
> - The right to erasure
> - The right to restrict processing
> - The right to data portability
> - The right to object
> - Rights in relation to automated decision making and profiling

> [!faq]- What are the penalties for non-compliance?
> Organizations can be fined up to 4% of annual global turnover or €20 million (whichever is greater) for the most serious infringements. There is a tiered approach to fines, with a maximum fine of 2% for less severe violations.

## How to Use FAQ Callouts

To create an FAQ section using callouts, use the following Markdown syntax:

```markdown
> [!faq]- Your question here?
> Your answer here. You can include any Markdown-formatted content.
> 
> - Lists
> - Are supported
> 
> As well as **bold**, *italic*, and other formatting.
```

Notes:
1. The `[!faq]` part defines this as a "faq" type callout
2. The `-` after the type makes it collapsed by default (omit to have it expanded)
3. The question goes on the same line as the callout definition
4. The answer goes in the indented block below 