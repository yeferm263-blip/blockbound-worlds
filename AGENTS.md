<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Game engine is vanilla three.js in src/game (imperative chunk meshing for performance); React only renders HUD/inventory in src/components/Game.tsx. Textures come from the CC0 Kenney atlas in public/textures.
- Mob gait rotates hip pivots and bobs the complete root, never an isolated torso, so limbs and outer layers remain connected.
- PackSprite crops imported atlas rectangles for HUD and inventory items; preserve the 3D block icons and custom texture workflow.
