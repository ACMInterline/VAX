export type EquipmentAssignmentWindow = Readonly<{
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
}>;

/**
 * Team/equipment authority must cover the complete half-open service interval.
 * An assignment ending exactly at service end is still sufficient.
 */
export function equipmentAssignmentCoversService(
  assignment: EquipmentAssignmentWindow,
  serviceStart: Date,
  serviceEnd: Date,
): boolean {
  if (serviceEnd <= serviceStart) return false;
  return (
    (assignment.effectiveFrom === null ||
      assignment.effectiveFrom <= serviceStart) &&
    (assignment.effectiveUntil === null ||
      assignment.effectiveUntil >= serviceEnd)
  );
}
