import nlp from "compromise";

import type { ParsedCVResult } from "@/types";

const SECTION_HEADINGS = {
  summary: [
    "summary",
    "professional summary",
    "profile",
    "personal profile",
    "career objective",
    "objective",
    "about me",
    "gioi thieu",
    "tom tat",
    "muc tieu nghe nghiep",
  ],
  experience: [
    "experience",
    "work experience",
    "employment history",
    "professional experience",
    "career history",
    "kinh nghiem",
    "kinh nghiem lam viec",
    "qua trinh cong tac",
  ],
  education: [
    "education",
    "academic background",
    "hoc van",
    "qua trinh hoc tap",
    "nen tang hoc van",
    "trinh do hoc van",
    "dao tao",
  ],
  skills: [
    "skills",
    "technical skills",
    "core skills",
    "competencies",
    "skill set",
    "ky nang",
    "ky nang chuyen mon",
  ],
  certifications: [
    "certifications",
    "certificates",
    "licenses",
    "chung chi",
    "bang cap",
  ],
  languages: [
    "languages",
    "language",
    "ngoai ngu",
    "ngon ngu",
  ],
} as const;

const ROLE_KEYWORDS = [
  "developer",
  "engineer",
  "designer",
  "manager",
  "specialist",
  "recruiter",
  "analyst",
  "consultant",
  "architect",
  "lead",
  "tester",
  "qa",
  "product",
  "project",
  "data",
  "devops",
  "frontend",
  "front end",
  "backend",
  "back end",
  "fullstack",
  "full stack",
  "mobile",
  "marketing",
  "sales",
  "accountant",
  "hr",
  "talent",
  "intern",
  "fresher",
  "executive",
  "officer",
  "director",
  "coordinator",
  "nhan vien",
  "chuyen vien",
  "quan ly",
  "thuc tap",
  "lap trinh vien",
  "ky su",
  "thiet ke",
  "tuyen dung",
  "ke toan",
  "kiem toan",
  "tai chinh",
  "truong phong",
  "giam doc",
  "phu trach",
];

const SKILL_DICTIONARY = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "JavaScript",
  "Tailwind CSS",
  "Prisma",
  "Figma",
  "UI/UX",
  "Product Management",
  "Recruitment",
  "Sourcing",
  "SQL",
  "Python",
  "Java",
  "C#",
  "AWS",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "REST API",
  "HTML",
  "CSS",
  "SCSS",
  "Vue",
  "Angular",
  "NestJS",
  "Express",
  "Laravel",
  "PHP",
  "Git",
  "CI/CD",
  "Jira",
  "Agile",
  "Scrum",
  "Canva",
  "Photoshop",
  "Illustrator",
  "Excel",
  "Power BI",
  "Tableau",
  "Communication",
  "Leadership",
  "Project Management",
  "Business Analysis",
  "Testing",
  "Automation Testing",
  "Manual Testing",
];

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

type LineEntry = {
  raw: string;
  search: string;
};

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:/@.+#&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanInlineValue(value: string) {
  return value.replace(/^[:\-–—|]\s*/, "").replace(/\s+/g, " ").trim();
}

function isBoilerplate(value: string) {
  return /nen tang cong nghe|tuyen dung thong minh|tiep loi the|noi thanh cong|trang \d|^aid:|^topcv\b/.test(normalizeForSearch(value));
}

function toLineEntries(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => ({
      raw,
      search: normalizeForSearch(raw),
    }));
}

function uniqueStrings(values: Array<string | undefined | null>) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const cleaned = cleanInlineValue(value);
    if (!cleaned) continue;

    const key = normalizeForSearch(cleaned);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function findFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[0]?.trim();
}

function isHeadingMatch(line: string, heading: string) {
  return line === heading || line.startsWith(`${heading}:`) || line.startsWith(`${heading} `);
}

function isLikelyHeading(line: string) {
  const headingValues = Object.values(SECTION_HEADINGS).flat();
  return headingValues.some((heading) => isHeadingMatch(line, heading));
}

function findValueByLabels(lines: LineEntry[], labels: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const entry = lines[index];
    const label = [...labels].sort((a, b) => b.length - a.length).find((item) => isHeadingMatch(entry.search, item));

    if (!label) continue;

    const sameLine = cleanInlineValue(entry.raw.slice(entry.raw.toLowerCase().indexOf(":") + 1).split("|")[0]);
    if (entry.raw.includes(":") && sameLine) {
      return sameLine;
    }

    const trimmedRaw = cleanInlineValue(entry.raw.slice(label.length));
    if (trimmedRaw && normalizeForSearch(trimmedRaw) !== label) {
      return trimmedRaw;
    }

    const next = lines[index + 1];
    if (next && !isLikelyHeading(next.search)) {
      return next.raw;
    }
  }

  return undefined;
}

