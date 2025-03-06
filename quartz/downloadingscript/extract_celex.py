import re
import os
import requests
from pathlib import Path
import time
from urllib.parse import unquote

# Define file paths
script_dir = Path(__file__).parent
html_md_path = script_dir / "html.md"
celex_md_path = script_dir / "celex.md"
download_dir = script_dir / "downloaded-cases"

# Ensure the download directory exists
os.makedirs(download_dir, exist_ok=True)

# Regular expression to match CELEX numbers in URLs
celex_pattern = r'https://eur-lex\.europa\.eu/legal-content/EN/AUTO/\?uri=CELEX:([^)\s]+)'

# Set to store unique CELEX numbers
unique_celex_numbers = set()

# Read the html.md file and extract CELEX numbers
try:
    with open(html_md_path, 'r', encoding='utf-8') as file:
        content = file.read()
        
    # Find all matches
    matches = re.findall(celex_pattern, content)
    
    # Add to set to remove duplicates
    for celex in matches:
        unique_celex_numbers.add(celex)
    
    print(f"Found {len(matches)} CELEX references, {len(unique_celex_numbers)} unique.")
    
    # Save unique CELEX numbers to celex.md
    with open(celex_md_path, 'w', encoding='utf-8') as file:
        for celex in sorted(unique_celex_numbers):
            file.write(f"{celex}\n")
    
    print(f"Saved {len(unique_celex_numbers)} unique CELEX numbers to {celex_md_path}")
    
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
    
except Exception as e:
    print(f"An error occurred: {e}") 