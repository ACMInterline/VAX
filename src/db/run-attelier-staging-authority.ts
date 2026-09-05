import "server-only";

import { activateAttelierStagingAuthority } from "./activate-attelier-staging-authority";

// The operator must invoke this entry point explicitly. Importing the reusable
// activation module (including during validation) must never load credentials.
activateAttelierStagingAuthority().catch(() => {
  process.stderr.write("ATTELIER staging authority activation failed safely.\n");
  process.exitCode = 1;
});
