export type OwnerBootstrapDecision =
  | "ASSIGN_OWNER"
  | "ALREADY_OWNER"
  | "OWNERSHIP_ALREADY_ESTABLISHED";

export function ownerBootstrapDecision(
  existingOwnerAssignments: readonly {
    profileId: string;
    active: boolean;
  }[],
  targetProfileId: string,
): OwnerBootstrapDecision {
  if (
    existingOwnerAssignments.some(
      (assignment) =>
        assignment.profileId === targetProfileId && assignment.active,
    )
  ) {
    return "ALREADY_OWNER";
  }

  return existingOwnerAssignments.length === 0
    ? "ASSIGN_OWNER"
    : "OWNERSHIP_ALREADY_ESTABLISHED";
}
