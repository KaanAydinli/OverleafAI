import {
  findBalancedBraceBlock,
  findLatexCommandArgs,
  stripComments,
} from "./common.js";

const DROP_COMMANDS = [
  "thanks",
  "footnote",
  "inst",
  "affil",
  "affiliation",
  "address",
  "email",
  "altaffilmark",
  "footnotemark",
  "IEEEauthorrefmark",
  "IEEEauthorblockA",
  "textsuperscript",
  "textsubscript",
  "ref",
  "label",
  "orcid",
];

function cleanAuthorString(raw: string): string {
  let s = raw;

  for (const cmd of DROP_COMMANDS) {
    const re = new RegExp(`\\\\${cmd}\\s*(?:\\[[^\\]]*\\])?\\s*\\{`, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(s)) !== null) {
      const open = match.index + match[0].length - 1;
      const block = findBalancedBraceBlock(s, open);
      if (!block) break;
      s = s.slice(0, match.index) + " " + s.slice(block.end + 1);
      re.lastIndex = match.index;
    }
  }

  s = s.replace(/\$[^$]*\$/g, " ");
  s = s.replace(/\\[A-Za-z]+\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, " $1 ");
  s = s.replace(/\\[A-Za-z]+\*?/g, " ");
  s = s.replace(/[\^_]\{[^}]*\}/g, " ");
  s = s.replace(/[\^_][A-Za-z0-9*†‡§¶]/g, " ");
  s = s.replace(/[*†‡§¶]/g, " ");
  s = s.replace(/\\\\/g, " ");
  s = s.replace(/[{}]/g, " ");
  s = s.replace(/~/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s,;.\-*]+|[\s,;.\-*]+$/g, "");
  return s;
}

function splitAuthorBlock(block: string): string[] {
  if (/\\and\b/.test(block)) {
    return block.split(/\\and\b/).map((part) => part.split(/\\\\/)[0]);
  }
  if (/\\\\/.test(block)) {
    return block.split(/\\\\/);
  }

  return block.split(/\s*,\s+(?=[A-ZÀ-Ö])/);
}

function isPlausibleName(s: string): boolean {
  if (s.length < 2 || s.length > 120) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s)) return false;
  if (/@/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  return true;
}

export function parseAuthorsFromLatex(rawSource: string): string[] {
  const source = stripComments(rawSource);
  const collected: string[] = [];

  const ieeeBlocks = findLatexCommandArgs(source, "IEEEauthorblockN");
  for (const block of ieeeBlocks) {
    for (const part of splitAuthorBlock(block)) {
      const cleaned = cleanAuthorString(part);
      if (cleaned) collected.push(cleaned);
    }
  }

  if (collected.length === 0) {
    const authorBlocks = findLatexCommandArgs(source, "author");
    for (const block of authorBlocks) {
      for (const part of splitAuthorBlock(block)) {
        const cleaned = cleanAuthorString(part);
        if (cleaned) collected.push(cleaned);
      }
    }
  }

  if (collected.length === 0) {
    const nameBlocks = findLatexCommandArgs(source, "name");
    for (const block of nameBlocks) {
      for (const part of splitAuthorBlock(block)) {
        const cleaned = cleanAuthorString(part);
        if (cleaned) collected.push(cleaned);
      }
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of collected) {
    const key = name.toLowerCase();
    if (!seen.has(key) && isPlausibleName(name)) {
      seen.add(key);
      unique.push(name);
    }
  }
  return unique;
}
