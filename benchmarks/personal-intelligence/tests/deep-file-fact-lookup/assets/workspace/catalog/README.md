# catalog

`price-table.ts` is written nightly by the pricing sync job. It keeps
the price-adjustment audit log and superseded snapshots in-file
(compliance wants one auditable artifact), so the file is long.

Do not edit by hand — changes are overwritten on the next sync.
