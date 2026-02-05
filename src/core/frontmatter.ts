import matter from 'gray-matter';

export interface FrontmatterData {
  [key: string]: unknown;
}

export interface ParsedFrontmatter {
  data: FrontmatterData;
  content: string;
}

/**
 * Parse frontmatter from markdown content
 * Uses gray-matter for YAML frontmatter parsing
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  try {
    const parsed = matter(content);
    return {
      data: parsed.data as FrontmatterData,
      content: parsed.content,
    };
  } catch (error) {
    throw new Error(`Failed to parse frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stringify data and content to markdown with frontmatter
 */
export function stringifyFrontmatter(data: FrontmatterData, content: string): string {
  if (Object.keys(data).length === 0) {
    return content;
  }

  return matter.stringify(content, data);
}
