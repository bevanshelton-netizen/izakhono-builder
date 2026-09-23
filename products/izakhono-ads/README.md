# IZAKHONO ADS

Owner-controlled advertising distribution, measurement and campaign-control centre downstream of IZAKHONO CREATE.

## Mandatory creative-source rule

IZAKHONO ADS does not create an independent portfolio campaign from scratch. A valid `izakhono.marketing.package.v1` file with `source = IZAKHONO CREATE` is required to unlock creative and video workflow. Campaign duplication/revision is sent back to CREATE.

## Alpha capabilities

- Campaign dashboard and paused-by-default campaign workflow
- CREATE-package verification gate before campaign creative workflow
- campaign copilot using deterministic local templates after CREATE intake
- Multi-platform copy generation
- downstream image-ad renderer with PNG export after CREATE intake
- Built-in animated video studio
- 9:16, 1:1 and 16:9 video formats
- Local WebM video rendering using Canvas + MediaRecorder
- Storyboard generation
- Budget planning and lead estimates
- Local lead centre with CSV export
- Audience definitions and channel integration architecture
- Architecture placeholders for Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads, IZAKHONO AI Gateway and IZAKHONO PAY

## Safety boundary

No external ad account is connected in this alpha. No campaign can spend money or publish externally from this static build. Publishing connectors, credentials, approvals and audit logging are separate launch gates.

## Video note

The alpha renders animated WebM video locally in supported browsers such as current Chrome/Edge. MP4 transcoding, AI voice-over, avatar generation and external video-model connectors can be added as owner-controlled modules without changing the campaign data model.

## CEO Growth Board

IZAKHONO ADS ships the portfolio growth registry and exposes an interactive **CEO Growth** board. Before distribution, the owner can inspect each product's target audience, primary CTA, activation event, retention loop, referral loop, revenue model, approved channel mix and partnership targets. The registry is validated against IZAKHONO CREATE in CI so the two control planes cannot silently drift.
