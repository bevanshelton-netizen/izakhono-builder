# IZAKHONO PocketPOS

Mobile-first installable PWA for catalogue, cart, stock, sales history, cash/EFT recording and a safe Tap-on-Phone companion workflow.

This first build deliberately does **not** capture PAN, PIN or CVV. Card-present payments must stay inside an approved SoftPOS / Tap-on-Phone provider. Online card payments must be implemented through a server-side gateway adapter with secrets held on IZAKHONO infrastructure.

Current public iKhokha material documents Tap on Phone in its Android app and an iK Pay API for custom online checkout. Production integration still needs authenticated staff, backend sync, payment/webhook reconciliation, audit logs, device enrollment and compliance review.