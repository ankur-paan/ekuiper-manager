# Query Designer WIP (isolated)

- Snapshot of the experimental Query Designer work that was breaking the main app. Files were copied from the root before restoring the stable code.
- Contents mirror the original locations: `src/app/api-docs/page.tsx`, `src/components/ui/code-editor-impl.tsx`, `src/lib/ekuiper/functions.ts`, and the new `src/lib/emqx` and `src/lib/supabase` clients, plus the updated `package.json`/`next.config.js`.
- This folder is not part of the running app. If TypeScript starts checking it, exclude `query-designer-wip/**` in `tsconfig.json` or work from a separate branch.
- Extra dependencies for the WIP version: `@monaco-editor/react` (and the dev script used `next dev --webpack`). The stable build expects `monaco-editor`.
- To integrate later: reapply the package changes, move the relevant files back under `src`, and wire them in feature-by-feature instead of all at once. Keep commits small so regressions are easy to spot.
