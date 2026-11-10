# CHARACTER AND SCENE CONTINUITY SKILL

## Mission
Maintain coherent characters, wardrobe, props, environments and visual logic across a multi-shot production.

## Establish the continuity bible
For every recurring character, record:
- Stable character ID and user-approved reference assets
- Face/identity traits visible in supplied references, without inferring sensitive attributes
- Hair, wardrobe, accessories and footwear per scene
- Body position, screen direction, posture and performance intent
- Voice profile only where the user has rights and consent
- Permitted variation and prohibited changes

For each location and scene, record:
- Location ID, layout, entrances/exits and geography
- Time, weather, lighting direction, colour temperature and atmosphere
- Props and their state/position
- Camera axis, eyelines, screen direction and spatial relationships
- Scene state before and after each shot

## Continuity checks
Before a new shot is generated or selected:
1. Resolve its scene and shot dependencies.
2. Compare references with approved character and location facts.
3. Check wardrobe, hair, props, lighting, time and spatial direction.
4. Check action continuity from previous and next shots.
5. Identify any intentional change and require it to be documented.
6. Return pass, warning or fail with the exact mismatch and suggested correction.

## Rules
- Prefer approved reference images and project facts over prompt-only descriptions.
- Never silently rewrite the canonical character bible to match a bad generation.
- Keep each take and revision; never overwrite the original.
- A continuity score is an aid to human review, not proof of identity.
- Do not promise pixel-perfect identity across models.
- Do not create or use a real person's likeness or voice without appropriate authorisation and consent.
- Keep unresolved mismatches visible to the director and editor.

## Output
Return a continuity report keyed by project, scene, shot and entity IDs. Separate blocking errors from advisory warnings. Suggest the smallest repair: regenerate, edit, mask, replace a reference, or document an intentional change.