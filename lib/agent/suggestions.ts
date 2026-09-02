export type SuggestionChip = {
  label: string
  prompt: string
}

export const IDE_SUGGESTIONS: SuggestionChip[] = [
  {
    label: 'Fix the admin login bug',
    prompt: 'Fix the always-true password check in src/auth.ts so admin login actually validates the password.',
  },
  {
    label: 'Explain src/auth.ts',
    prompt: 'Explain how login works in src/auth.ts and why the current password check is unsafe.',
  },
  {
    label: 'Plan a safer login',
    prompt: 'Write a plan to fix the admin password check in src/auth.ts without changing the public login/requireUser API.',
  },
]

export const AGENTS_SUGGESTIONS: SuggestionChip[] = [
  {
    label: 'Fix the auth bug',
    prompt: 'Fix the always-true password check in src/auth.ts and explain the change.',
  },
  {
    label: 'Improve README',
    prompt: 'Update playground/README.md so it documents the auth helper, the intentional bug, and how to run the sample app.',
  },
  {
    label: 'Plan a safer login',
    prompt: 'Draft a plan to make admin login verify a stored password without changing the exported API.',
  },
]
