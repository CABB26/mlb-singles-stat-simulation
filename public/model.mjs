export function probability(hr, pa, opportunities = 4, prior = .03, strength = 100) {
  if (![hr, pa, opportunities, prior, strength].every(Number.isFinite) || hr < 0 || pa < hr || opportunities < 0 || !Number.isInteger(opportunities) || prior < 0 || prior > 1 || strength <= 0) throw new Error('Invalid model inputs');
  const rate = (hr + strength * prior) / (pa + strength);
  return {rate, chance: 1 - (1 - rate) ** opportunities};
}
export function random(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function rank(players, {opportunities = 4, trials = 20000, seed = 2026} = {}) {
  if (!Number.isInteger(trials) || trials < 1000 || trials > 100000) throw new Error('Invalid simulation count');
  return players.map(p => {
    const {rate, chance} = probability(p.hr, p.pa, opportunities);
    const rng = random(seed ^ p.id ^ p.gameId); let hits = 0;
    for (let i = 0; i < trials; i++) { let homer = false; for (let j = 0; j < opportunities; j++) if (rng() < rate) homer = true; if (homer) hits++; }
    return {...p, rate, chance, simulated: hits / trials};
  }).sort((a,b) => b.chance - a.chance || b.pa - a.pa || a.id - b.id)
    .filter((p,i,a) => a.findIndex(q => q.id === p.id) === i);
}
