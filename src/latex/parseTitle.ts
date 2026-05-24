import {
  findBalancedBraceBlock,
  findLatexCommandArgs,
  stripComments,
} from "./common.js";

const DROP_COMMANDS_WITH_ARGS = [
  "thanks",
  "footnote",
  "footnotemark",
  "altaffilmark",
  "ref",
  "label",
  "cite",
  "citep",
  "citet",
];

const KEEP_CONTENT_COMMANDS = [
  "textit",
  "textbf",
  "emph",
  "text",
  "texttt",
  "textsc",
  "textsf",
  "textrm",
  "mathrm",
  "mathbf",
  "mathit",
  "uppercase",
  "lowercase",
  "MakeUppercase",
  "MakeLowercase",
];

function cleanTitleString(raw: string): string {
  let s = raw;

  for (const cmd of DROP_COMMANDS_WITH_ARGS) {
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

  for (const cmd of KEEP_CONTENT_COMMANDS) {
    const re = new RegExp(
      `\\\\${cmd}\\s*(?:\\[[^\\]]*\\])?\\s*\\{([^{}]*)\\}`,
      "g",
    );
    s = s.replace(re, " $1 ");
  }

  s = s.replace(/\$([^$]*)\$/g, " $1 ");
  s = s.replace(/\\[A-Za-z]+\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, " $1 ");
  s = s.replace(/\\[A-Za-z]+\*?/g, " ");
  s = s.replace(/\\\\/g, " ");
  s = s.replace(/[{}]/g, " ");
  s = s.replace(/~/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s,;.\-*]+|[\s,;.\-*]+$/g, "");
  return s;
}

export function parseTitleFromLatex(rawSource: string): string {
  const source = stripComments(rawSource);
  const blocks = findLatexCommandArgs(source, "title");
  for (const block of blocks) {
    const cleaned = cleanTitleString(block);
    if (cleaned) return cleaned;
  }
  return "";
}
