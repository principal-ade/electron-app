/**
 * OpenSpec spec-markdown structure parsing.
 *
 * Spec files (see https://github.com/Fission-AI/OpenSpec) follow a stable
 * heading grammar:
 *
 * ```md
 * # <Title>
 *
 * ## Purpose            ← prose
 * ## Requirements       ← stable specs
 *   ### Requirement: X
 *     #### Scenario: Y
 * ## ADDED Requirements ← change deltas (also MODIFIED / REMOVED / RENAMED)
 * ```
 *
 * `parseSpecMarkdown` walks the heading lines (code fences excluded) and
 * returns a lightweight outline used by the spec tab for header stats and the
 * requirements rail. It never throws — a non-conforming file just yields an
 * outline with no sections, and the tab renders it as plain markdown.
 */

/** The delta h2 sections an OpenSpec change spec is allowed to carry. */
export const DELTA_SECTION_KINDS = [
  'ADDED',
  'MODIFIED',
  'REMOVED',
  'RENAMED',
  'DEPRECATED',
] as const;

export type DeltaSectionKind = (typeof DELTA_SECTION_KINDS)[number];

export interface SpecRequirement {
  /** Title with the `Requirement: ` prefix stripped, e.g. `Command Execution`. */
  title: string;
  scenarioTitles: string[];
}

export interface SpecSection {
  /**
   * `purpose` — the `## Purpose` prose; `requirements` — the stable
   * `## Requirements` list; `delta-<kind>` — a change delta section; `other` —
   * any other h2 (e.g. `## Why`).
   */
  kind: 'purpose' | 'requirements' | `delta-${DeltaSectionKind}` | 'other';
  /** Display label, e.g. `Purpose`, `ADDED Requirements`. */
  label: string;
  requirements: SpecRequirement[];
}

export interface SpecOutline {
  /** First `# ` heading, when present (change deltas often omit it). */
  title?: string;
  sections: SpecSection[];
  requirementCount: number;
  scenarioCount: number;
  /** True when any `## <KIND> Requirements` delta section is present. */
  hasDeltaSections: boolean;
}

/** A Scenario heading and the markdown body until the next Scenario/Requirement. */
export interface SpecScenarioBlock {
  title: string;
  body: string;
}

/** A Requirement heading, its introductory prose, and nested scenarios. */
export interface SpecRequirementBlock {
  title: string;
  description: string;
  scenarios: SpecScenarioBlock[];
}

/** A top-level OpenSpec section with its prose and any nested requirements. */
export interface SpecSectionBlock {
  kind: SpecSection['kind'];
  label: string;
  body: string;
  requirements: SpecRequirementBlock[];
}

/** Semantic document model used by the visual spec reader. */
export interface SpecDocument {
  title?: string;
  sections: SpecSectionBlock[];
}

interface HeadingLine {
  level: number;
  text: string;
}

/** Collect `#{1,6} ` heading lines, skipping fenced code blocks. */
function collectHeadings(content: string): HeadingLine[] {
  const headings: HeadingLine[] = [];
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      headings.push({ level: match[1].length, text: match[2] });
    }
  }
  return headings;
}

function sectionKindFor(label: string): SpecSection['kind'] {
  if (label === 'Purpose') return 'purpose';
  if (label === 'Requirements') return 'requirements';
  const deltaMatch = /^([A-Z]+)\s+Requirements$/.exec(label);
  if (
    deltaMatch &&
    (DELTA_SECTION_KINDS as readonly string[]).includes(deltaMatch[1])
  ) {
    return `delta-${deltaMatch[1] as DeltaSectionKind}`;
  }
  return 'other';
}

/**
 * Parse the predictable OpenSpec heading hierarchy while preserving each
 * prose block as Markdown. Fenced code headings are ignored. The visual reader
 * can then group requirements and scenarios without reformatting their text.
 */
