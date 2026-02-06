import re
import os

def split_articles():
    # Use an absolute path, assuming the script is in <workspace>/scripts/
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    input_file_path = os.path.join(workspace_root, "content/all-articles.md")
    output_dir = os.path.join(workspace_root, "content/Articles")
    
    print(f"Attempting to read from absolute path: {input_file_path}") # DEBUG

    # Check if file exists and its size from Python's perspective
    if not os.path.exists(input_file_path):
        print(f"Error: Python os.path.exists reports '{input_file_path}' does not exist.")
        return
    else:
        try:
            file_size = os.path.getsize(input_file_path)
            print(f"Python os.path.getsize reports '{input_file_path}' size: {file_size} bytes.")
            if file_size == 0:
                print(f"Warning: File '{input_file_path}' is 0 bytes long.")
        except Exception as e:
            print(f"Error getting file size for '{input_file_path}': {e}")

    # Ensure output directory exists
    if not os.path.exists(output_dir):
        print(f"Creating output directory: {output_dir}") # DEBUG
        os.makedirs(output_dir)

    try:
        with open(input_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        print(f"Successfully read '{input_file_path}'. First 200 chars of content:\n--BEGIN CONTENT PREVIEW--\n{content[:200]}\n--END CONTENT PREVIEW--")
        if not content.strip():
            print("Warning: Content read from file is empty or only whitespace after stripping.")

    except FileNotFoundError: # Should be caught by os.path.exists earlier, but good to keep
        print(f"Error: Input file '{input_file_path}' not found at open().")
        return
    except Exception as e:
        print(f"Error reading file '{input_file_path}': {e}")
        return

    # Regex to find articles.
    # It captures:
    # 1. The full "Article X" line (for the title).
    # 2. The content of the article.
    # It stops capturing content when it sees the next "Article Y", "Section Z", 
    # "CHAPTER W" (roman numerals), or the end of the file.
    article_pattern = re.compile(
        r"^(Article\s+\d+)[\r\n]+"  # Capture "Article X" (group 1), then match one or more newlines
        r"([\s\S]*?)"              # Capture content (group 2)
        r"(?="                     # Positive lookahead for terminators
        r"^(?:Article\s+\d+)|"
        r"^(?:Section\s+\d+)|"
        r"^(?:CHAPTER\s+[IVXLCDM]+)|" # Matches "CHAPTER I", "CHAPTER II", etc.
        r"\Z"                    # End of entire string
        r")",
        re.MULTILINE
    )

    articles = article_pattern.finditer(content)
    
    article_count = 0
    for match in articles:
        article_title_line = match.group(1).strip() # e.g., "Article 1"
        article_body = match.group(2).strip()
        
        # Skip if article body is empty
        if not article_body:
            print(f"Skipping {article_title_line} as it has no substantive content after stripping.")
            continue

        file_name = article_title_line + ".md"
        output_file_path = os.path.join(output_dir, file_name)
        
        yaml_frontmatter = f'---\ntitle: "{article_title_line}"\n---\n\n'
        
        try:
            with open(output_file_path, 'w', encoding='utf-8') as out_f:
                out_f.write(yaml_frontmatter)
                out_f.write(article_body)
            print(f"Successfully created: {output_file_path}")
            article_count += 1
        except Exception as e:
            print(f"Error writing file '{output_file_path}': {e}")
            
    if article_count > 0:
        print(f"\nSuccessfully processed and created {article_count} article files in '{output_dir}'.")
    else:
        print("No articles found or processed. Please check the input file and pattern.")

if __name__ == "__main__":
    split_articles() 