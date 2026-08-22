import { tokenize } from '../src/tokenizer';
import { parse } from '../src/parser';

describe('tokenizer/parser', () => {
  it('parses a simple alternation with spans', () => {
    const { root } = parse('a|bc');
    expect(root.type).toBe('alternation');
  });

  it('assigns group indices in open order and records names', () => {
    const r = parse('(?<x>a)(b)(?<y>c)');
    expect(r.groupCount).toBe(3);
    expect(r.names.get('x')).toBe(1);
    expect(r.names.get('y')).toBe(3);
  });

  it('rejects duplicate names', () => {
    expect(() => parse('(?<n>a)(?<n>b)')).toThrow(/Duplicate capture group name/);
  });

  it('rejects bad backrefs', () => {
    expect(() => parse('\\2(a)')).toThrow(/nonexistent group/);
    expect(() => parse('\\k<z>(a)')).toThrow(/undefined group name/);
  });

  it('rejects double quantifiers like native', () => {
    expect(() => parse('a**')).toThrow(/Nothing to repeat/);
  });

  it('rejects unterminated group', () => {
    expect(() => parse('(ab')).toThrow();
  });

  it('rejects trailing lone backslash', () => {
    expect(() => parse('a\\')).toThrow();
  });
});
