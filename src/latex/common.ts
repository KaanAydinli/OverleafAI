export function findBalancedBraceBlock(
  source: string,
  openBraceIdx: number,
): { content: string; end: number } | null {
  if (source[openBraceIdx] !== "{") return null;
  let depth = 0;
  for (let i = openBraceIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : "";
    if (prev === "\\") continue;
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { content: source.slice(openBraceIdx + 1, i), end: i };
      }
    }
  }
  return null;
}

export function findLatexCommandArgs(source: string, command: string): string[] {
  const blocks: string[] = [];
  const pattern = new RegExp(
    `\\\\${command}\\b\\s*(?:\\[[^\\]]*\\])?\\s*\\{`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const block = findBalancedBraceBlock(source, openIdx);
    if (!block) {
      pattern.lastIndex = m.index + m[0].length;
      continue;
    }
    blocks.push(block.content);
    pattern.lastIndex = block.end + 1;
  }
  return blocks;
}

export function stripComments(latex: string): string {
  return latex.replace(/(?<!\\)%[^\n]*/g, "");
}
