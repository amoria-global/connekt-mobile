# Face data: what we collect and what we promise

Apple rejected iOS 2.2.0 (13) on 2026-09-24 under Guideline 2.1, asking exactly
how the app handles face data. The answers below were sent to App Review, are
in the App Review Notes for the version, and are section 8 of the privacy
policy (https://connekyt.com/user/privacy-policy, source in the landing repo at
`app/pages/privacy-policy.tsx`). All four must stay in agreement.

| Feature | What is captured | Processed by | Stored | Deleted |
|---|---|---|---|---|
| Find My Photos | selfie | AWS Rekognition `SearchFacesByImage`, us-east-1 | never, held in memory for the search | n/a |
| Event albums (paid, face search on) | face vectors of faces in photos | AWS Rekognition `IndexFaces` | Rekognition collection per event or album | when the event or album is deleted |
| Identity verification (payout roles) | selfie, ID front/back | staff review; later the reference for withdrawals | private Cloudflare R2 bucket `/kyc` | on resubmission, and on account deletion (`KycService.purgeForAccountDeletion`) |
| KYC liveness check | frames on device | on device only | never (backend discards the part) | n/a |
| Withdrawal confirmation | selfie | AWS Rekognition `CompareFaces` against the KYC selfie | never | n/a |

No ARKit, TrueDepth face tracking or Face ID data is used. Face data is never
used for advertising, profiling or training, and never sold.

## Every capture is gated by consent

`src/features/privacy/consent.ts` holds one gate per feature:
`ensureFaceConsent` (Find My Photos), `ensureKycConsent` (identity
verification), `ensureWithdrawalFaceConsent` (withdrawal). Each names AWS and
says what is kept. `src/features/privacy/faceDataConsent.test.ts` fails when:

- a screen captures or uploads a face without calling a consent gate,
- a consent text stops naming Amazon Web Services,
- a new API module starts sending a selfie or face image.

## Before adding or changing anything that touches a face

1. Update the table above.
2. Update section 8 of the privacy policy in the landing repo and deploy it.
3. Update the consent text, and bump its storage key version so users see it.
4. Update the App Review Notes of the next iOS version (App Store Connect, App
   Review Information, Notes). The "FACE DATA" block there must match this file.
5. Add the new file to the allowlist in `faceDataConsent.test.ts`, which is the
   test telling you to do steps 1 to 4.
6. Backend: a new Rekognition call or a new file under `/kyc` needs the same
   retention answer. Anything stored must be deleted by account deletion.
