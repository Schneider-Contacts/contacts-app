# Pharmacology copy/import review, 10 November 2026

Local follow-up to published baseline 8e59839. This change is not deployed.

## User-facing changes

- A one-click **העתקת הוראות לצ׳אט** button copies the extraction prompt. The user attaches the image in their chosen chat and pastes the returned JSON into this app. Nothing is sent automatically.
- Clipboard API, legacy copy and manual text-selection fallback are supported. Failed copy never reports success. Stale completions do not alter a reopened editor.
- Prompt requests one paste-ready JSON object, exact source spellings and unique phone mapping. Missing hours alone do not cause uncertainty. A bare name under an on-call heading can use that category. An unambiguous printed 21–8 interval can be normalized as overnight with a source note; genuinely unclear ranges remain uncertain.
- Preview summarizes call-enabled rows, unknown hours and genuine uncertainty. Repeated warnings are collapsed. Review does not silently clear uncertainty.
- Copying a whole JSON code fence or UTF-8 BOM no longer causes a parse failure. Arbitrary surrounding commentary remains rejected, with guidance.
- Optional local JSON/TXT file selection is secondary to paste. Files are capped at 100KB and selecting a file does not publish it.
- Local preview appears even if the server check fails. Publication remains blocked until the check succeeds and the user reviews/confirms. Permission, expired-login and network errors are distinguished; unknown write outcomes require a fresh preview.

## Diagnosis limits

The user clarified that pasting another chat's output worked. Both its JSON and the earlier supplied raw JSON validate. The prior response's code-fence wrapper fails in the published parser and passes here, but there is no evidence showing precisely what was pasted on the user's device. Do not claim the exact original failure is known or that JSON format itself was broken.

## Verification

- All 19 Node regression scripts pass, including 22 parser tests and 10 new copy/file/service tests.
- 26 dialog checks pass in jsdom and native Safari.
- 43 combined Safari checks pass and cover 320/375/390/430/960px widths, copy success, manual fallback selection, TXT/BOM import, call-count preview, review/confirmation and synthetic publish/cancel, Escape and Back/Forward.
- Clipboard and backend operations in browser tests use synthetic stubs. No real clipboard contents, authentication, contact/roster publication or external send is used.
- JavaScript syntax and whitespace checks pass. Firestore rules, Apps Script, app.js, owner signature and existing data remain unchanged.

Publish only after approval of this follow-up. Changed assets must be deployed together with the new cache key. No Firestore rule deployment or migration is needed.
