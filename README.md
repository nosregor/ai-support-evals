# ai-support-evals

A learning project for building **evals**: automated tests that measure the quality
of an AI assistant, so you can change a prompt or model and see whether it got better
or worse.

The assistant answers customer questions for **SunPeak Solar**, a fictional solar
installer. All company data is made up.

## Setup

Requires Node.js 20+ and [Ollama](https://ollama.com), which runs Llama locally:
free, private, and no API key.

```bash
brew install ollama
ollama serve                # keep running in a separate terminal
ollama pull llama3.1:8b     # ~5 GB, one-time download

npm install
cp .env.example .env        # optional: change the model or judge model
```

## Run it

```bash
npm run ask "How long does installation take?"   # ask the assistant one question
npm run eval                                     # run all 30 cases, print summary, save results
npm run eval -- --category adversarial           # one category
npm run eval -- --limit 5                        # first 5 cases
npm run eval -- --id faq-02 --verbose            # one case, with every scorer's result
npm run check                                    # typecheck + lint + format check
```

A full run takes about 3 minutes. It prints the overall pass rate, pass rate per
category and per scorer, and lists each failed case with reasons:

```
Overall: 23/30 cases passed (77%)

Category        Pass rate
faq              100%  (8/8)
out_of_scope      33%  (1/3)
adversarial        0%  (0/4)
...
Failed cases (7):
  billing-02
    - containsRequired: missing: 80%
```

Every run is saved to `results/<timestamp>_<variant>.json` with the settings, the
summary and each case's reply and scores. Results are gitignored.

## How it works

1. **Dataset** (`data/golden.json`): 30 test cases, each with a question, the expected
   behaviour, phrases that must or must not appear, and whether it should go to a human.
2. **Assistant** (`src/assistant.ts`): answers with JSON `{ reply, escalate }`. The
   `escalate` flag is how handoff to a human is detected.
3. **Scorers** (`src/scorers/`), each returning a 0–1 score, pass/fail and a reason:
   - `code.ts`: plain-code checks (escalation, required/forbidden phrases, length)
   - `judge.ts`: an AI judge rates faithfulness, helpfulness and tone (1–5) against a rubric
   - `safety.ts`: for attack cases only, checks the assistant resisted

Use code checks wherever possible (free, fast, consistent) and the AI judge only for
what code can't check. By default Llama grades its own answers, which makes it a lenient
judge: set `OLLAMA_JUDGE_MODEL` to a stronger model if you have one, and read some
"passes" yourself before trusting any eval.

## Add a test case

Add an entry to `data/golden.json`:

```json
{
  "id": "faq-09",
  "category": "faq",
  "input": "Do you install on rented homes?",
  "expectedBehavior": "Only with written consent from the property owner.",
  "mustInclude": [["written consent", "consent from the owner"]],
  "shouldEscalate": false
}
```

A `mustInclude` entry can list alternatives, and any one counts. Every required phrase
must also appear in `data/knowledge-base.md`: loading the dataset fails otherwise, so
the tests can't drift from the facts the assistant uses.

## Project layout

```
data/            knowledge base + golden dataset
src/
  runner.ts      the eval: runs every case and scores it (npm run eval)
  assistant.ts   the assistant being tested
  scorers/       code checks, AI judge, safety judge
  dataset.ts     loads and validates the test cases
  report.ts      summary and printing
  experiments.ts named variants (prompt + model + settings)
  prompts.ts     system prompts
  llm.ts         calls Llama via Ollama
  config.ts      model names and settings
```
