import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// review.yml calls Software Factory's review gate; review-requested.yml is this repository's copy of the helper that
// asks it to judge again. `workflow_run` finds the helper by its name alone, so a rename here would stop the gate
// looking again after a review, and nothing would fail.
const read = (name: string) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf-8');
const review = read('review.yml');
const requested = read('review-requested.yml');

describe('the review gate and merge queue workflows', () => {
  it('runs the gate when the helper, found by its name, finishes', () => {
    const name = /^name: (.+)$/m.exec(requested)?.[1];
    expect(name).toBe('review requested');
    expect(review).toMatch(/^ {2}workflow_run:\n {4}workflows: \[review requested\]\n {4}types: \[completed\]$/m);
  });

  it('judges a pull request into main when it opens or moves', () => {
    expect(review).toMatch(/^ {2}pull_request_target:\n {4}branches: \[main\]\n/m);
  });

  // The merge queue waits for every required check on its commit: one that never runs there holds the queue.
  it.each(['check.yml', 'pr-title.yml'])("runs %s on the merge queue's commit", (name) => {
    expect(read(name)).toMatch(/^ {2}merge_group:\n {4}types: \[checks_requested\]$/m);
  });

  it('passes the key in the review environment on to the gate', () => {
    // A called workflow sees an environment secret only when its caller passes it.
    expect(review).toMatch(/^ {4}secrets: inherit$/m);
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
