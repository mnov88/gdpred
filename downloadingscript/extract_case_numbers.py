import re
import os
import shutil
from pathlib import Path
import html

# Define file paths
script_dir = Path(__file__).parent
source_dir = script_dir / "downloaded-interpretations"
target_dir = script_dir / "cases-by-number"

# Ensure the target directory exists
os.makedirs(target_dir, exist_ok=True)

# Regular expression to match case numbers in the format "In Case C‑XXX/YY" or "In Case C-XXX/YY"
case_pattern = r'In Case (C[-‑][0-9]+/[0-9]+)'

# Process each HTML file
processed_files = 0
failed_files = 0
skipped_files = 0

for html_file in source_dir.glob("*.html"):
    try:
        print(f"Processing {html_file.name}...")
        
        # Read the first 100 lines of the file (to ensure we catch the case number)
        head_content = ""
        with open(html_file, 'r', encoding='utf-8') as file:
            for i, line in enumerate(file):
                if i >= 100:
                    break
                head_content += line
        
        # Search for the case number
        match = re.search(case_pattern, head_content)
        
        if match:
            # Extract and normalize the case number (replace unicode hyphen with regular hyphen)
            case_number = match.group(1).replace('‑', '-')
            
            # Create a filename-safe version of the case number
            safe_case_number = case_number.replace('/', '-')
            
            # Create the new filename
            new_filename = f"{safe_case_number}.html"
            new_file_path = target_dir / new_filename
            
            # Copy the file with the new name
            shutil.copy2(html_file, new_file_path)
            
            print(f"  - Renamed to {new_filename} (Original case: {case_number})")
            processed_files += 1
        else:
            print(f"  - No case number found in {html_file.name}")
            failed_files += 1
            
    except Exception as e:
        print(f"  - Error processing {html_file.name}: {e}")
        failed_files += 1

print(f"\nSummary:")
print(f"  - Successfully processed: {processed_files} files")
print(f"  - Failed to process: {failed_files} files")
print(f"  - Skipped: {skipped_files} files")
print(f"Renamed files are in {target_dir}") 