export type CrmReferenceOption = Readonly<{
  id: number;
  label: string;
  active?: boolean;
}>;

export type CrmAreaOption = Readonly<{
  id: string;
  label: string;
  active?: boolean;
}>;

export type CleaningAssetFormOptions = Readonly<{
  areas: readonly CrmAreaOption[];
  itemTypes: readonly CrmReferenceOption[];
  fibreMaterials: readonly CrmReferenceOption[];
  surfaceConstructions: readonly CrmReferenceOption[];
  conditionLevels: readonly CrmReferenceOption[];
  issueTypes: readonly CrmReferenceOption[];
  riskFlags: readonly CrmReferenceOption[];
}>;