export function parseSpecDocument(content: string): SpecDocument {
  const lines = content.split(/\r?\n/);
  const sections: SpecSectionBlock[] = [];
  let title: string | undefined;
  let section: SpecSectionBlock | undefined;
  let requirement: SpecRequirementBlock | undefined;
  let scenario: SpecScenarioBlock | undefined;
  let inFence = false;

  const appendLine = (line: string) => {
    if (scenario) scenario.body += `${line}\n`;
    else if (requirement) requirement.description += `${line}\n`;
    else if (section) section.body += `${line}\n`;
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      appendLine(line);
      inFence = !inFence;
      continue;
    }

    const heading = !inFence ? /^(#{1,6})\s+(.+?)\s*$/.exec(line) : null;
    if (!heading) {
      appendLine(line);
      continue;
    }

    const level = heading[1].length;
    const text = heading[2];
    if (level === 1) {
      if (!title) title = text;
      requirement = undefined;
      scenario = undefined;
      continue;
    }
    if (level === 2) {
      const label = text.replace(/:$/, '').trim();
      section = {
        kind: sectionKindFor(label),
        label,
        body: '',
        requirements: [],
      };
      sections.push(section);
      requirement = undefined;
      scenario = undefined;
      continue;
    }
    if (level === 3 && section && /^Requirement:\s*/i.test(text)) {
      requirement = {
        title: text.replace(/^Requirement:\s*/i, ''),
        description: '',
        scenarios: [],
      };
      section.requirements.push(requirement);
      scenario = undefined;
      continue;
    }
    if (level === 4 && requirement && /^Scenario:\s*/i.test(text)) {
      scenario = {
        title: text.replace(/^Scenario:\s*/i, ''),
        body: '',
      };
      requirement.scenarios.push(scenario);
      continue;
    }

    // Non-standard nested headings are retained in the current markdown body.
    appendLine(line);
  }

  const trimBlock = (value: string) => value.trim();
  return {
    title,
    sections: sections.map((item) => ({
      ...item,
      body: trimBlock(item.body),
      requirements: item.requirements.map((req) => ({
        ...req,
        description: trimBlock(req.description),
        scenarios: req.scenarios.map((itemScenario) => ({
          ...itemScenario,
          body: trimBlock(itemScenario.body),
        })),
      })),
    })),
  };
}

/** Build the outline: h2s become sections, nested h3/h4s their requirements/scenarios. */
export function parseSpecMarkdown(content: string): SpecOutline {
  const headings = collectHeadings(content);
  const sections: SpecSection[] = [];
  let title: string | undefined;

  for (const heading of headings) {
    if (heading.level === 1 && !title) {
      title = heading.text;
      continue;
    }
    if (heading.level === 2) {
      const label = heading.text.replace(/:$/, '').trim();
      sections.push({
        kind: sectionKindFor(label),
        label,
        requirements: [],
      });
      continue;
    }
    // h3/h4 belong to the nearest preceding h2 (or a lead-in pseudo-section).
    const current =
      sections[sections.length - 1] ??
      ({ kind: 'other', label: '', requirements: [] } as SpecSection);
    if (heading.level === 3) {
      current.requirements.push({
        title: heading.text.replace(/^Requirement:\s*/, ''),
        scenarioTitles: [],
      });
    } else if (heading.level === 4) {
      const parent = current.requirements[current.requirements.length - 1];
      if (parent) {
        parent.scenarioTitles.push(heading.text.replace(/^Scenario:\s*/, ''));
      }
    }
  }

  const namedSections = sections.filter((s) => s.label);
  const requirementCount = namedSections.reduce(
    (sum, s) => sum + s.requirements.length,
    0,
  );
  const scenarioCount = namedSections.reduce(
    (sum, s) =>
      sum + s.requirements.reduce((n, r) => n + r.scenarioTitles.length, 0),
    0,
  );

  return {
    title,
    sections: namedSections,
    requirementCount,
    scenarioCount,
    hasDeltaSections: namedSections.some((s) => s.kind.startsWith('delta-')),
  };
}

/**
 * First prose paragraph under `## Purpose`, single-spaced and trimmed — the
 * header's one-line summary. Returned excerpt is capped at `maxChars`.
 */
export function extractPurposeExcerpt(
  content: string,
  maxChars = 220,
): string | undefined {
  const lines = content.split(/\r?\n/);
  let inFence = false;
  let inPurpose = false;
  const para: string[] = [];

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      if (inPurpose) break; // next h2 ends the Purpose section
      if (h2[1].replace(/:$/, '').trim() === 'Purpose') inPurpose = true;
      continue;
    }
    if (!inPurpose) continue;
    const text = line.trim();
    if (text) {
      para.push(text);
    } else if (para.length > 0) {
      break; // blank line ends the first paragraph
    }
  }

  if (para.length === 0) return undefined;
  const excerpt = para.join(' ').replace(/\s+/g, ' ').trim();
  return excerpt.length > maxChars
    ? `${excerpt.slice(0, maxChars - 1)}…`
    : excerpt;
}
