// Multiple-choice rounds for quiz battles, built from the deck itself: each
// card's answer plus up to three other cards' answers as the wrong options.
// No AI call, and every player gets the same order because the starter
// builds this once and broadcasts it.
export function buildRounds(cards, rand = Math.random) {
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const norm = (s) => s.trim().toLowerCase();
  return cards.map((card, i) => {
    const seen = new Set([norm(card.back)]);
    const wrong = [];
    for (const other of shuffle(cards.filter((_, j) => j !== i))) {
      if (wrong.length === 3) break;
      if (seen.has(norm(other.back))) continue;
      seen.add(norm(other.back));
      wrong.push(other.back);
    }
    const options = shuffle([card.back, ...wrong]);
    return { front: card.front, back: card.back, options, correct: options.indexOf(card.back) };
  });
}
