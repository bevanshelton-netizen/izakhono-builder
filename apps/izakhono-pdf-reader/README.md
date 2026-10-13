# IZAKHONO PDF Reader — Android

A free, native Android PDF reader designed for the owner's phone.

## v1 capabilities

- Opens standard PDF files using Android's native `PdfRenderer`.
- Registers as an Android handler for `application/pdf`, including content URIs shared from apps such as WhatsApp.
- Includes an in-app PDF picker for documents already stored on the phone.
- Previous/next page navigation.
- No paid PDF-reader subscription and no third-party PDF SDK.
- No network permission is required by the reader.

## User flow

`WhatsApp PDF → Open with IZAKHONO PDF Reader → read immediately`

## Build

The repository workflow builds a debug APK and publishes it as a GitHub Actions artifact. Release signing remains an explicit owner-controlled gate.

## Next release gates

OCR, text search/copy, bookmarks, share/export, accessibility/read-aloud and optional on-device document intelligence can be added without changing the core PDF opening path.
