# Case Law Frontmatter Generation Guidelines

This document provides specific instructions for generating YAML frontmatter for case law documents.

## General Format

The frontmatter must be enclosed between triple dashes `---` at the beginning and end of the section. All frontmatter should appear at the very beginning of the document.

```yaml
---
title: C-205/21
date: 2023-01-26
case-number: C-205/21
parties: Plaintiff v Defendant
topics:
  - Topic 1
  - Topic 2
final-ruling: |-
  Text of the ruling
ruling-articles:
  - Article X
  - Article Y
per-article:
  - Article X | Text related to Article X
  - Article Y | Text related to Article Y
---
```

## Field-by-Field Instructions

### `title`

- **Source**: Extract from the case identification in the document, usually found in the format "In Case C-XXX-YY"
- **Format**: Use format "C-XXX/YY" with a mathematical slash (/) between numbers
- **Example**: `title: C-205/21`

### `date`

- **Source**: Extract from the judgment date, usually found near the top of the document
- **Format**: ISO date format (YYYY-MM-DD)
- **Example**: `date: 2023-01-26` (from "26 January 2023")

### `case-number`

- **Source**: Same as title field
- **Format**: Must use mathematical slash (/) between numbers: "C-XXX/YY"
- **Example**: `case-number: C-205/21`

### `parties`

- **Source**: Extract from the parties section, usually found after "proceedings against" or similar phrases
- **Format**: "[Plaintiff/Applicant] v [Defendant/Respondent]"
- **Example**: `parties: V.S. v Ministerstvo na vatreshnite raboti, Glavna direktsia za borba s organiziranata prestapnost`

### `topics`

- **Source**: Extract key legal topics from the entire document
- **Format**: Bulleted list of important legal concepts discussed in the case
- **Process**:
  1. Identify recurring legal concepts in the document
  2. Focus on terms mentioned in the headings and rulings
  3. Include relevant data protection or fundamental rights concepts
- **Example**:
  ```yaml
  topics:
    - Principles relating to processing of personal data
    - Purpose limitation
    - Data minimisation
  ```

### `final-ruling`

- **Source**: Extract verbatim from the section following "On those grounds, the Court hereby rules:" or similar
- **Format**:
  - Use multiline string format `|-`
  - Preserve original numbering
  - Keep bold formatting for numbers (`**1.**`)
  - Include the complete text of all numbered points exactly as it appears in the judgment
- **Example**:
  ```yaml
  final-ruling: |-
    **1.** Article 10(a) of Directive (EU) 2016/680...
    
    **2.** Article 6(a) of Directive 2016/680...
  ```

### `ruling-articles`

- **Source**: Extract from the articles explicitly mentioned in the ruling section
- **Format**: Bulleted list with format "Article X"
- **Process**: 
  1. Identify all articles mentioned in the ruling
  2. Remove duplicates
  3. List only the article numbers
- **Example**:
  ```yaml
  ruling-articles:
    - Article 4
    - Article 8
    - Article 10
  ```

### `per-article`

- **Source**: Created by mapping each article to the relevant portions of the ruling
- **Format**: 
  - "Article X | [Text that explains/interprets Article X]"
  - Include verbatim extracts from the final-ruling that reference each article
- **Process**:
  1. For each article in ruling-articles, extract the exact text from the final-ruling that interprets it
  2. Combine multiple interpretations of the same article
  3. Format with article number followed by pipe character and relevant verbatim text
- **Example**:
  ```yaml
  per-article:
    - Article 10 | **1.** Article 10(a) of Directive (EU) 2016/680... **3.** Article 10 of Directive 2016/680, read in conjunction with...
  ```

## Special Formatting Notes

1. **Mathematical Slash**: The `title` and `case-number` fields must use a proper slash (/) between numbers. Ensure this is a true slash character, not a hyphen (-).

2. **Multiline Text**: For the `final-ruling` field, use the YAML multiline string format `|-` to preserve line breaks without the trailing newline.

3. **Cross-References**: Maintain cross-references in the ruling text, especially in the `per-article` field.

4. **Escaping Special Characters**: Ensure any special characters in the text are properly escaped according to YAML syntax.

## Extraction Process

When generating frontmatter:

1. Read the entire document first to understand the case's structure
2. Locate specific sections for extracting data:
   - Case number near the top of the document
   - Date at the beginning of the judgment
   - Parties in the section identifying the litigants
   - Ruling at the end of the document (after "On those grounds, the Court hereby rules:")
3. Extract topics from the substantive discussion throughout the document
4. Identify all articles mentioned in the ruling for the ruling-articles list
5. Create the per-article mapping by extracting verbatim text from the final-ruling that relates to each article

## Example

Here's a complete example based on case C-205/21:

