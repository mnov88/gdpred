import re
import os
import requests
from pathlib import Path
import time

# Define file paths
script_dir = Path(__file__).parent
html_md_path = script_dir / "html.md"
celex_interpretations_path = script_dir / "celex_interpretations.md"
download_dir = script_dir / "downloaded-interpretations"

# Ensure the download directory exists
os.makedirs(download_dir, exist_ok=True)

# Set to store unique CELEX numbers
unique_celex_numbers = set()

# Read the html.md file and extract CELEX numbers
try:
    with open(html_md_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    print(f"Processing {len(lines)} lines from html.md...")
    
    # Process each line
    for line in lines:
        # Skip lines containing "Preliminary question"
        if "Preliminary question" in line:
            continue
        
        # Extract CELEX numbers from links in valid lines
        matches = re.findall(r'https://eur-lex\.europa\.eu/legal-content/EN/AUTO/\?uri=CELEX:([^)\s]+)', line)
        
        # Add to set to remove duplicates
        for celex in matches:
            unique_celex_numbers.add(celex)
    
    print(f"Found {len(unique_celex_numbers)} unique CELEX numbers from interpretations.")
    
    # Save unique CELEX numbers to celex_interpretations.md
    with open(celex_interpretations_path, 'w', encoding='utf-8') as file:
        for celex in sorted(unique_celex_numbers):
            file.write(f"{celex}\n")
    
    print(f"Saved CELEX numbers to {celex_interpretations_path}")
    
    # Download HTML files for each unique CELEX number
    for i, celex in enumerate(unique_celex_numbers):
        # Construct the URL for downloading the HTML
        download_url = f"https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:{celex}"
        
        # Create filename for the HTML file
        filename = f"{celex}.html"
        file_path = download_dir / filename
        
        # Skip if the file already exists
        if file_path.exists():
            print(f"[{i+1}/{len(unique_celex_numbers)}] {filename} already exists, skipping...")
            continue
        
        print(f"[{i+1}/{len(unique_celex_numbers)}] Downloading {celex}...")
        
        try:
            # Make the request
            response = requests.get(download_url)
            response.raise_for_status()  # Raise an exception for HTTP errors
            
            # Save the HTML content
            with open(file_path, 'wb') as file:
                file.write(response.content)
            
            print(f"  - Saved to {file_path}")
            
            # Be nice to the server - add a small delay between requests
            if i < len(unique_celex_numbers) - 1:  # Don't sleep after the last download
                time.sleep(1)  # 1 second delay
                
        except requests.exceptions.RequestException as e:
            print(f"  - Error downloading {celex}: {e}")
    
    print(f"Download complete! Downloaded files are in {download_dir}")
    
except KeyboardInterrupt:
    print("\nDownload interrupted by user. Partial results have been saved.")
    
except Exception as e:
    print(f"An error occurred: {e}") 