function extractSection(lines: LineEntry[], headings: readonly string[], maxLines = 14) {
  for (let index = 0; index < lines.length; index += 1) {
    const entry = lines[index];
    const matchedHeading = headings.find((heading) => isHeadingMatch(entry.search, heading));
    if (!matchedHeading) continue;

    const collected: string[] = [];
    const inlineValue = entry.raw.includes(":")
      ? cleanInlineValue(entry.raw.slice(entry.raw.indexOf(":") + 1))
      : "";

    if (inlineValue && normalizeForSearch(inlineValue) !== matchedHeading) {
      collected.push(inlineValue);
    }

    for (let nextIndex = index + 1; nextIndex < lines.length && collected.length < maxLines; nextIndex += 1) {
      const next = lines[nextIndex];
      if (isLikelyHeading(next.search)) break;
      collected.push(next.raw);
    }

    if (collected.length) {
      return collected;
    }
  }

  return [];
}

function normalizePhone(phone: string) {
  return phone
    .replace(/[^\d+]/g, "")
    .trim();
}

function findEmails(text: string) {
  return uniqueStrings(text.match(/[\w.+-]+@(?:[\w-]+\.)+[a-z]{2,}/gi) ?? []);
}

function findPhones(text: string) {
  const matches =
    text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?(?:\d[\s.-]?){7,12}\d/g) ?? [];

  return uniqueStrings(
    matches
      .map((item) => normalizePhone(item))
      .filter((item) => item.replace(/\D/g, "").length >= 9 && item.replace(/\D/g, "").length <= 15),
  );
}

function findLinks(text: string) {
  return uniqueStrings(
    text.match(
      /(?:https?:\/\/|www\.|linkedin\.com\/|github\.com\/|gitlab\.com\/|behance\.net\/|dribbble\.com\/)[^\s)>,]+/gi,
    ) ?? [],
  ).map((value) => value.replace(/[.,;]+$/, ""));
}

function toDisplayCase(value: string) {
  if (value === value.toUpperCase()) {
    return value
      .toLowerCase()
      .replace(/(^|\s)\p{L}/gu, (char) => char.toUpperCase());
  }

  return value;
}

function looksLikeContactLine(line: string) {
  return /@|linkedin|github|behance|dribbble|portfolio|phone|mobile|tel|sdt|dien thoai/.test(line);
}

function detectName(lines: LineEntry[]) {
  const labeledName = findValueByLabels(lines, ["full name", "name", "ho ten", "ho va ten", "ung vien", "candidate"]);
  if (labeledName) return toDisplayCase(labeledName);

  const topCandidates = lines.slice(0, 10).map((line) => line.raw);
  for (const line of topCandidates) {
    const search = normalizeForSearch(line);
    const words = line.split(/\s+/).filter(Boolean);

    if (
      words.length >= 2 &&
      words.length <= 5 &&
      line.length <= 50 &&
      !/\d/.test(line) &&
      !looksLikeContactLine(search) &&
      !isBoilerplate(search) &&
      !ROLE_KEYWORDS.some((keyword) => new RegExp(`(?:^|\\s)${keyword}(?:$|\\s)`).test(search)) &&
      !/resume|curriculum|vitae|cv/.test(search) &&
      !isLikelyHeading(search)
    ) {
      return toDisplayCase(line);
    }
  }

  const firstBlock = lines.slice(0, 8).map((line) => line.raw).join(" ");
  const person = nlp(firstBlock).people().out("array")[0];
  if (person) return toDisplayCase(person);

  return undefined;
}

