import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

// content/learn/*.md → 카드. 머리말(frontmatter)은 단순한 key: value / 목록만 지원한다.
export type LearnCard = {
  slug: string;
  title: string;
  emoji: string;
  summary: string;
  sources: string[];
  needsReview: boolean;
  html: string;
};

const DIR = path.join(process.cwd(), "content", "learn");

function parseFrontmatter(raw: string) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {} as Record<string, string | string[]>, body: raw };
  const meta: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (meta[listKey] as string[]).push(item[1].trim());
      continue;
    }
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    if (kv[2] === "") {
      listKey = kv[1];
      meta[listKey] = [];
    } else {
      listKey = null;
      meta[kv[1]] = kv[2].trim();
    }
  }
  return { meta, body: m[2] };
}

// CommonMark 규칙상 "**44.4%**가"처럼 닫는 ** 바로 뒤에 조사가 붙으면 굵게가 적용되지 않는다.
// 한국어 편집자를 위해 한 줄 안의 **…** 를 미리 <strong> 으로 바꾼다.
function koreanBold(md: string) {
  return md.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

export async function loadLearnCards(): Promise<LearnCard[]> {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (file) => {
      const { meta, body } = parseFrontmatter(await readFile(path.join(DIR, file), "utf8"));
      const str = (k: string, d = "") => (typeof meta[k] === "string" ? (meta[k] as string) : d);
      return {
        slug: file.replace(/^\d+-/, "").replace(/\.md$/, ""),
        title: str("title", file),
        emoji: str("emoji", "🌱"),
        summary: str("summary"),
        sources: Array.isArray(meta.sources) ? meta.sources : [],
        needsReview: str("needsReview") === "true",
        html: await marked.parse(koreanBold(body)),
      };
    }),
  );
}
