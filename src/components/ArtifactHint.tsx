/** Compact artifact count label for event lists. */
export function formatArtifactHint(
  artifactCount: number,
  artifactDeletedCount: number
): { label: string; title: string; allDeleted: boolean } | null {
  if (artifactCount <= 0) return null;
  const active = artifactCount - artifactDeletedCount;
  const allDeleted = artifactDeletedCount >= artifactCount && artifactCount > 0;
  const noun = artifactCount === 1 ? "artifact" : "artifacts";

  if (allDeleted) {
    return {
      label: `${artifactCount} deleted`,
      title: `${artifactCount} ${noun} (binary removed)`,
      allDeleted: true,
    };
  }

  if (artifactDeletedCount > 0) {
    return {
      label: `${artifactCount} art`,
      title: `${active} available · ${artifactDeletedCount} deleted`,
      allDeleted: false,
    };
  }

  return {
    label: `${artifactCount} art`,
    title: `${artifactCount} ${noun}`,
    allDeleted: false,
  };
}
