import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// review.yml calls Software Factory's review gate; review-requested.yml is this repository's copy of the helper that
// asks it to judge again. `workflow_run` finds the helper by its name alone, so a rename here would stop the gate
// looking again after a review, and nothing would fail.
const read = (name: string) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf-8');
const review = read('review.yml');
const requested = read('review-requested.yml');

// A workflow's `on:` block, to the next top-level key, without its comments.
const triggers = (workflow: string) =>
  (/^on:\n((?:(?![a-z]).*\n)*)/m.exec(workflow)?.[1] ?? '').replace(/^\s*#.*\n/gm, '');

describe('the review gate and merge queue workflows', () => {
  it('runs the gate when the helper, found by its name, finishes', () => {
    const name = /^name: (.+)$/m.exec(requested)?.[1];
    expect(name).toBe('review requested');
    expect(review).toMatch(/^ {2}workflow_run:\n {4}workflows: \[review requested\]\n {4}types: \[completed\]$/m);
  });

  // The pinned gate judges only a `workflow_run`: started any other way, it would judge nothing, and the check would
  // never post.
  it('runs the gate on nothing but the helper finishing', () => {
    expect(triggers(review).match(/^ {2}[a-z_]+:/gm)).toEqual(['  workflow_run:']);
  });

  // The helper's run on the pull request is what starts the gate.
  it('judges a pull request into main when it opens or moves', () => {
    expect(requested).toMatch(
      /^ {2}pull_request:\n {4}types: \[opened, reopened, synchronize, ready_for_review, edited\]$/m,
    );
  });

  // A stacked pull request, into the branch of the one below it, needs the `review` check as one into main does.
  it('judges a pull request into any branch too', () => {
    expect(triggers(requested)).not.toMatch(/branches|paths|pull_request_target/);
  });

  // The merge queue waits for every required check on its commit: one that never runs there holds the queue.
  it.each(['check.yml', 'pr-title.yml', 'gates.yml'])("runs %s on the merge queue's commit", (name) => {
    expect(read(name)).toMatch(/^ {2}merge_group:\n {4}types: \[checks_requested\]$/m);
  });

  // A merge queue's run has no head branch: grouped by it alone, every queue run would share one group and cancel
  // each other.
  it.each(['check', 'gates'])('keeps each run of %s.yml in a group of its own branch', (name) => {
    expect(read(`${name}.yml`)).toMatch(
      new RegExp(`^ {2}group: ${name}-\\$\\{\\{ github\\.head_ref \\|\\| github\\.ref \\}\\}$`, 'm'),
    );
  });

  it('passes the key in the review environment on to the gate', () => {
    // A called workflow sees an environment secret only when its caller passes it, by name.
    expect(review).toMatch(/^ {4}secrets:\n {6}REVIEW_APP_PRIVATE_KEY: \$\{\{ secrets\.REVIEW_APP_PRIVATE_KEY \}\}$/m);
    expect(review).not.toMatch(/secrets: inherit/);
  });

  it('asks again after a review and in the merge queue', () => {
    expect(requested).toMatch(/^ {2}pull_request_review:\n {4}types: \[submitted, dismissed\]$/m);
    expect(requested).toMatch(/^ {2}merge_group:\n {4}types: \[checks_requested\]$/m);
  });

  it('gives the helper no permissions and no secrets', () => {
    expect(requested).toMatch(/^permissions: \{\}$/m);
    expect(requested).not.toMatch(/secrets\.|permissions: [^{]|^\s+permissions:$/m);
  });
});
