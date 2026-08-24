/**
 * The annotated example library. Each entry is a small lesson: what to
 * notice when you play the trace, or where the danger hides.
 */

export interface Example {
  title: string;
  pattern: string;
  flags?: string;
  input: string;
  note: string;
}

export const EXAMPLES: Example[] = [
  {
    title: 'alternation order matters',
    pattern: '(a|ab)(c|bcd)(d?)',
    input: 'abcd',
    note: 'JS regexes are leftmost-FIRST: watch branch (a) win and force (d?) to rescue the match.',
  },
  {
    title: 'greedy vs lazy',
    pattern: '".*?"',
    flags: '',
    input: '"ab" "cd"',
    note: 'Lazy .*? stops at the first closing quote — step through each backtrack-free expansion.',
  },
  {
    title: 'greedy overreach',
    pattern: '".*"', input: '"ab" "cd"',
    note: 'Same input as the lazy example: greedy .* swallows both quoted strings. Compare the traces.',
  },
  {
    title: 'empty-loop quirk',
    pattern: '(a*)*', input: 'aaa',
    note: 'Empty iterations are rejected once the minimum is met (ES RepeatMatcher). Watch the guard block them.',
  },
  {
    title: 'empty alternation loop',
    pattern: '(a|)*', input: 'aab',
    note: 'The empty branch loses every round; group 1 still ends up "a". Subtle capture semantics.',
  },
  {
    title: 'backreference',
    pattern: '(\\w+) \\1', input: 'hello hello world world',
    note: '\\1 replays the captured text — a memory transition, not expressible in a DFA.',
  },
  {
    title: 'duplicate word finder',
    pattern: '\\b(\\w+)\\s+\\1\\b', flags: 'g', input: 'this this is a a test',
    note: 'Classic proofreading trick. With /g, exec resumes past the previous match.',
  },
  {
    title: 'lookahead capture',
    pattern: '(?=(a+))a', input: 'aaaa',
    note: 'A positive lookahead shares its captures with the main match — see group 1 fill before the body runs.',
  },
  {
    title: 'variable-length lookbehind',
    pattern: '(?<=ab|abc)c', input: 'xxabcc',
    note: 'The engine scans backwards for any suffix ending at the position — variable length included.',
  },
  {
    title: 'email (pragmatic)',
    pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+', input: 'mail: ada@example.co.uk !',
    note: 'Good enough for logs, not for the spec. Hover the graph to see how little structure it really has.',
  },
  {
    title: 'URL (simplified)',
    pattern: 'https?://[\\w.-]+(?:/[\\w./?#&=-]*)?', input: 'see https://example.com/a/b?q=1 now',
    note: 'Optional groups chain into a long epsilon spine — perfect for watching priority order.',
  },
  {
    title: 'ISO date',
    pattern: '(\\d{4})-(\\d{2})-(\\d{2})', input: 'launch: 2026-08-24!',
    note: 'Bounded quantifiers unroll into explicit copies; named by position: year-month-day.',
  },
  {
    title: 'Persian mobile number',
    pattern: '(?:\\+98|0098|0)9\\d{9}\\b', input: 'call +989121234567 or 09121234567',
    note: 'Three prefixes feed one shared spine; \\b keeps longer digit runs from matching.',
  },
  {
    title: 'semver',
    pattern: '(\\d+)\\.(\\d+)\\.(\\d+)(?:-([\\w.]+))?(?:\\+[\\w.]+)?', input: 'v2.10.3-beta.1 next',
    note: 'Each component is its own capture; the pre-release tag is optional but anchored.',
  },
  {
    title: 'hex color',
    pattern: '#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b', flags: 'i', input: '#Fa3 and #Ff8800',
    note: 'Order matters: try 6 hex digits first, fall back to 3. Swap the branches and re-play.',
  },
  {
    title: 'IPv4 (loose)',
    pattern: '(\\d{1,3}\\.){3}\\d{1,3}', input: 'host 192.168.0.11 up',
    note: 'One quantified group builds the repeated prefix — the DFA view collapses it beautifully.',
  },
  {
    title: 'time of day',
    pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d', input: 'at 19:05, until 23:59, not 24:00',
    note: 'Character-class ranges encode arithmetic constraints without backtracking drama.',
  },
  {
    title: 'password policy',
    pattern: '(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])\\w{8,}', input: 'Secret12 passwort NOPE Nope1',
    note: 'Four lookaheads all inspect the same position before a single character is consumed.',
  },
  // deliberately catastrophic
  {
    title: 'catastrophic: nested plus',
    pattern: '^(a+)+$', input: 'aaaaaaaaaaaaaaaaaaaaaaaaaaab',
    note: 'THE classic. Every way to split the a-run between the two pluses gets tried. Hit prove-it.',
  },
  {
    title: 'catastrophic: overlapping branches',
    pattern: '^(a|aa)+$', input: 'aaaaaaaaaaaaaaaaaaaaaaaab',
    note: 'No nesting needed — ambiguous branches alone explode. Watch the step counter melt.',
  },
];
