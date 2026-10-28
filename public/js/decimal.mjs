// Deterministische Dezimalarithmetik auf BigInt-Basis.
// Geldwerte werden nie als Number/Float gerechnet. Ein Dec ist unveränderlich:
// Wert = unscaled / 10^scale.

const DEC_RE = /^([+-]?)(\d+)(?:[.,](\d+))?$/;

function roundDiv(n, d, mode) {
  if (d === 0n) throw new RangeError('Division durch null');
  if (d < 0n) { n = -n; d = -d; }
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  const neg = n < 0n;
  switch (mode) {
    case 'floor': return neg ? q - 1n : q;
    case 'ceil': return neg ? q : q + 1n;
    case 'half-up': { // kaufmännisch: ab genau 0,5 weg von null
      const twice = (r < 0n ? -r : r) * 2n;
      if (twice >= d) return neg ? q - 1n : q + 1n;
      return q;
    }
    default: throw new RangeError(`Unbekannter Rundungsmodus: ${mode}`);
  }
}

export class Dec {
  constructor(unscaled, scale = 0) {
    if (typeof unscaled !== 'bigint' || !Number.isInteger(scale) || scale < 0) {
      throw new TypeError('Dec: ungültige Argumente');
    }
    this.u = unscaled;
    this.s = scale;
    Object.freeze(this);
  }

  /** Strikte Eingabe: "12", "12.50", "12,5", "-3". Keine Tausendertrenner, kein Exponent. */
  static parse(input) {
    if (input instanceof Dec) return input;
    let str;
    if (typeof input === 'bigint') return new Dec(input, 0);
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new RangeError('Keine gültige Dezimalzahl');
      str = String(input);
    } else if (typeof input === 'string') {
      str = input.trim();
    } else {
      throw new TypeError('Keine gültige Dezimalzahl');
    }
    const m = DEC_RE.exec(str);
    if (!m) throw new RangeError(`Keine gültige Dezimalzahl: "${str}"`);
    const frac = m[3] ?? '';
    const u = BigInt(m[2] + frac) * (m[1] === '-' ? -1n : 1n);
    return new Dec(u, frac.length);
  }

  static tryParse(input) {
    try { return Dec.parse(input); } catch { return null; }
  }

  #at(scale) { return this.u * 10n ** BigInt(scale - this.s); }

  add(o) { o = Dec.parse(o); const s = Math.max(this.s, o.s); return new Dec(this.#at(s) + o.#at(s), s); }
  sub(o) { o = Dec.parse(o); const s = Math.max(this.s, o.s); return new Dec(this.#at(s) - o.#at(s), s); }
  mul(o) { o = Dec.parse(o); return new Dec(this.u * o.u, this.s + o.s); }
  neg() { return new Dec(-this.u, this.s); }

  /** Division mit ausdrücklicher Nachkommastellenzahl und Rundungsmodus. */
  div(o, scale, mode = 'half-up') {
    o = Dec.parse(o);
    if (o.u === 0n) throw new RangeError('Division durch null');
    const n = this.u * 10n ** BigInt(o.s + scale);
    const d = o.u * 10n ** BigInt(this.s);
    return new Dec(roundDiv(n, d, mode), scale);
  }

  /** Prozentwert → Faktor (19 → 0.19), exakt durch Kommaverschiebung. */
  pct() { return new Dec(this.u, this.s + 2); }

  round(scale, mode = 'half-up') {
    if (scale >= this.s) return new Dec(this.#at(scale), scale);
    return new Dec(roundDiv(this.u, 10n ** BigInt(this.s - scale), mode), scale);
  }

  cmp(o) { o = Dec.parse(o); const s = Math.max(this.s, o.s); const a = this.#at(s), b = o.#at(s); return a < b ? -1 : a > b ? 1 : 0; }
  eq(o) { return this.cmp(o) === 0; }
  lt(o) { return this.cmp(o) < 0; }
  lte(o) { return this.cmp(o) <= 0; }
  gt(o) { return this.cmp(o) > 0; }
  gte(o) { return this.cmp(o) >= 0; }
  isZero() { return this.u === 0n; }
  isNeg() { return this.u < 0n; }

  toString() {
    const neg = this.u < 0n;
    const digits = (neg ? -this.u : this.u).toString().padStart(this.s + 1, '0');
    const int = digits.slice(0, digits.length - this.s);
    const frac = digits.slice(digits.length - this.s);
    return (neg ? '-' : '') + int + (this.s ? '.' + frac : '');
  }

  toFixed(scale, mode = 'half-up') { return this.round(scale, mode).toString(); }
}

export const ZERO = new Dec(0n, 0);
export const ONE = new Dec(1n, 0);

/** "1234.5" → "1.234,50 €" (nur Zeichenketten, keine Float-Umwandlung). */
export function formatMoney(value, currency = 'EUR') {
  const d = Dec.tryParse(value);
  if (!d) return '–';
  const [int, frac] = d.round(2).toString().split('.');
  const neg = int.startsWith('-');
  const grouped = (neg ? int.slice(1) : int).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sym = currency === 'EUR' ? '€' : currency;
  return `${neg ? '-' : ''}${grouped},${frac} ${sym}`;
}

/** "19.0" → "19,0 %" */
export function formatPercent(value, scale = 2) {
  const d = Dec.tryParse(value);
  if (!d) return '–';
  return d.round(scale).toString().replace('.', ',') + ' %';
}