function detectPosition(lines: LineEntry[], fullName?: string): { value?: string; inferred: boolean } {
  const labeledPosition = findValueByLabels(lines, [
    "position",
    "job title",
    "current title",
    "desired position",
    "target position",
    "vi tri",
    "vi tri ung tuyen",
    "muc tieu vi tri",
  ]);

  if (labeledPosition && !isBoilerplate(labeledPosition)) return { value: labeledPosition, inferred: false };

  const candidates: Array<{ value: string; score: number }> = [];
  for (const [index, entry] of lines.entries()) {
    if (fullName && normalizeForSearch(entry.raw) === normalizeForSearch(fullName)) continue;
    if (looksLikeContactLine(entry.search) || isLikelyHeading(entry.search) || isBoilerplate(entry.search)) continue;
    if (entry.raw.length < 4 || entry.raw.length > 100 || /\d|@|:|[.!?;]/.test(entry.raw)) continue;
    const value = entry.raw.replace(/^(?:[-•●▪]|s)\s+/u, "");
    const search = normalizeForSearch(value);
    if (/chung chi|khoa hoc|chuyen nganh|dai hoc|\bdh\b|trung tam|cong ty|university|certificate|course|bao cao|xuat sac|giai thuong|thanh tich|nhan vien cua nam|employee of the/.test(search)) continue;
    if (search.split(" ").length > 14) continue;
    const preceding = lines.slice(Math.max(0, index - 3), index).map((line) => line.search);
    const followsSchool = preceding.some((line, schoolIndex) =>
      /dai hoc|\bdh\b|university|college|chuyen nganh/.test(line) &&
      !preceding.slice(schoolIndex + 1).some((next) => /cong ty|kinh nghiem|company|experience/.test(next)));
    if (followsSchool) continue;

    if (ROLE_KEYWORDS.some((keyword) => new RegExp(`(?:^|\\s)${keyword}(?:$|\\s)`).test(search))) {
      const titlePrefix = /^(?:(?:senior|junior|lead|principal|staff)\s+)?(?:truong nhom|truong phong|phu trach|ke toan|kiem toan|giam doc|nhan vien|chuyen vien|ky su|lap trinh vien|software|frontend|backend|full.?stack|data|product|project|business|accountant|designer|developer|engineer)/.test(search);
      if (!titlePrefix && index >= 12) continue;
      candidates.push({ value, score: (titlePrefix ? 100 : 0) + (index < 12 ? 20 : 0) - index / 1000 });
    }
  }

  return { value: candidates.sort((a, b) => b.score - a.score)[0]?.value, inferred: true };
}

function pickDateCandidate(value?: string) {
  if (!value) return undefined;

  const directDate = value.match(/\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b/);
  if (directDate) return directDate[0];

  const year = value.match(/\b(?:19|20)\d{2}\b/);
  if (!year) return undefined;

  const numericYear = Number(year[0]);
  const currentYear = new Date().getFullYear();
  if (numericYear >= 1960 && numericYear <= currentYear - 14) {
    return year[0];
  }

  return undefined;
}

function detectDateOfBirth(lines: LineEntry[], text: string) {
  const labeled = findValueByLabels(lines, [
    "date of birth",
    "dob",
    "birth",
    "ngay sinh",
    "nam sinh",
    "sinh ngay",
  ]);
  const labeledCandidate = pickDateCandidate(labeled);
  if (labeledCandidate) return labeledCandidate;

  const topText = lines.slice(0, 20).map((line) => line.raw).join(" ");
  const contextual = topText.match(
    /(?:date of birth|dob|birth|ngay sinh|nam sinh)[^0-9]{0,12}(\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}|\b(?:19|20)\d{2}\b)/i,
  );
  if (contextual?.[1]) return contextual[1];

  return undefined;
}

function detectAddress(lines: LineEntry[]) {
  return findValueByLabels(lines, [
    "address",
    "current address",
    "dia chi",
    "noi o",
    "thuong tru",
    "tam tru",
  ]);
}

function detectHometown(lines: LineEntry[]) {
  return findValueByLabels(lines, [
    "hometown",
    "place of birth",
    "que quan",
    "noi sinh",
    "nguyen quan",
  ]);
}

function detectSchool(lines: LineEntry[]) {
  const schoolPattern = /\b(?:university|college|academy|institute|school|dai hoc|hoc vien|cao dang|dh|cd)\b/;
  for (const [index, entry] of lines.entries()) {
    if (!schoolPattern.test(entry.search) || /chung chi|khoa hoc|tot nghiep|certificate|course|cong ty/.test(entry.search)) continue;
    let value = entry.raw.replace(/^(?:[-•●▪]|s)\s+/u, "");
    const next = lines[index + 1];
    if (next && /^(?:ha noi|ho chi minh|tp\.? ho chi minh|da nang|hue|can tho)$/i.test(next.search)) {
      value += ` ${next.raw}`;
    }
    return value.replace(/^(?:school|university name|trường học)\s*:\s*/iu, "").replace(/^ĐH\s+/iu, "Đại học ");
  }
  return undefined;
}

function detectSource(text: string) {
  for (const line of text.split("\n")) {
    for (const segment of line.split("|")) {
      if (!/^(?:nguon(?: cv| ung vien| tuyen dung)?|source|candidate source)\s*:/.test(normalizeForSearch(segment))) continue;
      const value = segment.slice(segment.indexOf(":") + 1).trim();
      if (value && value.length <= 120) return value;
    }
  }
  return undefined;
}

