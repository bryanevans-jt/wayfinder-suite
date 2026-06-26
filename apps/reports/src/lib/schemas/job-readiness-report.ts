import type { TagSchemaField } from "@/lib/tag-schema";

type CompetencyRow = {
  id: string;
  rowLabel: string;
};

function competencySection(
  section: string,
  prefix: string,
  rows: CompetencyRow[]
): TagSchemaField[] {
  return rows.map((row) => ({
    key: `row_${prefix}${row.id}`,
    label: row.rowLabel,
    type: "table_row" as const,
    section,
    rowLabel: row.rowLabel,
    trainingKey: `training${prefix}${row.id}`,
    dateKey: `date${prefix}${row.id}`,
    commentsKey: `comments${prefix}${row.id}`,
  }));
}

/** Paste into admin → Tennessee VR Programs → Job Readiness Report → Tag schema (JSON). */
export const JOB_READINESS_TAG_SCHEMA: TagSchemaField[] = [
  {
    key: "clientName",
    label: "Customer Name",
    type: "text",
    section: "Customer information",
    prefill: "clientName",
    required: true,
  },
  ...competencySection("A. The Job Application", "a", [
    {
      id: "1",
      rowLabel:
        "1. Can fill out a paper/online job application completely and correctly or has a responsible party who can assist when necessary (no blank items, signed)",
    },
    {
      id: "2",
      rowLabel:
        "2. Resume or fact sheet developed. The resume must be submitted to VR with the Vendor Authorization for payment of job readiness services.",
    },
    {
      id: "3",
      rowLabel:
        "3. References contacted (by the provider of job readiness services) in advance with complete information on name, address, telephone #, job title. The customer's reference sheet must be submitted to VR with the Vendor Authorization for payment of job readiness services.",
    },
    {
      id: "4",
      rowLabel:
        "4. Demonstrates understanding of legal implications of signature on application (drug screen, felony record, etc.)",
    },
    {
      id: "5",
      rowLabel: "5. Drug screening and ability to pass has been discussed with customer.",
    },
    {
      id: "6",
      rowLabel: "6. Education section fully completed accurately with dates.",
    },
  ]),
  ...competencySection("B. Finding the Right Job", "b", [
    {
      id: "1",
      rowLabel: "1. Can identify work interests. Understands if they are realistic.",
    },
    {
      id: "2",
      rowLabel:
        "2. Understands the importance of liking the job and feeling a part of the work environment (keeping the job, working harder, making fewer mistakes).",
    },
    {
      id: "3",
      rowLabel: "3. Understands and can discuss own abilities and aptitudes.",
    },
    {
      id: "4",
      rowLabel: "4. Understands the importance of motivation, attention and dependability.",
    },
    {
      id: "5",
      rowLabel:
        "5. Discuss being present every day, being on time, and getting along with others.",
    },
    {
      id: "6",
      rowLabel: "6. Can explain the benefits of working.",
    },
    {
      id: "7",
      rowLabel:
        "7. Understands how to perform a job search (Career Centers, friends/family, newspaper, internet, staffing services, staying organized).",
    },
  ]),
  ...competencySection("C. The Job Interview", "c", [
    { id: "1", rowLabel: "1. Understands first contact and first impressions." },
    { id: "2", rowLabel: "2. Can understand potential job interview questions." },
    {
      id: "3",
      rowLabel:
        "3. Demonstrates effective non-verbal behavior (eye contact, personal habits, calmness).",
    },
    {
      id: "4",
      rowLabel: "4. Understands and demonstrates appropriate dress and grooming for an interview.",
    },
    {
      id: "5",
      rowLabel:
        "5. Mock interviews (job readiness/placement provider; offsite interview conducted by third party).",
    },
    { id: "6", rowLabel: "6. Customer can discuss strengths as a worker." },
    {
      id: "7",
      rowLabel: "7. Can write out answers or verbally respond to interview questions.",
    },
    {
      id: "8",
      rowLabel:
        "8. Understands the need for follow up after an interview (phone call, thank you note).",
    },
    {
      id: "9",
      rowLabel:
        "9. Can explain what may be perceived as negatives on application (convictions, lapses in employment).",
    },
    {
      id: "10",
      rowLabel:
        "10. Understands pros and cons of disclosure of disability and knows how to request a reasonable accommodation.",
    },
  ]),
  ...competencySection("D. Keeping the Job", "d", [
    {
      id: "1",
      rowLabel:
        "1. Contingency plan/barriers to employment (transportation, childcare, illness, weather, gas/lunch money, alarm clock). Ongoing issues must be on the Job Placement Activity Plan.",
    },
    {
      id: "2",
      rowLabel:
        "2. Attendance; what are acceptable absences. What to do when you need to be absent.",
    },
    {
      id: "3",
      rowLabel: "3. Punctuality (upon arriving at work, following breaks and lunch).",
    },
    { id: "4", rowLabel: "4. Getting along with others — co-workers and supervisors." },
    { id: "5", rowLabel: "5. Quality of work." },
    { id: "6", rowLabel: "6. Quantity of work." },
    { id: "7", rowLabel: "7. Working safely." },
    { id: "8", rowLabel: "8. Following directions." },
    {
      id: "9",
      rowLabel:
        "9. Can assess strengths and weakness. Accepting responsibility for own behavior and problems on the job.",
    },
    { id: "10", rowLabel: "10. Knows how to request a reasonable accommodation." },
  ]),
  ...competencySection("E. Leaving the Job", "e", [
    {
      id: "1",
      rowLabel:
        "1. Understands the importance of giving two weeks notice, leaving on good terms, and making sure there is another job to go to.",
    },
  ]),
  {
    key: "date",
    label: "Date report content was reviewed with customer or representative/guardian",
    type: "date",
    section: "Certification",
    required: true,
  },
];
