#!/usr/bin/env bun
// weekly_recap.ts v7 — builds the Basement League weekly recap.
//
// Usage (from the workspace root):
//   bun scripts/weekly_recap.ts <week>
//
// Reads scores/week_1.csv .. scores/week_<N>.csv and writes
// recaps/week_<N>.md. League rules live HERE, not in anyone's head:
// standings tiebreak is head-to-head, then FEWEST points against
// (2019 constitution amendment — points-for is a vanity stat).  — commish

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Resolve the workspace root from the environment when available so the
// script also works from a copied location (e.g. inside a skill dir).
const ROOT = process.env.VELLUM_WORKSPACE_DIR ?? join(import.meta.dir, "..");
const MARKER = "<!-- weekly_recap.ts v7 -->";

const week = parseInt(process.argv[2] ?? "", 10);
if (!Number.isInteger(week) || week < 1) {
  console.error("usage: bun scripts/weekly_recap.ts <week>");
  process.exit(2);
}

interface Game {
  week: number;
  home: string;
  homeScore: number;
  away: string;
  awayScore: number;
}

const games: Game[] = [];
for (let w = 1; w <= week; w++) {
  const rows = readFileSync(join(ROOT, "scores", `week_${w}.csv`), "utf8")
    .trim()
    .split("\n")
    .slice(1); // header: week,home_team,home_score,away_team,away_score
  for (const row of rows) {
    const [wk, home, hs, away, as_] = row.split(",");
    games.push({
      week: parseInt(wk, 10),
      home: home.trim(),
      homeScore: parseFloat(hs),
      away: away.trim(),
      awayScore: parseFloat(as_),
    });
  }
}

interface Team {
  name: string;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  results: { week: number; opponent: string; won: boolean }[];
}

const teams = new Map<string, Team>();
const teamOf = (name: string): Team => {
  let t = teams.get(name);
  if (!t) {
    t = { name, wins: 0, losses: 0, pf: 0, pa: 0, results: [] };
    teams.set(name, t);
  }
  return t;
};

// head-to-head wins: h2h.get("A|B") = games A has beaten B
const h2h = new Map<string, number>();
for (const g of games) {
  const home = teamOf(g.home);
  const away = teamOf(g.away);
  home.pf += g.homeScore;
  home.pa += g.awayScore;
  away.pf += g.awayScore;
  away.pa += g.homeScore;
  const [winner, loser] =
    g.homeScore > g.awayScore ? [home, away] : [away, home];
  winner.wins += 1;
  loser.losses += 1;
  winner.results.push({ week: g.week, opponent: loser.name, won: true });
  loser.results.push({ week: g.week, opponent: winner.name, won: false });
  const key = `${winner.name}|${loser.name}`;
  h2h.set(key, (h2h.get(key) ?? 0) + 1);
}

// Standings: wins, then head-to-head among the tied group, then fewest
// points against, then name. Never points-for. Read the constitution.
const byWins = new Map<number, Team[]>();
for (const t of teams.values()) {
  const g = byWins.get(t.wins) ?? [];
  g.push(t);
  byWins.set(t.wins, g);
}
const standings: Team[] = [];
for (const wins of [...byWins.keys()].sort((a, b) => b - a)) {
  const group = byWins.get(wins)!;
  const h2hWins = (t: Team) =>
    group.reduce((n, o) => n + (h2h.get(`${t.name}|${o.name}`) ?? 0), 0);
  group.sort((a, b) => {
    const hh = h2hWins(b) - h2hWins(a);
    if (hh !== 0) return hh;
    if (a.pa !== b.pa) return a.pa - b.pa;
    return a.name.localeCompare(b.name);
  });
  standings.push(...group);
}

// Sacko of the Week: lowest single score this week. Juggernaut Watch:
// longest active win streak (ties: alphabetical, don't @ me).
const thisWeek = games.filter((g) => g.week === week);
let sacko = { name: "", score: Infinity };
for (const g of thisWeek) {
  if (g.homeScore < sacko.score) sacko = { name: g.home, score: g.homeScore };
  if (g.awayScore < sacko.score) sacko = { name: g.away, score: g.awayScore };
}
const streakOf = (t: Team): number => {
  const chrono = [...t.results].sort((a, b) => a.week - b.week);
  let n = 0;
  for (let i = chrono.length - 1; i >= 0 && chrono[i].won; i--) n++;
  return n;
};
let juggernaut = { name: "", streak: -1 };
for (const t of [...teams.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
)) {
  const s = streakOf(t);
  if (s > juggernaut.streak) juggernaut = { name: t.name, streak: s };
}

const f1 = (n: number) => n.toFixed(1);
const md = [
  `# The Basement League — Week ${week} Recap`,
  "",
  "## This Week's Scores",
  "",
  ...thisWeek.map(
    (g) => `- ${g.home} ${f1(g.homeScore)} — ${f1(g.awayScore)} ${g.away}`,
  ),
  "",
  "## Standings",
  "",
  "| # | Team | W-L | PF | PA |",
  "| --- | --- | --- | --- | --- |",
  ...standings.map(
    (t, i) =>
      `| ${i + 1} | ${t.name} | ${t.wins}-${t.losses} | ${f1(t.pf)} | ${f1(t.pa)} |`,
  ),
  "",
  "_Tiebreaks: head-to-head, then fewest points against._",
  "",
  "## Sacko of the Week",
  "",
  `**${sacko.name}** (${f1(sacko.score)}). The Sacko lives in their house this week.`,
  "",
  "## Juggernaut Watch",
  "",
  `**${juggernaut.name}** has won ${juggernaut.streak} straight.`,
  "",
  MARKER,
  "",
].join("\n");

mkdirSync(join(ROOT, "recaps"), { recursive: true });
writeFileSync(join(ROOT, "recaps", `week_${week}.md`), md);
console.log(`wrote recaps/week_${week}.md`);