function detectGraduationYear(lines: LineEntry[]) {
  const labeledYear = findValueByLabels(lines, [
    "graduation year",
    "graduated",
    "year of graduation",
    "nam tot nghiep",
    "tot nghiep",
  ]);
  const fromLabel = labeledYear?.match(/\b(19|20)\d{2}\b/)?.[0];
  if (fromLabel) return fromLabel;

  const educationSection = extractSection(lines, SECTION_HEADINGS.education, 12).join(" ");
  const years = [...educationSection.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  const currentYear = new Date().getFullYear();
  const validYears = years.filter((year) => year >= 1990 && year <= currentYear + 2);
  if (!validYears.length) return undefined;

  return String(Math.max(...validYears));
}

function tokenizeSkillSection(lines: string[]) {
  return uniqueStrings(
    lines
      .flatMap((line) => line.split(/[|,;•·\u2022]/))
      .flatMap((line) => line.split(/\s{2,}/))
      .map((item) => cleanInlineValue(item))
      .filter((item) => {
        const search = normalizeForSearch(item);
        return (
          item.length >= 2 &&
          item.length <= 40 &&
          !/^\d+$/.test(item) &&
          !/@|http|linkedin|github/.test(search) &&
          !isLikelyHeading(search) &&
          !/^(skills?|ky nang|technical|competencies?)$/.test(search)
        );
      }),
  );
}

function detectSkills(lines: LineEntry[], text: string) {
  const sectionSkills = tokenizeSkillSection(extractSection(lines, SECTION_HEADINGS.skills, 16));

  const dictionarySkills = SKILL_DICTIONARY.filter((skill) =>
    normalizeForSearch(text).includes(normalizeForSearch(skill)),
  );

  return uniqueStrings([...sectionSkills, ...dictionarySkills]).slice(0, 20);
}

function detectSummary(lines: LineEntry[], fullName?: string, position?: string) {
  const summarySection = extractSection(lines, SECTION_HEADINGS.summary, 8);
  if (summarySection.length) {
    return summarySection.join(" ").slice(0, 600);
  }

  const topParagraph = lines
    .slice(0, 18)
    .filter((entry) => {
      if (fullName && normalizeForSearch(entry.raw) === normalizeForSearch(fullName)) return false;
      if (position && normalizeForSearch(entry.raw) === normalizeForSearch(position)) return false;
      if (looksLikeContactLine(entry.search) || isLikelyHeading(entry.search) || isBoilerplate(entry.search)) return false;
      if (/^(?:ung vien|candidate|nguon|source|cong ty)\b/.test(entry.search)) return false;
      return entry.raw.length >= 30 && entry.raw.length <= 180;
    })
    .slice(0, 3)
    .map((entry) => entry.raw);

  if (topParagraph.length) {
    return topParagraph.join(" ").slice(0, 600);
  }

  return undefined;
}

function parseMonthToken(token?: string) {
  if (!token) return undefined;

  const normalized = normalizeForSearch(token).replace(/\./g, "");
  if (!normalized) return undefined;

  if (MONTH_NAME_MAP[normalized]) {
    return MONTH_NAME_MAP[normalized];
  }

  const directNumber = normalized.match(/\b(\d{1,2})\b/);
  if (!directNumber) return undefined;

  const numericValue = Number(directNumber[1]);
  if (numericValue >= 1 && numericValue <= 12) {
    return numericValue;
  }

  return undefined;
}

function mergeRanges(ranges: Array<{ start: number; end: number }>) {
  if (!ranges.length) return [];

  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function extractExperienceYears(sectionText: string) {
  const normalized = normalizeForSearch(sectionText);
  const explicit = normalized.match(/(\d{1,2})(?:\+)?\s*(?:years?|yrs?|nam)(?:\s+of)?\s+experience/);
  if (explicit?.[1]) {
    return Number(explicit[1]);
  }

  const explicitVietnamese = normalized.match(/(?:kinh nghiem|experience)[^\d]{0,12}(\d{1,2})(?:\+)?\s*(?:nam|years?|yrs?)/);
  if (explicitVietnamese?.[1]) {
    return Number(explicitVietnamese[1]);
  }

  const rangeRegex =
    /(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|thang\s*\d{1,2}|thg\s*\d{1,2}|\d{1,2})\s*[/.-]?\s*)?((?:19|20)\d{2})\s*(?:-|to|until|~)\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|thang\s*\d{1,2}|thg\s*\d{1,2}|\d{1,2})\s*[/.-]?\s*)?((?:19|20)\d{2}|present|current|now|hien tai|den nay)/g;

  const currentDate = new Date();
  const intervals: Array<{ start: number; end: number }> = [];

  for (const match of normalized.matchAll(rangeRegex)) {
    const startMonth = parseMonthToken(match[1]) ?? 1;
    const startYear = Number(match[2]);
    const endMonth =
      /present|current|now|hien tai|den nay/.test(match[4])
        ? currentDate.getMonth() + 1
        : parseMonthToken(match[3]) ?? 12;
    const endYear =
      /present|current|now|hien tai|den nay/.test(match[4])
        ? currentDate.getFullYear()
        : Number(match[4]);

    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) continue;

    const start = startYear * 12 + (startMonth - 1);
    const end = endYear * 12 + (endMonth - 1);

    if (end < start) continue;

    const durationInMonths = end - start + 1;
    if (durationInMonths < 2 || durationInMonths > 240) continue;

    intervals.push({ start, end });
  }

  const merged = mergeRanges(intervals);
  if (!merged.length) return undefined;

  const totalMonths = merged.reduce((sum, item) => sum + (item.end - item.start + 1), 0);
  const years = Math.round(totalMonths / 12);

  return years > 0 ? years : undefined;
}

