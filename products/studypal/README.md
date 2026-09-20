# StudyPal

StudyPal is the learner-facing education application for the IZAKHONO stack.

## Brand

- StudyPal
- Your 24/7 Learning Companion
- Any Subject. Any Curriculum. Any Language.
- Learn Smarter. Understand Better. Achieve More.
- Colours: deep blue, white and gold

## Current MVP

This first build includes:

- responsive StudyPal landing page
- learner classroom shell
- Free Starter and R99 Standard positioning
- Family / School / Sponsor pathway
- Docker runtime
- /healthz endpoint
- /api/plans endpoint
- /api/platform endpoint
- IZAKHONO application manifest

## Next integrations

The UI does not fake production services. The next layers are:

1. IZAKHONO authentication and role enforcement
2. PostgreSQL learner/account schema
3. object storage for learner uploads
4. AI-provider abstraction and metering
5. IZAKHONO Pay server-side subscription verification
6. parent, school and sponsor dashboards

## Run

```bash
cd products/studypal
npm start
```

Open http://localhost:3000 and verify http://localhost:3000/healthz.
