# Compact search Home control, 10 November 2026

Local UI change based on f541c5b. Not pushed or deployed.

## Change

- Replaced the standalone return row above search with a compact house icon and
  visible Hebrew label, `בית`, in the existing results action row.
- The accessible name and tooltip remain `חזרה למסך הבית`. Minimum touch target is
  44px, with a visible keyboard-focus outline.
- Search retains its full width and top position as results appear. The sticky
  card is 42px shorter in the responsive comparison fixture.
- Home still clears search/filter state and ends selection while retaining chosen
  contacts for Resume selection. No application JavaScript or access logic changed.
- Logo assets and protected owner-signature code are unchanged.

## Verification

- All 21 executable Node regression scripts pass, including the new compact Home
  presentation check and the existing search/selection tests.
- All 26 simulated DOM dialog checks pass.
- Native Safari: all 101 browser checks pass at 320, 375, 390, 430 and 960px.
  Coverage includes search clearing, category clearing, empty results, repeated
  Home activation, retained/resumed selections, heading focus, layout bounds,
  full search width, 44px target and no overlap with the selection action.
- Screenshots inspected at 320, 390 and 960px. A manual Home activation returns
  to the dashboard with heading focus, and Home remains visible for no results.
- Syntax, static audit, whitespace and protected-signature comparisons pass.

Browser fixtures use only synthetic contacts with external initialization disabled.
The live site was inspected read-only before editing and returned to Home. No real
contact records, backend configuration, account state or production assets changed.

## Integration

Branch: `fix/compact-search-home-20261110`.

Coordinate integration with the signup-clarity worktree before publishing. The
stylesheet/app cache keys are deliberately unchanged in this isolated UI commit;
bump the final combined release keys once during integration. Publish index.html
and styles.css together only when release authorization is confirmed.