```yaml
---
title: C-205/21
date: 2023-01-26
case-number: C-205/21
parties: V.S. v Ministerstvo na vatreshnite raboti, Glavna direktsia za borba s organiziranata prestapnost
topics:
  - Principles relating to processing of personal data
  - Purpose limitation
  - Data minimisation
  - Lawfulness of processing
  - Collection of biometric and genetic data
  - Presumption of innocence
  - Effective judicial protection
final-ruling: |-
  **1.** Article 10(a) of Directive (EU) 2016/680 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data by competent authorities for the purposes of the prevention, investigation, detection or prosecution of criminal offences or the execution of criminal penalties, and on the free movement of such data, and repealing Council Framework Decision 2008/977/JHA, read in the light of Article 52 of the Charter of Fundamental Rights of the European Union,

  must be interpreted as meaning that the processing of biometric and genetic data by the police authorities with a view to their investigative activities, for purposes of combating crime and maintaining law and order, is authorised by Member State law, within the meaning of Article 10(a) of Directive 2016/680, provided that the law of that Member State contains a sufficiently clear and precise legal basis to authorise that processing. The fact that the national legislative act containing such a legal basis refers, furthermore, to Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation), and not to Directive 2016/680, is not capable, in itself, of calling the existence of such authorisation into question, provided that it is apparent, in a sufficiently clear, precise and unequivocal manner, from the interpretation of the set of applicable provisions of national law that the processing of biometric and genetic data at issue falls within the scope of that directive, and not of that regulation.

  **2.** Article 6(a) of Directive 2016/680 and Articles 47 and 48 of the Charter of Fundamental Rights of the European Union

  must be interpreted as not precluding national legislation which provides that, if the person accused of an intentional offence subject to public prosecution refuses to cooperate voluntarily in the collection of the biometric and genetic data concerning him or her in order for them to be entered in a record, the criminal court having jurisdiction must authorise a measure enforcing their collection, without having the power to assess whether there are serious grounds for believing that the person concerned has committed the offence of which he or she is accused, provided that national law subsequently guarantees effective judicial review of the conditions for that accusation, from which the authorisation to collect those data arises.

  **3.** Article 10 of Directive 2016/680, read in conjunction with Article 4(1)(a) to (c) and Article 8(1) and (2) thereof,
  must be interpreted as precluding national legislation which provides for the systematic collection of biometric and genetic data of any person accused of an intentional offence subject to public prosecution in order for them to be entered in a record, without laying down an obligation on the competent authority to verify whether and demonstrate that, first, their collection is strictly necessary for achieving the specific objectives pursued and, second, those objectives cannot be achieved by measures constituting a less serious interference with the rights and freedoms of the person concerned.
ruling-articles:
  - Article 4
  - Article 8
  - Article 10
per-article:
  - Article 4 | **3.** Article 10 of Directive 2016/680, read in conjunction with Article 4(1)(a) to (c) and Article 8(1) and (2) thereof, must be interpreted as precluding national legislation which provides for the systematic collection of biometric and genetic data of any person accused of an intentional offence subject to public prosecution in order for them to be entered in a record, without laying down an obligation on the competent authority to verify whether and demonstrate that, first, their collection is strictly necessary for achieving the specific objectives pursued and, second, those objectives cannot be achieved by measures constituting a less serious interference with the rights and freedoms of the person concerned.
  - Article 8 | **3.** Article 10 of Directive 2016/680, read in conjunction with Article 4(1)(a) to (c) and Article 8(1) and (2) thereof, must be interpreted as precluding national legislation which provides for the systematic collection of biometric and genetic data of any person accused of an intentional offence subject to public prosecution in order for them to be entered in a record, without laying down an obligation on the competent authority to verify whether and demonstrate that, first, their collection is strictly necessary for achieving the specific objectives pursued and, second, those objectives cannot be achieved by measures constituting a less serious interference with the rights and freedoms of the person concerned.
  - Article 10 | **1.** Article 10(a) of Directive (EU) 2016/680, read in the light of Article 52 of the Charter of Fundamental Rights of the European Union, must be interpreted as meaning that the processing of biometric and genetic data by the police authorities with a view to their investigative activities, for purposes of combating crime and maintaining law and order, is authorised by Member State law, within the meaning of Article 10(a) of Directive 2016/680, provided that the law of that Member State contains a sufficiently clear and precise legal basis to authorise that processing. **3.** Article 10 of Directive 2016/680, read in conjunction with Article 4(1)(a) to (c) and Article 8(1) and (2) thereof, must be interpreted as precluding national legislation which provides for the systematic collection of biometric and genetic data of any person accused of an intentional offence subject to public prosecution in order for them to be entered in a record, without laying down an obligation on the competent authority to verify whether and demonstrate that, first, their collection is strictly necessary for achieving the specific objectives pursued and, second, those objectives cannot be achieved by measures constituting a less serious interference with the rights and freedoms of the person concerned.
---
``` 
