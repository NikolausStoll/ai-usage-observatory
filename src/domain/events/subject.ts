import type Database from "better-sqlite3";

/**
 * A subject group is identified by applicationId + subjectId.
 * displayLabel is the latest non-empty subjectLabel by event timestamp
 * (not receivedAt). Derived from event rows; never stored separately.
 */
export interface SubjectGroup {
  applicationId: string;
  subjectId: string;
  /** Latest non-empty subjectLabel for this group, or null if none. */
  displayLabel: string | null;
  /** All distinct non-empty historical labels (for search keywords). */
  labels: string[];
  eventCount: number;
}

/**
 * Latest non-empty subjectLabel for applicationId + subjectId,
 * ordered by event timestamp DESC (then event_id DESC as tie-break).
 * A newer null/empty label does not erase an older useful label.
 */
export function resolveSubjectDisplayLabel(
  db: Database.Database,
  applicationId: string,
  subjectId: string
): string | null {
  if (!applicationId || !subjectId) return null;

  const row = db
    .prepare(
      `
    SELECT subject_label
    FROM events
    WHERE application_id = ?
      AND subject_id = ?
      AND subject_label IS NOT NULL
      AND TRIM(subject_label) != ''
    ORDER BY timestamp DESC, event_id DESC
    LIMIT 1
  `
    )
    .get(applicationId, subjectId) as { subject_label: string } | undefined;

  return row?.subject_label ?? null;
}

/**
 * Distinct subject groups (applicationId + subjectId) with display labels
 * derived from existing events. Does not create or cache subject entities.
 */
export function listSubjectGroups(db: Database.Database): SubjectGroup[] {
  const groups = db
    .prepare(
      `
    SELECT application_id, subject_id, COUNT(*) AS event_count
    FROM events
    WHERE subject_id IS NOT NULL AND TRIM(subject_id) != ''
    GROUP BY application_id, subject_id
    ORDER BY application_id COLLATE NOCASE, subject_id COLLATE NOCASE
  `
    )
    .all() as Array<{
    application_id: string;
    subject_id: string;
    event_count: number;
  }>;

  const labelRows = db
    .prepare(
      `
    SELECT application_id, subject_id, subject_label
    FROM events
    WHERE subject_id IS NOT NULL AND TRIM(subject_id) != ''
      AND subject_label IS NOT NULL AND TRIM(subject_label) != ''
    ORDER BY timestamp DESC, event_id DESC
  `
    )
    .all() as Array<{
    application_id: string;
    subject_id: string;
    subject_label: string;
  }>;

  const labelsByKey = new Map<string, string[]>();
  const displayByKey = new Map<string, string>();

  for (const row of labelRows) {
    const key = `${row.application_id}\0${row.subject_id}`;
    if (!displayByKey.has(key)) {
      displayByKey.set(key, row.subject_label);
    }
    const list = labelsByKey.get(key) ?? [];
    if (!list.includes(row.subject_label)) {
      list.push(row.subject_label);
    }
    labelsByKey.set(key, list);
  }

  return groups.map((g) => {
    const key = `${g.application_id}\0${g.subject_id}`;
    return {
      applicationId: g.application_id,
      subjectId: g.subject_id,
      displayLabel: displayByKey.get(key) ?? null,
      labels: labelsByKey.get(key) ?? [],
      eventCount: g.event_count,
    };
  });
}
