import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { addDays } from '../dates.ts';
import type { DayCounts } from '../types.ts';
import { sumDays } from './index.ts';

const QUERY = `query($from: DateTime!, $to: DateTime!) { viewer { contributionsCollection(from: $from, to: $to) {
  contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;

/** GitHub rejects contribution ranges longer than one year. */
const MAX_CHUNK_DAYS = 365;

type Runner = (args: string[]) => Promise<string>;

const runGh: Runner = async (args) => (await promisify(execFile)('gh', args, { maxBuffer: 16 * 1024 * 1024 })).stdout;

interface CalendarResponse {
  data: { viewer: { contributionsCollection: { contributionCalendar: {
    weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
  } } } };
}

export function parseGithubCalendar(json: string): DayCounts {
  const parsed = JSON.parse(json) as CalendarResponse;
  const days: DayCounts = new Map();
  for (const week of parsed.data.viewer.contributionsCollection.contributionCalendar.weeks) {
    for (const { date, contributionCount } of week.contributionDays) {
      if (contributionCount > 0) days.set(date, contributionCount);
    }
  }
  return days;
}

/** Daily contribution counts for [from, to], fetched in ≤ 1-year chunks. Errors from `gh` propagate. */
export async function fetchGithubDays(from: string, to: string, run: Runner = runGh): Promise<DayCounts> {
  const chunks: DayCounts[] = [];
  for (let start = from; start <= to; ) {
    const capped = addDays(start, MAX_CHUNK_DAYS - 1);
    const end = capped < to ? capped : to;
    const json = await run([
      'api', 'graphql',
      '-f', `query=${QUERY}`,
      '-f', `from=${start}T00:00:00+07:00`,
      '-f', `to=${end}T23:59:59+07:00`,
    ]);
    const inChunk: DayCounts = new Map();
    for (const [day, n] of parseGithubCalendar(json)) {
      if (day >= start && day <= end) inChunk.set(day, n);
    }
    chunks.push(inChunk);
    start = addDays(end, 1);
  }
  return sumDays(...chunks);
}
