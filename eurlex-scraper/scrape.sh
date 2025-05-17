#!/bin/bash

# Simple shell script to run the EUR-Lex Case Reference Scraper

# Check if a CELEX number was provided
if [ -z "$1" ]; then
  echo "Please provide a CELEX number as an argument."
  echo "Usage: ./scrape.sh CELEX_NUMBER [--skip-download]"
  exit 1
fi

# Run the scraper with the provided arguments
node eurlex-scraper.js "$@" 