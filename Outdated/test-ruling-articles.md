---
title: "Test Ruling Articles Component"
ruling-articles:
  - Article 15
  - Article 99
  - Article 22(a)
  - Article 47
  - Article 102(3)(c)
---

# Test Ruling Articles Component

This page demonstrates the ruling-articles component, which displays a horizontal list of article references from the frontmatter.

## What are these articles?

These are example article references that might be included in a legal document. The component displays them as interactive chips at the top of the page.

## How it works

The component:
1. Reads the `ruling-articles` array from the frontmatter
2. Displays each article as a visually distinct chip
3. Arranges them in a responsive horizontal list that wraps on smaller screens
4. Shows nothing if no ruling articles are present

This provides a quick visual reference for the key articles relevant to a document. 