function detectExperience(lines: LineEntry[], text: string) {
  const labeledValue = findValueByLabels(lines, [
    "years of experience",
    "experience",
    "kinh nghiem",
    "so nam kinh nghiem",
  ]);

  const explicitLabeled = labeledValue?.match(/\b(\d{1,2})(?:\+)?\s*(?:years?|yrs?|nam)\b/i);
  if (explicitLabeled?.[1]) {
    return Number(explicitLabeled[1]);
  }

  const explicitInText = extractExperienceYears(text);
  if (explicitInText) return explicitInText;

  const experienceSection = extractSection(lines, SECTION_HEADINGS.experience, 24).join(" ");
  const fromExperienceSection = experienceSection ? extractExperienceYears(experienceSection) : undefined;
  if (fromExperienceSection) return fromExperienceSection;

  return undefined;
}

function extractLanguages(lines: LineEntry[]) {
  return tokenizeSkillSection(extractSection(lines, SECTION_HEADINGS.languages, 8)).slice(0, 6);
}

function extractCertifications(lines: LineEntry[]) {
  return tokenizeSkillSection(extractSection(lines, SECTION_HEADINGS.certifications, 10)).slice(0, 8);
}

function buildScanNotes({
  links,
  languages,
  certifications,
}: {
  links: string[];
  languages: string[];
  certifications: string[];
}) {
  const parts: string[] = [];

  if (links.length) {
    parts.push(`Links: ${links.join(" | ")}`);
  }

  if (languages.length) {
    parts.push(`Ngoai ngu: ${languages.join(", ")}`);
  }

  if (certifications.length) {
    parts.push(`Chung chi: ${certifications.join(", ")}`);
  }

  if (!parts.length) return undefined;

  return `Scan goi y:\n${parts.map((item) => `- ${item}`).join("\n")}`;
}

export function extractFields(text: string): ParsedCVResult {
  const lines = toLineEntries(text);
  const emails = findEmails(text);
  const phones = findPhones(text);
  const links = findLinks(text);
  const fullName = detectName(lines);
  const detectedPosition = detectPosition(lines, fullName);
  const position = detectedPosition.value;
  const languages = extractLanguages(lines);
  const certifications = extractCertifications(lines);

  return {
    fullName,
    email: emails[0],
    phone: phones[0],
    dateOfBirth: detectDateOfBirth(lines, text),
    address: detectAddress(lines),
    hometown: detectHometown(lines),
    school: detectSchool(lines),
    graduationYear: detectGraduationYear(lines),
    yearsOfExperience: detectExperience(lines, text),
    position,
    source: detectSource(text),
    scanWarnings: position && detectedPosition.inferred
      ? ["Vị trí là gợi ý từ chức danh trong CV, chưa xác nhận là vị trí đang ứng tuyển."]
      : !position ? ["CV chưa ghi rõ vị trí ứng tuyển. Vui lòng chọn vị trí trước khi lưu."] : undefined,
    summary: detectSummary(lines, fullName, position),
    skills: detectSkills(lines, text),
    notes: buildScanNotes({
      links,
      languages,
      certifications,
    }),
    rawText: text,
  };
}
