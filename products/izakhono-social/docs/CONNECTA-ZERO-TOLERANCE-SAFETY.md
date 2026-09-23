# CONNECTA Zero-Tolerance Safety Contract

Effective: 23 September 2026

## Non-negotiable rule

CONNECTA does not permit cyberbullying, targeted harassment, threats, doxxing, impersonation/account cloning, scams, child sexual exploitation, pornography, illegal drug trade or promotion, gang recruitment, or violent criminal glorification.

Legitimate journalism, education, prevention, recovery, research and historical/public-interest discussion is not treated as a violation merely because it discusses a restricted subject without facilitating harm.

## Enforcement lifecycle

### 1. Safety report
A valid safety report immediately:
- creates a high-severity moderation case;
- places the reported account into a temporary protective restriction;
- revokes its active sessions;
- separates the reporter and reported account through safety blocks;
- removes follow relationships between the two accounts;
- issues a protective-lock notice;
- routes the case for urgent review.

A report is not a legal finding. This temporary restriction exists to stop continued contact while CONNECTA reviews the case.

### 2. Confirmed violation
Every confirmed zero-tolerance violation receives the same core consequence:
- offending content is removed where applicable;
- the account is suspended/disabled;
- all sessions are revoked;
- a formal CONNECTA Safety & Legal Compliance Warning is issued;
- relevant evidence and audit records are preserved according to policy;
- serious unlawful or dangerous conduct may be escalated when permitted or required by law.

### 3. Appeal
A blocked account may submit an appeal without regaining ordinary platform access. Restoration requires a review decision. Filing an appeal does not automatically reverse enforcement.

### 4. Malicious reports
A knowingly false report intended to disable, silence or harass another person is itself a serious Community Standards violation.

## Cyberbullying

The safety engine includes high-confidence blocking signals for:
- encouragement of suicide/self-harm directed at another person;
- direct threats to kill, hurt, beat, shoot, stab or attack;
- coordinated calls to harass, humiliate or attack a person;
- publication or threatened publication of private address/contact information.

The automated detector is only one layer. Contextual or ambiguous material can be reviewed rather than automatically punished.

## Picture/media provenance protection

CONNECTA protects media provenance in two layers:

- **Exact-file match:** SHA-256 identifies byte-for-byte re-uploads deterministically.
- **Altered-image signal:** local perceptual fingerprints compare normalised image structure, including center-crop variants, so cropped, resized or recompressed copies can be detected.

A high-confidence altered-image match:
- places the newer upload into review;
- records the earlier CONNECTA upload and account;
- alerts the earlier uploader;
- records similarity distances for moderator review.

Perceptual similarity is a safety/provenance signal, **not an automatic copyright or legal ownership finding**. Similar-looking images, authorised re-use, journalism, parody, commentary and other lawful/contextual uses require human review.

CONNECTA does not use this fingerprint system for face recognition, advertising or behavioural profiling.

## Account cloning / impersonation defence

CONNECTA uses protected identities and identity-similarity scanning.

Controls include:
- unique account handles;
- protected identity skeletons that collapse common look-alike tricks such as punctuation and digit substitutions;
- registration refusal for suspiciously similar protected handles;
- identity-alert queue for impersonation reports;
- moderator-controlled identity protection/verification;
- audit events for blocked clone registration attempts.

Shared real-world names alone are not enough to block an account. The clone detector prioritises suspicious handle similarity and combined identity signals to reduce false positives.

## Formal warning

The platform warning states that:
- the account was disabled following a confirmed Community Standards violation;
- restriction evasion through alternate/cloned accounts is prohibited;
- relevant records may be preserved for safety, disputes and lawful requests;
- serious unlawful or dangerous conduct may be referred to appropriate authorities or affected persons where permitted or required by law;
- the platform enforcement is not itself a criminal or civil finding;
- appeal remains available.

## Privacy boundary

Safety records exist for security, moderation, dispute handling and lawful compliance. They must not be repurposed for advertising, behavioural profiling or engagement ranking.
