import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BIO, WOVEN_ALT } from '../src/content.ts';

const readme = () => readFileSync('README.md', 'utf8');
/** What GitHub actually shows: HTML comments stripped. */
const visible = () => readme().replace(/<!--[\s\S]*?-->/g, '');

test('opens like firsttris: greeting, location/role line, then the bio verbatim', () => {
  const md = visible();
  assert.ok(md.startsWith("# Hi, I'm Pinto 👋\n"));
  assert.ok(md.includes('📍 **Jakarta, Indonesia** | 💻 **Full-stack & platform engineer** | 🗓️ **10+ years**'));
  assert.ok(md.includes(`\n${BIO}\n`));
});

test('the woven year is a dark/light picture with its alt text under "My year, woven"', () => {
  const md = visible();
  const section = md.slice(md.indexOf('## My year, woven'));
  assert.ok(md.includes('## My year, woven'));
  assert.ok(section.includes('srcset="assets/woven-dark.svg"'));
  assert.ok(section.includes(`<img src="assets/woven-light.svg" alt="${WOVEN_ALT}"`));
});

test('every picture pairs a dark source with a light fallback, and every asset exists', () => {
  const md = visible();
  const darks = [...md.matchAll(/srcset="(assets\/[^"]+-dark\.svg)"/g)].map((m) => m[1]);
  const lights = [...md.matchAll(/<img src="(assets\/[^"]+-light\.svg)"/g)].map((m) => m[1]);
  assert.deepEqual(darks.map((p) => p.replace('-dark', '')), lights.map((p) => p.replace('-light', '')));
  for (const path of [...darks, ...lights]) assert.ok(existsSync(path), `${path} is missing`);
});

test('links every public project', () => {
  const md = visible();
  for (const slug of ['socketto', 'barong', 'postcss-indonesian-stylesheets', 'moneyflow', 'blueprint', 'monorepo', 'dotfiles', 'vim-config']) {
    assert.ok(md.includes(`(https://github.com/karsanda/${slug})`), slug);
  }
});

test('external URLs are only GitHub repos, static shields.io badges and LinkedIn', () => {
  const urls = visible().match(/https?:\/\/[^\s"')>]+/g) ?? [];
  const allowed = (u: string) =>
    u.startsWith('https://github.com/karsanda/') || u.startsWith('https://img.shields.io/badge/') || u === 'https://www.linkedin.com/in/pintokarsanda';
  assert.deepEqual(urls.filter((u) => !allowed(u)), []);
});

test('easter-egg hint and guestbook marker are present as comments', () => {
  const md = readme();
  assert.ok(md.includes("<!-- You read the source. The top border isn't only decoration: ▲ is 1, ▼ is 0. -->"));
  assert.ok(md.includes('<!-- selvedge: guestbook strip goes here after launch -->'));
});

test('tech badges: Node.js, Vue, Svelte, Astro and Electron are in; Go is out', () => {
  const badges = [...visible().matchAll(/!\[([^\]]+)\]\(https:\/\/img\.shields\.io\/badge\//g)].map((m) => m[1]);
  for (const name of ['Node.js', 'Vue', 'Svelte', 'Astro', 'Electron']) assert.ok(badges.includes(name), name);
  assert.ok(!badges.includes('Go'));
});

test('Off the keyboard names every hobby', () => {
  const md = visible();
  const section = md.slice(md.indexOf('## Off the keyboard'));
  assert.ok(md.includes('## Off the keyboard'));
  for (const hobby of ['travelling', 'jogging', 'good food', 'brewing my own coffee', 'Monster Hunter', 'mechanical keyboards']) assert.ok(section.includes(hobby), hobby);
});

test('no separate At work section: the bio is the one place that says what I do', () => {
  const md = visible();
  assert.doesNotMatch(md, /^## At work/m);
  assert.doesNotMatch(md, /whole stack/); // the role line already says full-stack
});

test('side projects are framed humbly', () => {
  const md = visible();
  assert.ok(md.includes('## Side quests 🗺️'));
  assert.doesNotMatch(md, /because I (wanted|needed)/);
});

test('Connect shows LinkedIn only', () => {
  const md = visible();
  const section = md.slice(md.indexOf('## Connect'), md.indexOf('## Off the keyboard'));
  assert.ok(md.includes('## Connect'));
  assert.ok(section.includes('](https://www.linkedin.com/in/pintokarsanda)'));
  assert.equal((section.match(/\]\(https?:/g) ?? []).length, 2); // the badge image + its link
});

test('bio does not undersell: no "learning" framing', () => {
  assert.doesNotMatch(visible(), /Most days I'm learning/);
});

test('the people side is its own paragraph, and the janitor line starts with "Lately,"', () => {
  const [work, people] = BIO.split('\n\n');
  assert.ok(people?.includes('mentored engineers') && people.includes('engineering manager'));
  assert.ok(!work.includes('mentored'));
  assert.match(work, /Lately, I also play vibe-code janitor 🧹/);
  assert.doesNotMatch(BIO, /Every now and then/);
  assert.equal((BIO.match(/lately/gi) ?? []).length, 1);
});

test('the caption under the weave stays short', () => {
  const md = visible();
  const caption = md.slice(md.indexOf('## My year, woven')).match(/<sub>([\s\S]*?)<\/sub>/)![1];
  assert.ok(caption.split(/\s+/).length <= 25, `${caption.split(/\s+/).length} words`);
});

test('janitor line uses the prime-time flavor', () => {
  assert.match(BIO, /Lately, I also play vibe-code janitor 🧹, giving vibe-coded prototypes a proper scrub so they survive prime-time traffic\./);
});

test('side quests are grouped, firsttris style', () => {
  const md = visible();
  const quests = md.slice(md.indexOf('## Side quests'), md.indexOf('## Connect'));
  const groups = [...quests.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(groups, ['Tools & libraries', 'Apps', 'Experiments', 'Setup']);
});

test('forks without any of my own commits are not listed, except vim-config by request', () => {
  for (const fork of ['ua-parser-js', 'react-linkify', 'react-easy-emoji']) assert.ok(!visible().includes(fork), fork);
});

test('blueprint is described plainly, without "Lagi dimasak"', () => {
  assert.doesNotMatch(visible(), /Lagi dimasak/i);
});

/** github.com/karsanda public, non-fork repos plus barong (forks with my commits), as listed by `gh repo list --visibility public`. */
const PUBLIC_REPOS = ['blueprint', 'dotfiles', 'postcss-indonesian-stylesheets', 'monorepo', 'socketto', 'barong', 'moneyflow', 'vim-config'];

test('links only to public repos', () => {
  const linked = [...visible().matchAll(/https:\/\/github\.com\/karsanda\/([\w.-]+)/g)].map((m) => m[1]);
  assert.deepEqual(linked.filter((repo) => !PUBLIC_REPOS.includes(repo)), []);
});

test('the socketto demos are not listed separately', () => {
  assert.doesNotMatch(visible(), /websocket-(server|client)/);
});

test('sidebar bio uses the same title as the role line', async () => {
  const { SIDEBAR_BIO } = await import('../src/content.ts');
  assert.equal(SIDEBAR_BIO, 'Full-stack & platform engineer in Jakarta. Weaves songket out of commits.');
  assert.ok(SIDEBAR_BIO.length <= 160);
});

test('signs off in Bahasa, with a translation, as the last line', () => {
  const lines = visible().trimEnd().split('\n');
  assert.equal(lines[lines.length - 1], '**Terima kasih sudah mampir!** 👋 <sub>(Thanks for stopping by!)</sub>');
});
