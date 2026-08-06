import { formatCents, marchOfficeSuppliesTotalCents } from "./src/ledger";

console.log(
  `March office-supplies total: ${formatCents(marchOfficeSuppliesTotalCents())}`,
);
