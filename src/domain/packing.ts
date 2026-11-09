export const packingCategories = ['Clothing', 'Toiletries', 'Electronics', 'Travel documents', 'Medications', 'Sports equipment', 'Baby supplies', 'Snacks', 'Miscellaneous'];
const hints: [RegExp, string][] = [
  [/shirt|pant|short|sock|sweater|jacket|dress|swimsuit|shoes?|underwear|pajama|hat|leotard/i, 'Clothing'],
  [/toothbrush|toothpaste|shampoo|sunscreen|deodorant|razor|soap|brush/i, 'Toiletries'],
  [/charger|phone|tablet|ipad|cable|headphone|camera|battery|adapter/i, 'Electronics'],
  [/passport|ticket|document|\bid\b|license|boarding/i, 'Travel documents'],
  [/medic|pill|vitamin|inhaler|band-?aid|pain reliever/i, 'Medications'],
  [/grips?|racket|ball|cleats|helmet|tape/i, 'Sports equipment'],
  [/diaper|wipes|bottle|formula|stroller/i, 'Baby supplies'],
  [/snack|granola|chips|fruit|water/i, 'Snacks'],
];
export const guessCategory = (name: string) => hints.find(([re]) => re.test(name))?.[1] ?? 'Miscellaneous';

/** One item per line. Understands "Socks x3", "3 socks", and "- bullets". */
export function parsePackingLines(text: string, fallbackCategory?: string) {
  return text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\[\s?\])\s*/, '').trim()).filter(Boolean).map((line) => {
    let name = line, quantity = 1;
    const tail = line.match(/^(.*?)\s*[x×]\s*(\d{1,3})$/i);
    const head = line.match(/^(\d{1,3})\s*[x×]?\s+(.+)$/i);
    if (tail) { name = tail[1]; quantity = +tail[2]; } else if (head) { name = head[2]; quantity = +head[1]; }
    return { name: name.slice(0, 160), quantity: Math.min(Math.max(quantity, 1), 999), category: fallbackCategory ?? guessCategory(name) };
  });
}
export function packingProgress(items: { is_packed: boolean }[]) {
  const done = items.filter((i) => i.is_packed).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}
