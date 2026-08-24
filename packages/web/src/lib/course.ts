/**
 * The course: five modules from formal-language foundations to ReDoS
 * engineering. Every lesson pairs theory with a hands-on exercise that loads
 * directly into the playground — learn, test, and see how it works in one
 * place. Concepts are kept accurate to ECMAScript regex semantics, since the
 * engine implements exactly those.
 */

export interface QuizQuestion {
  q: string;
  options: string[];
  /** index of the correct option */
  answer: number;
}

export interface Exercise {
  pattern: string;
  flags?: string;
  input: string;
  /** what to watch in the machine */
  watch: string;
}

export interface Lesson {
  id: string;
  title: string;
  objective: string;
  concepts: string[];
  exercise?: Exercise;
  quiz: QuizQuestion[];
}

export interface CourseModule {
  id: string;
  title: string;
  blurb: string;
  lessons: Lesson[];
}

export const COURSE: CourseModule[] = [
  {
    id: 'm1',
    title: 'Foundations & Syntax',
    blurb: 'Where regexes come from, what they can express, and how to read one.',
    lessons: [
      {
        id: 'm1l1',
        title: 'A theory became a tool',
        objective: 'Understand regular expressions as a formal language: concatenation, alternation, repetition.',
        concepts: [
          'Stephen Kleene defined "regular expressions" in 1951 to describe neural nets; they describe REGULAR LANGUAGES — the simplest class in the Chomsky hierarchy. Anything a regex matches can also be matched by a finite machine with no memory beyond its current state.',
          'The three operations: concatenation (ab = a then b), alternation (a|b = either), and the Kleene star (a* = zero or more). Everything else — classes, shortcuts like \\d, anchors — is sugar over these three.',
          'Regular ≠ context-free: HTML/XML nesting needs counting, so NO regex can parse it. When your pattern needs to "remember" arbitrary text, you have left regex territory (see Module 3).',
        ],
        exercise: {
          pattern: 'ca*t|dog',
          input: 'cta cat caaat dog',
          watch: 'Hover the graph: the star becomes a loop the playhead can traverse any number of times. Alternation gives two parallel routes through the machine.',
        },
        quiz: [
          {
            q: 'Which three operations form the formal core of every regex?',
            options: ['concatenation, alternation, Kleene star', 'groups, classes, anchors', 'greedy, lazy, possessive', 'NFA, DFA, GNFA'],
            answer: 0,
          },
          {
            q: 'Why can\'t any regex validate arbitrarily-nested HTML tags?',
            options: ['Regexes are too slow', 'HTML uses metacharacters', 'Nesting requires unbounded memory/counting — beyond regular languages', 'It can, with enough backtracking'],
            answer: 2,
          },
        ],
      },
      {
        id: 'm1l2',
        title: 'Anatomy: literals, metacharacters, escaping',
        objective: 'Read any pattern fluently by separating literal characters from operators.',
        concepts: [
          'Metacharacters are the grammar: . \\ | * + ? ( ) [ ] { } ^ $. Everything else is literal text. A metacharacter escaped with a backslash (\\.) means the literal character.',
          'Inside character classes the rules change: most metacharacters become literal ([.] is a dot), while ^ and - gain new powers (negation, ranges).',
          'Shorthand escapes are just classes: \\d ≡ [0-9], \\w ≡ [A-Za-z0-9_], \\s = whitespace. Negated forms \\D \\W \\S invert them.',
        ],
        exercise: {
          pattern: '\\d+\\.\\d+|\\d',
          input: 'pi is 3.14 but round 3',
          watch: 'Two consume edges carry different labels — hover each edge to see which pattern text built it. The \\. edge consumes ONLY the dot.',
        },
        quiz: [
          {
            q: 'What does the pattern a\\.c match?',
            options: ['"abc" — . means any char', '"a.c" — the dot is escaped and literal', 'any string starting with a'],
            answer: 1,
          },
          {
            q: 'Inside [.] the dot is…',
            options: ['still a wildcard', 'a literal dot', 'an error'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm1l3',
        title: 'Dialects: POSIX, PCRE, JavaScript',
        objective: 'Know which flavor you are writing and where JavaScript differs.',
        concepts: [
          'POSIX BRE/ERE (grep, awk) and PCRE (Perl-compatible) differ in syntax AND engine strategy: many POSIX tools simulate automata and always return the LONGEST match; Perl-style engines backtrack and return the LEFTMOST-FIRST alternative that works.',
          'JavaScript is leftmost-first like PCRE but lacks several PCRE features: no possessive quantifiers (*+, ++) or atomic groups (?>…) natively — though lookahead tricks emulate them (Module 5). Modern JS added named groups, lookbehind, and the /d flag.',
          'This app implements exactly the ECMAScript semantics — including leftmost-first alternation order. If native RegExp disagrees with intuition, the machine will show you WHY it is right.',
        ],
        exercise: {
          pattern: '(a|ab)c',
          input: 'abc',
          watch: 'Native JS matches "abc"? Step the trace: branch (a) wins first, then c fails at pos 1, the engine BACKTRACKS into (ab). Order sensitivity made visible.',
        },
        quiz: [
          {
            q: 'A POSIX automata-based grep and JavaScript get the same pattern and input. They may disagree about…',
            options: ['whether anything matches', 'which substring matches (longest vs first)', 'neither — results are identical'],
            answer: 1,
          },
          {
            q: 'Possessive quantifiers (++ ) in JavaScript are…',
            options: ['built in since ES2018', 'not built in, but emulatable with lookahead + backreference', 'impossible to emulate'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm1l4',
        title: 'Anchors and word boundaries',
        objective: 'Use ^ $ and \\b to pin matches to positions without consuming characters.',
        concepts: [
          'Anchors are zero-width assertions: they test POSITION, never consume. ^ = start of line/string, $ = end. With the m flag they re-arm at every newline.',
          '\\b is a word boundary: the spot where one side is a word character (\\w) and the other is not. \\B is anywhere else.',
          'In the machine, an anchor is a dotted amber edge the playhead must pass WITHOUT moving the position marker. Watch it stay still.',
        ],
        exercise: {
          pattern: '^\\w+\\b$',
          flags: 'm',
          input: 'first line\nsecond line\nthird',
          watch: 'Multiline anchors: the assert edges pass again at each line start/end. The playhead crosses them without advancing.',
        },
        quiz: [
          {
            q: 'How many characters does the ^ anchor consume?',
            options: ['one newline with /m', 'zero', 'all leading whitespace'],
            answer: 1,
          },
          {
            q: 'In "hi there", how many \\b boundaries exist?',
            options: ['2', '3', '4'],
            answer: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'm2',
    title: 'Groups, Quantifiers, Captures',
    blurb: 'Repetition mechanics, grouping, and remembering substrings.',
    lessons: [
      {
        id: 'm2l1',
        title: 'Greedy vs lazy quantifiers',
        objective: 'Control repetition direction: greedy takes more, lazy takes less.',
        concepts: [
          'Greedy (*, +, ?, {n,m}) consumes as much as possible FIRST, then gives characters back when the rest of the pattern fails — each give-back is a visible backtrack event.',
          'Lazy (*?, +?, ??) prefers LESS: it tries the exit immediately and only iterates when forced. Same language, opposite exploration order.',
          'Priority lives in the machine: greedy loops try another iteration before exiting; lazy loops register the exit first. The graph edges are identical — the TRY ORDER differs.',
        ],
        exercise: {
          pattern: '".*?"|".*"',
          input: '"ab" "cd"',
          watch: 'Run both branches on the same input. Lazy stops at the first quote; greedy swallows everything then rewinds quote by quote. Compare step counters.',
        },
        quiz: [
          {
            q: '<.+> against <a><b> matches…',
            options: ['<a>', '<a><b>', '<b>'],
            answer: 1,
          },
          {
            q: 'Lazy quantifiers change…',
            options: ['the language (what CAN match)', 'only the order alternatives are tried', 'both'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm2l2',
        title: 'Capture groups and numbering',
        objective: 'Master group numbering by opening-paren order, nesting included.',
        concepts: [
          'Groups are numbered by their OPENING parenthesis order — outer first, even if inner ones close earlier. ((a)|(b)): group 1 wraps both, group 2=(a), group 3=(b).',
          'A group that did not participate reports undefined: (x)|(y) matching "y" leaves group 1 unset. Alternations make participation exclusive.',
          'Every iteration of a quantified group OVERWRITES its capture: (\\d\\d)+ against "1234" ends with group 1 = "34". Watch captureOpen/captureClose events fire per iteration.',
        ],
        exercise: {
          pattern: '((\\d\\d)|(ab))+',
          input: '12ab34',
          watch: 'Green capture edges fire open/close around each iteration. Group values overwrite: final group 2 = "ab", group 3 = "34".',
        },
        quiz: [
          {
            q: 'In (a((b)c)d) which group captures "bc"?',
            options: ['group 1', 'group 2', 'group 3'],
            answer: 1,
          },
          {
            q: '(x)+(y)? against "y": group 1 is…',
            options: ['undefined (never participated)', '"" (empty)', '"y"'],
            answer: 0,
          },
        ],
      },
      {
        id: 'm2l3',
        title: 'Non-capturing groups & practical grouping',
        objective: 'Group without capturing, and combine groups with quantifiers safely.',
        concepts: [
          '(?:…) groups for structure only — no capture slot, no memory cost. Use it whenever you need precedence, e.g. (?:ab)+ instead of ab+.',
          'Quantifiers bind to the IMMEDIATELY preceding element: ab+ repeats only b. To repeat both: (?:ab)+.',
          'Named groups (?<name>…) document intent and survive pattern edits: (?<year>\\d{4})-(?<month>\\d{2}).',
        ],
        exercise: {
          pattern: '#(?<hex>[0-9a-f]{6}|[0-9a-f]{3})\\b',
          flags: 'i',
          input: '#Fa3 #Ff8800 #nope',
          watch: 'Alternation tries the 6-digit route first — swap branches in the pattern and watch the trace change strategy.',
        },
        quiz: [
          {
            q: 'ab+ repeats…',
            options: ['ab once plus more bs', 'ab repeated', 'just b'],
            answer: 2,
          },
          {
            q: 'Why prefer (?:…) over (…) for pure structure?',
            options: ['it is faster to type', 'avoids polluting capture numbering', 'it is required inside classes'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm2l4',
        title: 'Backreferences: memory in the machine',
        objective: 'Use \\1 \\k<name> to require repetition of captured text.',
        concepts: [
          'A backreference matches THE SAME TEXT the group captured, not the same pattern: (\\w+) \\1 demands a repeated word.',
          'Backreferences break regularity: the machine must consult runtime capture contents, so no finite DFA exists. That is exactly why the DFA toggle disables for these patterns.',
          'A reference to a non-participating group matches the empty string in JavaScript — (a)|b\\1 matches plain "b".',
        ],
        exercise: {
          pattern: '\\b(\\w+)\\s+\\1\\b',
          input: 'this this is a a bug bug fix',
          watch: 'Purple \\1 edges read the capture table live during execution. Try the DFA toggle: refused, with an explanation.',
        },
        quiz: [
          {
            q: '(ab|xy)\\1 against "xyxy" — \\1 must equal…',
            options: ['"ab"', '"xy"', 'either'],
            answer: 1,
          },
          {
            q: 'Why does the DFA toggle disable for (a)\\1?',
            options: ['DFAs are too slow here', 'backreference equivalence needs infinite states', 'it does not — only lookarounds disable it'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'm3',
    title: 'Inside the Engine',
    blurb: 'Backtracking machines, epsilon moves, and how matching really executes.',
    lessons: [
      {
        id: 'm3l1',
        title: 'Two engine philosophies',
        objective: 'Contrast backtracking engines (JS, PCRE, Python) with automata engines (RE2, awk).',
        concepts: [
          'Backtracking engines explore ONE path at a time, remembering choice points to retry — flexible (captures, backrefs) but worst-case exponential.',
          'Automata engines simulate ALL paths simultaneously via state sets — guaranteed O(mn), no exponential blow-up, but no backreferences and traditionally no lazy/greedy distinction (they return longest-leftmost).',
          'Same pattern, same input, possibly different ANSWERS between paradigms — not because one is broken, but because they implement different formal machines.',
        ],
        exercise: {
          pattern: '^(a|aa)+$',
          input: 'aaaaaaaaaaaaaab',
          watch: 'Our engine is a backtracker: hit play and watch the step counter explode as every split of the a-run is retried. An RE2-class engine would reject in linear time.',
        },
        quiz: [
          {
            q: 'RE2 avoids ReDoS by…',
            options: ['limiting pattern size', 'simulating all NFA paths at once — no backtracking', 'running on multiple threads'],
            answer: 1,
          },
          {
            q: 'Which feature FORCES a backtracking implementation?',
            options: ['anchors', 'backreferences', 'character classes'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm3l2',
        title: 'Thompson\u2019s construction: reading the machine',
        objective: 'See how a pattern compiles into NFA fragments joined by epsilon moves.',
        concepts: [
          'Each construct compiles locally: literals become single consume edges; alternation becomes one start fanning out in declaration order; quantifiers become a loop skeleton — enter, body, guard.',
          'Epsilon (ε, dashed gray) edges move without consuming input. They encode structure: sequence glue, alternation routing, loop entry/exit.',
          'The ⟲ guard edge after each loop body decides: another iteration (greedy first) or exit. Hover any edge to light up the exact pattern text that created it.',
        ],
        exercise: {
          pattern: 'a*b',
          input: 'aaab',
          watch: 'Identify the loop skeleton: entry ⟲ edges cycle through the a-consume; the exit route skips straight toward b. Trace one full lap then the exit.',
        },
        quiz: [
          {
            q: 'What distinguishes an epsilon edge visually?',
            options: ['solid thick red', 'thin dashed gray, unlabeled', 'double arrowhead'],
            answer: 1,
          },
          {
            q: 'Greedy vs lazy changes which edge the guard TRIES FIRST:',
            options: ['true', 'false — the graph differs too'],
            answer: 0,
          },
        ],
      },
      {
        id: 'm3l3',
        title: 'Backtracking, step by step',
        objective: 'Follow choice points, rewinds, and the LIFO discipline explicitly.',
        concepts: [
          'At every fork the engine pushes a CHOICE POINT: (state, position, memory snapshot). Failure pops the newest one and resumes there — depth-first search over all match strategies.',
          'Rewind events restore position AND internal state (captures, loop progress) exactly. Nothing leaks between attempts — watch captures revert when the playhead jumps backward.',
          'The step counter counts forward steps + rewind pops. It is your complexity meter: linear patterns tick proportionally to input; pathological ones explode.',
        ],
        exercise: {
          pattern: '(a|ab)x',
          input: 'abax',
          watch: 'Start at s=0: branch a dies at x, rewind restores pos 1, branch ab succeeds. Then the search restarts at s=1 and finds nothing until… follow every rewind chip in orange.',
        },
        quiz: [
          {
            q: 'Backtracking explores alternatives in which order?',
            options: ['breadth-first', 'depth-first, newest choice point first', 'random'],
            answer: 1,
          },
          {
            q: 'When the engine rewinds past a captureOpen…',
            options: ['the capture stays set', 'the capture reverts to its previous value', 'the whole match aborts'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm3l4',
        title: 'Empty matches & the RepeatMatcher rule',
        objective: 'Learn the subtle rule that keeps star loops terminating.',
        concepts: [
          'If an iteration matches EMPTY and the minimum count is already met, JavaScript rejects that iteration and exits the loop — otherwise (a*)* could spin forever.',
          'Rejected empty iterations roll BACK their captures: (a*)* against "" leaves group 1 undefined, not "".',
          'But productive iterations keep their captures when the loop exits: (a|)* on "aaa" ends with group 1 = "a".',
        ],
        exercise: {
          pattern: '(a*)*b|(a|)*b',
          input: 'aaab',
          watch: 'Watch the ⟲ guard BLOCK empty iterations (path silently dies, no rewind needed) versus productive iterations pushing alt-exit choice points.',
        },
        quiz: [
          {
            q: '/(a*)*/.exec("b") gives group 1 as…',
            options: ['""', 'undefined', '"b"'],
            answer: 1,
          },
          {
            q: 'The empty-iteration rule exists to guarantee…',
            options: ['shorter matches', 'loop termination', 'leftmost-first order'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'm4',
    title: 'Automata Theory & Optimizations',
    blurb: 'Subset construction, epsilon closures, and the power of determinism.',
    lessons: [
      {
        id: 'm4l1',
        title: 'From NFA to DFA',
        objective: 'Understand subset construction and epsilon-closure.',
        concepts: [
          'Determinize: each DFA state is a SET of NFA states reachable together via epsilon moves (the epsilon-closure). One consumed symbol moves the whole set at once.',
          'All structural noise collapses: capture edges, loop guards, priority epsilons vanish — the DFA is bare consume edges. Toggle NFA/DFA and compare for the same pattern.',
          'Acceptance = current set containing an accepting NFA state. No choices means NO backtracking — ever.',
        ],
        exercise: {
          pattern: 'a*b?c+',
          input: 'aaccc',
          watch: 'Toggle views: dashed epsilons and ⟲ guards disappear; every remaining edge consumes. Count states in each title bar.',
        },
        quiz: [
          {
            q: 'One DFA state corresponds to…',
            options: ['one NFA state', 'a set of NFA states', 'one pattern fragment'],
            answer: 1,
          },
          {
            q: 'An epsilon-closure includes…',
            options: ['states reachable without consuming input', 'all accept states', 'states reachable by one symbol'],
            answer: 0,
          },
        ],
      },
      {
        id: 'm4l2',
        title: 'The 2ⁿ blow-up — and lazy caching',
        objective: 'See why DFAs can be exponentially larger, and how real engines cope.',
        concepts: [
          'n NFA states ⇒ up to 2ⁿ distinct subsets ⇒ a DFA with exponentially many states. Patterns like (a|b)*a(a|b)(a|b)…(suffix matching) approach the bound.',
          'Production engines (RE2) build DFA states ON THE FLY, caching only subsets actually visited on real inputs — the theoretical bound stays, the practical cost tracks your data.',
          'Trade-off summary: DFA = fast, deterministic, memory-hungry, feature-poor. NFA/backtracking = expressive, slower, vulnerable to pathological inputs.',
        ],
        exercise: {
          pattern: '(a|b)*abb',
          input: 'aababb',
          watch: 'Toggle to DFA: a handful of sets encode "ends in abb". Add two more trailing letters to the PATTERN suffix and recount — the DFA grows, the idea does not.',
        },
        quiz: [
          {
            q: 'Worst-case DFA states for an n-state NFA?',
            options: ['n²', '2ⁿ', 'n·log n'],
            answer: 1,
          },
          {
            q: 'On-the-fly DFA construction saves…',
            options: ['worst-case memory', 'memory on actual inputs by building only visited subsets', 'nothing, it is purely a speed trick'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm4l3',
        title: 'What determinism cannot express',
        objective: 'Solidify why captures-with-memory and lookaround break the DFA story.',
        concepts: [
          'DFAs have no auxiliary memory: they cannot compare "this text equals that earlier text" (backreferences) or ask questions mid-match (lookaround) without extra machinery.',
          'Lookaround COULD be modeled as nested sub-machines — this app renders gates with clickable sub-NFA insets — but the verdict depends on runtime state, so the flat DFA abstraction no longer holds.',
          'Rule of thumb: if your pattern needs to remember variable content, you have left the land where automata theory guarantees linear time.',
        ],
        exercise: {
          pattern: '(?=\\w+)\\w\\b',
          input: 'word',
          watch: 'Click the orange gate chip: its sub-machine opens below. Then imagine determinizing THAT — the toggle refuses, and now you know precisely why.',
        },
        quiz: [
          {
            q: 'Which is still perfectly regular?',
            options: ['(a|b)*\\1', '(?=a)b', '[ab]*c'],
            answer: 2,
          },
          {
            q: 'This app represents lookaround as…',
            options: ['extra DFA columns', 'annotated gate nodes with sub-machine insets', 'it refuses to display them'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'm5',
    title: 'Performance Engineering & ReDoS',
    blurb: 'Diagnose catastrophic backtracking and defuse it.',
    lessons: [
      {
        id: 'm5l1',
        title: 'Catastrophic backtracking anatomy',
        objective: 'Recognize the shapes that make engines grind: ambiguity under repetition.',
        concepts: [
          'Danger appears when ONE stretch of input can be carved up by a quantifier in MANY ways: (a+)+ lets every composition of the a-run be tried separately — 2ⁿ splits for n characters.',
          'The trigger is AMBIGUITY + FAILURE: the pattern must eventually fail after consuming the run (usually a missing suffix like b or $), forcing exhaustive re-splits. Successful matches often finish quickly on the first path!',
          'Nested unbounded quantifiers and overlapping alternation branches (a|aa) are the two canonical smells. This app\u2019s ⚠ banner flags both statically — with spans pointing at the culprit.',
        ],
        exercise: {
          pattern: '^(a+)+$',
          input: 'aaaaaaaaaaaaaaaaaaaaab',
          watch: 'Press prove-it: steps double with every few characters — a straight line on the log chart IS exponential growth. Now delete one a from the input: instant match.',
        },
        quiz: [
          {
            q: 'Catastrophic backtracking requires…',
            options: ['long input + ambiguous quantified subexpression + eventual failure', 'nested character classes', 'the u flag'],
            answer: 0,
          },
          {
            q: '^(a+)+$ vs "aaaaaaaa" (no b): performance is…',
            options: ['also catastrophic — failure anywhere triggers it', 'instant: first greedy path succeeds', 'linear'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm5l2',
        title: 'Overlapping alternation bombs',
        objective: 'Spot ReDoS without any nesting at all.',
        concepts: [
          '(a|aa)+ is equally explosive: at each iteration both branches accept the same next character, multiplying continuation paths — ambiguity again, no nesting required.',
          'Real-world variants hide in data-validation patterns: (\\w+\\.)*domain, (.*)*foo, ([a-z0-9]+|[a-z]+)+ …',
          'Static analysis catches these BEFORE production. Read the finding\u2019s span, understand WHICH subexpression is ambiguous, then restructure.',
        ],
        exercise: {
          pattern: '^(a|aa)+$',
          input: 'aaaaaaaaaaaaaaaaaaaaab',
          watch: 'Prove-it again — same wall. Then rewrite as ^(a+)$ (equivalent language here!) and watch the chart flatten to a handful of steps.',
        },
        quiz: [
          {
            q: '(a|aa)+ explodes because…',
            options: ['alternation is slow', 'branches overlap, creating multiple equal-cost continuations', 'the $ forces backtracking'],
            answer: 1,
          },
          {
            q: 'Which rewrite keeps the language but kills the bomb?',
            options: ['(a|aa){1,2}+', 'a+', '(aa|a)+'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm5l3',
        title: 'Defusing: anchoring, collapsing, atomizing',
        objective: 'Apply concrete mitigations — including the JS lookahead emulation trick.',
        concepts: [
          'Collapse redundancy: (a+)+ → a+. Anchor tightly (^…$ or \\b) so failures happen EARLY, before the engine wanders. Make alternatives disjoint ([ab]|cd, never (a|ab) where avoidable).',
          'PCRE has atomic groups (?>…) and possessive quantifiers (++): they discard choice points — commit and never give back. JavaScript lacks both natively.',
          'JS emulation: (?=(a+))\u005c1 — the lookahead runs a+ ONCE capturing the longest run; the backreference replays it verbatim with ZERO interior choice points. Atomicity via lookahead + backref.',
        ],
        exercise: {
          pattern: '^(?=(a+))\\1b$',
          input: 'aaaaaaaaaab',
          watch: 'Compare with ^(a+)+b$ on the same input: the atomic-emulated version never re-splits the run. Step counter: tens, not millions. That is possession, emulated.',
        },
        quiz: [
          {
            q: '(?>a+)b emulated in JS is…',
            options: ['(?=a+)b', '(?=(a+))\u005c1b', '(a++)b'],
            answer: 1,
          },
          {
            q: 'Tight anchoring helps because…',
            options: ['it makes matches longer', 'failures surface before expensive subexpressions run', 'anchors disable backtracking globally'],
            answer: 1,
          },
        ],
      },
    ],
  },
];
