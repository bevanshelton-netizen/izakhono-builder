# Izakhono Clothing Quote Intake

A mobile-first quote intake module for Izakhono Africa Clothing Manufacturing.

It can be mounted as a standalone `/quote` page or embedded into the main clothing site. The form records an immediate local backup and, when the APP FABRIC gateway endpoint is configured, emits a scoped `quote.requested` event into the `izakhono-clothing` CRM pipeline.

The form captures only the commercial information needed to qualify a quote: buyer contact, organisation, product category, quantity, sizes/specification, deadline and notes.

No payment is taken by this module and no order is treated as confirmed until the separate quotation / deposit / purchase-order process verifies it.

Set the APP FABRIC endpoint through:

```html
<meta name="izakhono-fabric-endpoint" content="https://fabric.example">
```

The public Gateway route must be enabled, origin allow-listed and protected through the approved FORTRESS / EDGE controls before production use.
