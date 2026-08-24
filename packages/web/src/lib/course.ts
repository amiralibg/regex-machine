/**
 * The course. Five modules from formal-language foundations to ReDoS
 * engineering. Every lesson pairs theory with a hands-on exercise that loads
 * straight into the playground: learn, test, see how it works, same place.
 * Copy follows house writing rules: plain words, active voice, no filler.
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
    title: 'Foundations',
    blurb: 'Where regexes come from, what they can say, and how to read one aloud.',
    lessons: [
      {
        id: 'm1l1',
        title: 'A theory became a tool',
        objective: 'See regexes as a small language built from three moves: place things side by side, choose between them, repeat.',
        concepts: [
          'Stephen Kleene wrote these expressions down in 1951, decades before search boxes existed. They describe what mathematicians call regular languages: the simplest pattern class there is, the kind a machine can recognize while tracking nothing but its current state.',
          'Three operations do all the work. Put things next to each other: ab means a then b. Choose: a|b means either. Repeat: a* means any number of a, including none. Every feature you will meet later, classes, shortcuts, anchors, is shorthand for combinations of those three.',
          'Now the boundary that matters. A regex cannot count. It cannot validate HTML nested ten levels deep, because nesting needs memory, and this machine has none. When your problem starts demanding memory, you have outgrown regexes. Module 3 shows you exactly where that line sits.',
        ],
        exercise: {
          pattern: 'ca*t|dog',
          input: 'cta cat caaat dog',
          watch: 'Hover the graph. The star is a loop the playhead physically walks around, once or five times. The pipe gives the machine two parallel routes, and it always prefers the upper one.',
        },
        quiz: [
          {
            q: 'Which three operations form the core of every regex?',
            options: ['concatenation, alternation, repetition', 'groups, classes, anchors', 'greedy, lazy, possessive'],
            answer: 0,
          },
          {
            q: 'Why can no regex validate arbitrarily nested HTML?',
            options: ['It would take too long', 'Nesting needs counting, and counting needs memory beyond a state', 'HTML contains metacharacters'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm1l2',
        title: 'Literals, metacharacters, escaping',
        objective: 'Read any pattern aloud by knowing which characters are text and which are grammar.',
        concepts: [
          'A dozen characters act as grammar: . \\ | * + ? ( ) [ ] { } ^ $. Everything else matches itself. A backslash flips grammar back into text, so \\. matches one plain dot.',
          'Character classes follow their own rules. Inside square brackets, most punctuation loses its power: [.] matches a literal dot. Meanwhile ^ and - gain new meanings depending on position.',
          'Shorthand escapes name the common classes. \\d is a digit, \\w a letter-digit-underscore, \\s whitespace. Capitalize them to negate: \\D is any non-digit.',
        ],
        exercise: {
          pattern: '\\d+\\.\\d+|\\d',
          input: 'pi is 3.14 but round 3',
          watch: 'Two consume edges, two labels. Hover each one: the strip lights up only the exact characters that produced it. The escaped-dot edge consumes one plain dot and nothing else.',
        },
        quiz: [
          {
            q: 'What does a\\.c match?',
            options: ['abc, because . means any character', 'only the exact text a.c', 'any three-character string'],
            answer: 1,
          },
          {
            q: 'Inside [.] the dot is…',
            options: ['still a wildcard', 'a literal dot', 'a syntax error'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm1l3',
        title: 'Which flavor am I writing?',
        objective: 'Tell the regex dialects apart so JavaScript quirks stop surprising you.',
        concepts: [
          'There is no single regex standard in practice. Unix grep speaks POSIX. Perl spawned PCRE. JavaScript grew its own dialect. They disagree on syntax, and more importantly on strategy: many POSIX tools report the longest possible match, while JavaScript reports whatever its first working attempt found.',
          'That first-attempt-wins rule is called leftmost-first, and it turns alternation order into part of your logic. Write cat|cats and cats will never match past cat. Order matters.',
          'JavaScript also lacks a few PCRE features: no possessive quantifiers like a++, no atomic groups (?>…). It gained named groups and lookbehind over the years, but possessive mode still needs a workaround. Module 5 teaches the trick.',
        ],
        exercise: {
          pattern: '(a|ab)c',
          input: 'abc',
          watch: 'Step through this one instead of playing it. The machine commits to branch a, hits c, fails, rewinds, and retries with branch ab. Native JS runs the same dance invisibly. Here you watch it.',
        },
        quiz: [
          {
            q: 'POSIX grep and JavaScript receive the same pattern and input. They may disagree about…',
            options: ['whether anything matches at all', 'which substring wins (longest vs first attempt)', 'nothing, results are always identical'],
            answer: 1,
          },
          {
            q: 'Possessive quantifiers in JavaScript are…',
            options: ['built in since ES2018', 'absent, but emulatable with lookahead plus backreference', 'impossible to emulate'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm1l4',
        title: 'Anchors match positions, not characters',
        objective: 'Pin matches to places in the string using ^ $ and \\b without consuming anything.',
        concepts: [
          '^ and $ ask where you are: start or end of the string. They consume zero characters. Add the m flag and they reset at every newline.',
          '\\b marks the seam between a word character and anything else. In hi there there are four seams: before h, after i, before t, after e.',
          'In the graph, an anchor is a dotted amber edge. Step across it and watch the position marker hold still. That stillness is the entire concept.',
        ],
        exercise: {
          pattern: '^\\w+$',
          flags: 'm',
          input: 'first line\nsecond line\nthird',
          watch: 'Multiline mode: the assert edges pass again at each line start and end. Play it and count how far apart the position marker moves versus how many edges light up.',
        },
        quiz: [
          {
            q: 'How many characters does ^ consume?',
            options: ['one newline under the m flag', 'zero', 'all leading whitespace'],
            answer: 1,
          },
          {
            q: 'How many \\b boundaries does hi there contain?',
            options: ['two', 'three', 'four'],
            answer: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'm2',
    title: 'Groups, quantifiers, captures',
    blurb: 'Repetition, grouping, and remembering pieces of the match.',
    lessons: [
      {
        id: 'm2l1',
        title: 'Greedy takes more, lazy takes less',
        objective: 'Control which direction repetition explores first.',
        concepts: [
          'Greedy quantifiers (*, +, ?) grab everything they can, then hand characters back one at a time when the rest of the pattern complains. Each hand-back shows up as a rewind event in playback.',
          'Lazy quantifiers (*?, +?, ??) try stopping immediately and continue only when forced. Their lazy and greedy twins accept the same strings. The route differs, not the destination.',
          'The graphs look identical on purpose. The difference hides in edge priority inside the loop guard, and the playback exposes it as path preference.',
        ],
        exercise: {
          pattern: '".*"|".*?"',
          input: '"ab" "cd"',
          watch: 'Both branches run on the same input. Lazy halts at the first closing quote. Greedy swallows everything and rewinds twice. Compare the step counters at the end.',
        },
        quiz: [
          {
            q: '<.+> against <a><b> matches…',
            options: ['<a>', '<a><b>', '<b>'],
            answer: 1,
          },
          {
            q: 'Switching a quantifier from greedy to lazy changes…',
            options: ['the set of strings it can match', 'only the exploration order', 'both'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm2l2',
        title: 'Group numbering and participation',
        objective: 'Predict capture values from paren order alone, nesting included.',
        concepts: [
          'Numbering follows opening parentheses from left to right. Outer groups earn low numbers even when inner ones finish first. In ((a)|(b)) the wrapper is group 1, (a) is group 2, (b) is group 3.',
          'A group that never ran reports undefined. Match (x)|(y) against y and group 1 simply does not exist in the result. Participation is exclusive across alternatives.',
          'Quantified groups overwrite themselves every lap. (\\d\\d)+ walking over 1234 ends with group 1 holding 34, because the last lap wins.',
        ],
        exercise: {
          pattern: '((\\d\\d)|(ab))+',
          input: '12ab34',
          watch: 'Green capture edges fire open and close around every iteration. Group 2 ends holding ab, group 3 holds 34. Each lap replaced the previous value.',
        },
        quiz: [
          {
            q: 'In a((b)c)d, which group captures bc?',
            options: ['group 1', 'group 2', 'group 3'],
            answer: 1,
          },
          {
            q: '(x)+(y)? against y: group 1 is…',
            options: ['undefined, it never participated', 'an empty string', 'the letter y'],
            answer: 0,
          },
        ],
      },
      {
        id: 'm2l3',
        title: 'Groups without captures',
        objective: 'Use (?:…) for structure, and combine grouping with repetition safely.',
        concepts: [
          '(?:…) groups without keeping a result slot. Reach for it whenever you need grouping for its own sake: precedence or repeating a multi-character sequence.',
          'Quantifiers bind to exactly one preceding element. ab+ repeats only the b. To repeat the pair, group it: (?:ab)+.',
          'Named groups (?<year>\\d{4}) cost nothing extra and read better in code. Renumber-proof, self-documenting.',
        ],
        exercise: {
          pattern: '#(?<hex>[0-9a-f]{6}|[0-9a-f]{3})\\b',
          flags: 'i',
          input: '#Fa3 #Ff8800 #nope',
          watch: 'Alternation tries the six-digit branch first. Swap the two branches in the editor and replay: the machine re-routes and you see the preference flip.',
        },
        quiz: [
          {
            q: 'ab+ repeats…',
            options: ['the pair ab', 'only the b', 'nothing, it is invalid'],
            answer: 1,
          },
          {
            q: 'Prefer (?:…) over (…) for pure structure because it…',
            options: ['runs faster', 'keeps capture numbering clean', 'is required inside classes'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm2l4',
        title: 'Backreferences add memory',
        objective: 'Require repeated text with \\1 and understand why it breaks the DFA view.',
        concepts: [
          'A backreference replays captured TEXT, not the pattern. (\\w+) \\1 finds doubled words because whatever group 1 caught must appear again, character for character.',
          'This needs memory during the match, which finite automata lack by definition. The DFA toggle refuses such patterns, and that refusal is mathematics, not a missing feature in this app.',
          'One quirk to know: a reference to a group that never participated matches the empty string. So (a)|b\\1 happily matches plain b.',
        ],
        exercise: {
          pattern: '\\b(\\w+)\\s+\\1\\b',
          input: 'this this is a a bug bug fix',
          watch: 'Purple \\1 edges read the capture table live during execution. Then try the DFA toggle and read the refusal message. Now you know the precise reason behind it.',
        },
        quiz: [
          {
            q: '(ab|xy)\\1 against xyxy: \\1 must equal…',
            options: ['ab', 'xy', 'either one'],
            answer: 1,
          },
          {
            q: 'No finite automaton can implement backreferences because they require…',
            options: ['too much CPU', 'comparing against arbitrary runtime content, which is unbounded memory', 'nested loops'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'm3',
    title: 'Inside the engine',
    blurb: 'Open the hood: epsilon moves, choice points, and why loops terminate.',
    lessons: [
      {
        id: 'm3l1',
        title: 'Two engine philosophies',
        objective: 'Contrast backtracking engines with automata engines and know who uses which.',
        concepts: [
          'Backtracking engines walk one path at a time and jot down every fork so they can return and retry later. JavaScript, PCRE, Python, Java: all backtrackers. Expressive, flexible, and occasionally disastrous.',
          'Automata engines simulate every path simultaneously as a moving set of states. RE2 works this way. Linear time, guaranteed. Exponential blow-up, impossible. Backreferences, also impossible.',
          'Given the same pattern, the two families can legitimately return different answers, because running all paths at once makes greedy-vs-lazy ordering meaningless. Different machines, honestly different.',
        ],
        exercise: {
          pattern: '^(a|aa)+$',
          input: 'aaaaaaaaaaaaaab',
          watch: 'Our engine backtracks. Press play and watch the step counter sprint as every split of the a-run gets retried. An RE2-class engine would reject this input in a single linear sweep.',
        },
        quiz: [
          {
            q: 'RE2 sidesteps ReDoS by…',
            options: ['capping pattern length', 'simulating all paths at once, so there is nothing to backtrack', 'timing out aggressively'],
            answer: 1,
          },
          {
            q: 'Which feature forces a backtracking implementation?',
            options: ['anchors', 'backreferences', 'character classes'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm3l2',
        title: 'Reading the compiled machine',
        objective: 'Map every visual element of the graph back to the pattern text that built it.',
        concepts: [
          'Each construct compiles locally. A literal becomes one consume edge. Alternation fans out from a shared start in written order. A quantifier becomes a loop skeleton: enter, body, guard.',
          'Dashed gray edges are epsilon moves: transitions that consume nothing. They exist purely to wire things together, gluing sequences, routing branches, closing loops.',
          'After every loop body sits a ⟲ guard asking one question per lap: another round, or exit? Greedy and lazy differ only in which answer gets tried first.',
        ],
        exercise: {
          pattern: 'a*b',
          input: 'aaab',
          watch: 'Find the loop: entry edge, a-consume, guard, repeat. Trace three laps, then find the exit route that skips straight to b. Every edge you hover lights up its source characters in the strip.',
        },
        quiz: [
          {
            q: 'How do epsilon edges look in this app?',
            options: ['thick and red', 'thin dashed gray, unlabeled', 'double arrowheads'],
            answer: 1,
          },
          {
            q: 'Greedy versus lazy changes…',
            options: ['the graph structure', 'only the try-order at the loop guard', 'the number of states'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm3l3',
        title: 'Backtracking, watched closely',
        objective: 'Follow choice points, rewinds, and the restore-everything discipline.',
        concepts: [
          'At every fork the engine writes a note: state, position, captures, loop progress. That note is a choice point. On failure it grabs the newest note and resumes there. Depth-first search over match strategies.',
          'Rewinds restore everything: the position jumps backward and captures revert to their previous values. Nothing leaks from an abandoned attempt into the next one.',
          'The step counter adds forward steps and rewind pops. Treat it as an honest price tag for your pattern. Linear patterns tick gently. Pathological ones sprint.',
        ],
        exercise: {
          pattern: '(a|ab)x',
          input: 'abax',
          watch: 'Start position 0: branch a dies at x, a rewind restores position 1, branch ab succeeds and finds x. Orange rewind chips mark every restore. Follow them in order.',
        },
        quiz: [
          {
            q: 'Backtracking explores alternatives…',
            options: ['in parallel', 'depth-first, newest choice point first', 'oldest choice point first'],
            answer: 1,
          },
          {
            q: 'When the engine rewinds past a captureOpen, the capture…',
            options: ['stays set', 'reverts to its previous value', 'crashes the engine'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm3l4',
        title: 'Empty iterations and termination',
        objective: 'Learn the rule that keeps star loops from spinning forever.',
        concepts: [
          'If an iteration consumed nothing and the minimum count is already satisfied, JavaScript rejects that iteration and exits the loop. Without the rule, (a*)* would spin forever on an empty stretch of input.',
          'The rejected iteration takes its captures with it. Run /(a*)*/ against b and group 1 comes back undefined, not an empty string. This trips up almost everyone eventually.',
          'Iterations that DID consume behave differently: their captures survive when the loop exits. (a|)* over aaa finishes with group 1 holding a.',
        ],
        exercise: {
          pattern: '(a*)*b|(a|)*b',
          input: 'aaab',
          watch: 'Watch the ⟲ guard block empty iterations: the path dies silently, no rewind needed. Contrast with productive laps, which push exit choice points onto the stack.',
        },
        quiz: [
          {
            q: '/(a*)*/ against b reports group 1 as…',
            options: ['an empty string', 'undefined', 'b'],
            answer: 1,
          },
          {
            q: 'The empty-iteration rule exists to guarantee…',
            options: ['shorter matches', 'that loops terminate', 'leftmost-first order'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'm4',
    title: 'Automata theory & optimizations',
    blurb: 'Subset construction, the price of determinism, and its limits.',
    lessons: [
      {
        id: 'm4l1',
        title: 'From NFA to DFA',
        objective: 'Understand subset construction and what an epsilon-closure gathers.',
        concepts: [
          'Determinizing works on sets. Each DFA state represents a bundle of NFA states that could be active together, collected by chasing every epsilon edge from a starting point.',
          'After that, structure melts away. Capture edges, loop guards, priority routing: all gone. What remains are bare consume edges where every symbol leads to exactly one destination.',
          'No choices means nothing to remember and nothing to redo. Backtracking becomes structurally impossible, at any input size.',
        ],
        exercise: {
          pattern: 'a*b?c+',
          input: 'aaccc',
          watch: 'Toggle between views. Dashed epsilons and ⟲ guards vanish; every surviving edge consumes. Compare the state counts in both title bars.',
        },
        quiz: [
          {
            q: 'One DFA state corresponds to…',
            options: ['one NFA state', 'a set of simultaneously-possible NFA states', 'one pattern fragment'],
            answer: 1,
          },
          {
            q: 'An epsilon-closure collects…',
            options: ['states reachable without consuming input', 'all accepting states', 'states reachable by one symbol'],
            answer: 0,
          },
        ],
      },
      {
        id: 'm4l2',
        title: 'The 2ⁿ state explosion',
        objective: 'See why DFAs can grow exponentially and how real engines cope.',
        concepts: [
          'An NFA with n states can produce up to 2ⁿ distinct subsets, and each subset may become its own DFA state. The bound is genuine, though everyday patterns land nowhere near it.',
          'RE2 sidesteps the practical cost by building DFA states lazily, only for subsets that real inputs actually visit. The theoretical ceiling stays. The bill tracks your data, not the worst case.',
          'The trade, stated plainly: determinism buys speed and predictability, charges memory, and forbids features. Backtracking buys features, charges worst-case time.',
        ],
        exercise: {
          pattern: '(a|b)*abb',
          input: 'aababb',
          watch: 'Toggle to the DFA: a few tidy states encode the idea ends-in-abb. Extend the pattern suffix by two more letters and recount. Growth, but gentle growth.',
        },
        quiz: [
          {
            q: 'Worst-case DFA state count for an n-state NFA?',
            options: ['n squared', '2 to the n', 'n log n'],
            answer: 1,
          },
          {
            q: 'On-the-fly construction saves memory…',
            options: ['in the worst case', 'on real inputs, by building only visited subsets', 'it does not save memory, only startup time'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm4l3',
        title: 'What determinism cannot do',
        objective: 'Know precisely why captures-with-memory and lookaround sit outside the DFA story.',
        concepts: [
          'A DFA carries no memory except its current state. A backreference compares current input against earlier input, which demands arbitrary storage. Full stop.',
          'Lookaround is subtler. You can model it as nested sub-machines, and this app draws exactly that: a gate chip with its own clickable sub-NFA. But its verdict depends on runtime state, so the flat one-state-per-set abstraction stops being truthful.',
          'Working rule: if the pattern must remember variable content, the linear-time guarantee no longer covers it.',
        ],
        exercise: {
          pattern: '(?=\\w+)\\w\\b',
          input: 'word',
          watch: 'Click the orange gate chip. Its sub-machine opens below the main graph. Then try the DFA toggle and read the refusal. Now the refusal has a face.',
        },
        quiz: [
          {
            q: 'Which of these stays perfectly regular?',
            options: ['(a|b)*\\1', '(?=a)b', '[ab]*c'],
            answer: 2,
          },
          {
            q: 'This app renders lookaround as…',
            options: ['extra DFA columns', 'gate nodes with clickable sub-machine insets', 'a hard error'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'm5',
    title: 'Performance & ReDoS',
    blurb: 'Find the pathological shapes, prove them, defuse them.',
    lessons: [
      {
        id: 'm5l1',
        title: 'Anatomy of a ReDoS bomb',
        objective: 'Recognize the ingredients that turn a regex into a denial-of-service vector.',
        concepts: [
          'Three ingredients cook this bomb. A quantifier whose iterations overlap. A long run of input that feeds it. Eventual failure, usually one missing suffix, forcing the engine to try every possible carving of that run.',
          '(a+)+ is the textbook case. A run of n a-splits roughly 2ⁿ ways, and a failing suffix makes the engine walk all of them before giving up.',
          'The cruel detail: a successful match often finishes instantly on the greedy path. The bomb detonates only on failure, which is why these patterns ship quietly until someone submits hostile data.',
        ],
        exercise: {
          pattern: '^(a+)+$',
          input: 'aaaaaaaaaaaaaaaaaaaaab',
          watch: 'Press prove-it above. Steps double every few characters: on a log chart, a straight line IS exponential growth. Then delete one trailing b from the input and watch it finish instantly.',
        },
        quiz: [
          {
            q: 'Catastrophic backtracking needs…',
            options: ['a long input, an ambiguous quantified chunk, and eventual failure', 'nested character classes', 'the u flag'],
            answer: 0,
          },
          {
            q: '^(a+)+$ against aaaa (no failing suffix) performs…',
            options: ['equally catastrophically', 'instantly, the greedy path succeeds on the first try', 'linearly slow'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm5l2',
        title: 'Overlapping alternation bombs',
        objective: 'Spot ReDoS shapes that need no nesting at all.',
        concepts: [
          'You do not need nested quantifiers. (a|aa)+ explodes too: at every round, both branches accept the same next character, multiplying continuation paths. Ambiguity again, just wearing different clothes.',
          'Incidents hide this shape inside plausible validators: (\\w+\\.)*domain, (.*)*foo, or unions of overlapping token lists.',
          'Static analysis catches both canonical shapes before production. This app\u2019s warning banner names the culprit span. Treat it like a review comment from the compiler itself.',
        ],
        exercise: {
          pattern: '^(a|aa)+$',
          input: 'aaaaaaaaaaaaaaaaaaaaab',
          watch: 'Prove-it again: same wall, no nesting required. Now rewrite the pattern as ^(a+)$, which accepts the same strings, and watch the chart collapse to a handful of steps.',
        },
        quiz: [
          {
            q: '(a|aa)+ explodes because…',
            options: ['alternation is inherently slow', 'overlapping branches create multiple equal-cost continuations', '$ forces backtracking'],
            answer: 1,
          },
          {
            q: 'Which rewrite preserves the language here and kills the bomb?',
            options: ['(aa|a)+', 'a+', '(a|aa){1,2}+'],
            answer: 1,
          },
        ],
      },
      {
        id: 'm5l3',
        title: 'Defusing the bomb',
        objective: 'Apply real mitigations, including JavaScript\u2019s atomicity emulation trick.',
        concepts: [
          'Collapse redundancy first: (a+)+ is just a+. Anchor tightly with ^ $ \\b so failures surface early, before the expensive parts ever run. Make alternatives disjoint so the engine never chooses between twins.',
          'PCRE ships two escape hatches: atomic groups (?>…) and possessive quantifiers like a++. Both mean commit and never give characters back. JavaScript offers neither.',
          'Fake it anyway. (?=(a+))\\1 sends a lookahead to find the longest run once and capture it; the backreference replays that exact text with zero interior choices. Commitment, assembled from features JS does have. Production code relies on this trick today.',
        ],
        exercise: {
          pattern: '^(?=(a+))\\1b$',
          input: 'aaaaaaaaaab',
          watch: 'Run ^(a+)+b$ on the same input first and note the steps. Then load this one. Tens instead of millions. The lookahead committed to one split, and the backref enforced it.',
        },
        quiz: [
          {
            q: '(?>a+)b emulated in JavaScript is…',
            options: ['(?=a+)b', '(?=(a+))\u005c1b', '(a++)b'],
            answer: 1,
          },
          {
            q: 'Tight anchoring helps because…',
            options: ['matches become longer', 'failure surfaces early, before costly subexpressions run', 'anchors disable backtracking globally'],
            answer: 1,
          },
        ],
      },
    ],
  },
];
