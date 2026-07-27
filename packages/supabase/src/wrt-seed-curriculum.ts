/**
 * Starter WRT curriculum — original Joshua Tree facilitator lessons aligned to
 * NTACT:C Workplace Readiness domains and GVRA adult WRT (§6000).
 * Free public resources only (ODEP Soft Skills PDFs/videos, CFPB, JAN, SSA).
 * Fully editable in admin once seeded; not locked system content.
 */

export type SeedBlock = {
  block_type: "rich_text" | "youtube" | "pdf_link" | "quiz" | "activity" | "external_link";
  title?: string;
  body?: string;
  url?: string;
  meta?: Record<string, unknown>;
};

export type SeedLesson = {
  slug: string;
  title: string;
  objectives: string;
  desired_outcomes: string;
  facilitator_notes: string;
  citations: string;
  default_duration_minutes: number;
  is_optional?: boolean;
  blocks: SeedBlock[];
};

export type SeedModule = {
  slug: string;
  title: string;
  description: string;
  citations: string;
  is_optional?: boolean;
  lessons: SeedLesson[];
};

const ODEP_SOFT_SKILLS_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/softskills.pdf";
const ODEP_COMMUNICATION_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/communication.pdf";
const ODEP_TEAMWORK_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/teamwork.pdf";
const ODEP_ENTHUSIASM_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/enthusiasm.pdf";
const ODEP_PROFESSIONALISM_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/professionalism.pdf";
const ODEP_NETWORKING_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/networking.pdf";
const ODEP_PROBLEM_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/problem.pdf";
const CFPB_BUDGET =
  "https://files.consumerfinance.gov/f/documents/cfpb_building_block_activities_budgeting.pdf";
const JAN_HOME = "https://askjan.org/";
const SSA_WORK = "https://www.ssa.gov/redbook/";

function quiz(title: string, questions: { q: string; options: string[]; answer: number }[]): SeedBlock {
  return {
    block_type: "quiz",
    title,
    meta: { questions },
  };
}

export const WRT_SEED_CURRICULUM: SeedModule[] = [
  {
    slug: "social-skills",
    title: "Social Skills",
    description:
      "Interpersonal and soft skills employers expect: communication, teamwork, professionalism, feedback, and workplace relationships (GVRA §6000; NTACT:C social/interpersonal domain).",
    citations:
      "NTACT:C Workplace Readiness Training; GVRA Provider Guidelines §6000; U.S. DOL ODEP Skills to Pay the Bills (free).",
    lessons: [
      {
        slug: "communication-basics",
        title: "Communication Basics",
        objectives:
          "Identify clear spoken and written workplace communication; practice listening and checking for understanding.",
        desired_outcomes:
          "Participant can give a clear work update and restate instructions accurately.",
        facilitator_notes:
          "Open with a brief role-play (unclear vs clear request). Adult focus: supervisor check-ins, customer/coworker clarity. Pause after the ODEP video for discussion.",
        citations: "ODEP Soft Skills — Communication (DOL YouTube + PDF).",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Clear communication is one of the top skills employers list. Today we practice saying what we mean, listening fully, and confirming understanding before acting.",
          },
          {
            block_type: "youtube",
            title: "ODEP Soft Skills — Communication",
            url: "https://www.youtube.com/watch?v=X0voPlW2pSs",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Communication activities (PDF)",
            url: ODEP_COMMUNICATION_PDF,
          },
          {
            block_type: "activity",
            title: "Role-play: clarify the task",
            body: "Pairs: one gives a vague work instruction; the other asks clarifying questions until they can repeat the task in their own words. Switch roles.",
          },
          quiz("Quick check", [
            {
              q: "What should you do if you do not understand a work instruction?",
              options: [
                "Guess and hope for the best",
                "Ask clarifying questions and repeat the task back",
                "Ignore it until someone notices",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "teamwork-cooperation",
        title: "Teamwork and Cooperation",
        objectives: "Describe how to share credit, ask for help, and support coworkers on a shared goal.",
        desired_outcomes: "Participant names two teamwork behaviors they will use on the job.",
        facilitator_notes: "Emphasize adult workplace teams (shifts, departments), not school group projects.",
        citations: "ODEP Soft Skills — Teamwork.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Most jobs require working with others. Good teammates communicate, share credit, and help the group meet deadlines.",
          },
          {
            block_type: "youtube",
            title: "ODEP Soft Skills — Teamwork",
            url: "https://www.youtube.com/watch?v=sMFh9QYFh2I",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Teamwork activities (PDF)",
            url: ODEP_TEAMWORK_PDF,
          },
          {
            block_type: "activity",
            title: "Shared-credit practice",
            body: "Discuss a time someone took all the credit. Rewrite the response to thank teammates by name.",
          },
          quiz("Quick check", [
            {
              q: "When praised for team work, a professional usually:",
              options: [
                "Accepts all credit alone",
                "Shares credit with teammates",
                "Leaves without responding",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "professionalism-attitude",
        title: "Professionalism and Workplace Attitude",
        objectives: "Connect punctuality, initiative, and respectful tone to professionalism.",
        desired_outcomes: "Participant lists three professionalism habits for their next workday or mock shift.",
        facilitator_notes: "Pair ODEP enthusiasm and professionalism videos; keep examples adult (interviews, shifts).",
        citations: "ODEP Soft Skills — Enthusiasm & Attitude; Professionalism.",
        default_duration_minutes: 45,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Professionalism means responsibility, integrity, and doing what needs doing—even when no one asks. Attitude shows up in how you arrive, speak, and follow through.",
          },
          {
            block_type: "youtube",
            title: "ODEP Soft Skills — Enthusiasm and Attitude",
            url: "https://www.youtube.com/watch?v=-vk-99seC_I",
          },
          {
            block_type: "youtube",
            title: "ODEP Soft Skills — Professionalism",
            url: "https://www.youtube.com/watch?v=7dPWVjQSad4",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Professionalism activities (PDF)",
            url: ODEP_PROFESSIONALISM_PDF,
          },
          {
            block_type: "pdf_link",
            title: "ODEP Enthusiasm activities (PDF)",
            url: ODEP_ENTHUSIASM_PDF,
          },
          {
            block_type: "activity",
            title: "Interview contrast",
            body: "Discuss the two interview styles from the enthusiasm video. List what the successful candidate did differently.",
          },
          quiz("Quick check", [
            {
              q: "Professionalism at work includes:",
              options: [
                "Only knowing the technical task",
                "Responsibility, integrity, and productive habits",
                "Avoiding coworkers",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "feedback-conflict",
        title: "Accepting Feedback and Conflict Basics",
        objectives: "Practice receiving constructive feedback without becoming defensive; name calm conflict steps.",
        desired_outcomes: "Participant can role-play accepting one piece of feedback and stating a next step.",
        facilitator_notes: "Keep conflict light and workplace-focused. De-escalate; do not role-play aggression.",
        citations: "ODEP Soft Skills — Problem Solving; Joshua Tree original facilitator script.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Feedback helps you keep a job. Pause, listen, ask one clarifying question, and state what you will try next. Conflict: stay calm, focus on the issue, suggest a fix.",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Problem Solving activities (PDF)",
            url: ODEP_PROBLEM_PDF,
          },
          {
            block_type: "activity",
            title: "Feedback sandwich role-play",
            body: "Facilitator gives mild constructive feedback. Participant practices: listen → clarify → commit to one change.",
          },
          quiz("Quick check", [
            {
              q: "A helpful first response to workplace feedback is:",
              options: [
                "Argue immediately",
                "Listen, clarify, and state a next step",
                "Quit the conversation",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "workplace-relationships",
        title: "Networking and Workplace Relationships",
        objectives: "Describe professional networking as building helpful work relationships (not only job hunting).",
        desired_outcomes: "Participant identifies three people or places they can network with respectfully.",
        facilitator_notes: "Adult angle: coworkers, supervisors, community partners, VR counselor—not only social media.",
        citations: "ODEP Soft Skills — Networking.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Networking means building respectful relationships that support career goals—coworkers, supervisors, mentors, and community contacts.",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Networking activities (PDF)",
            url: ODEP_NETWORKING_PDF,
          },
          {
            block_type: "pdf_link",
            title: "Full ODEP Soft Skills curriculum (PDF)",
            url: ODEP_SOFT_SKILLS_PDF,
          },
          {
            block_type: "activity",
            title: "30-second introduction",
            body: "Practice a brief professional introduction: name, strength, and what kind of work you are preparing for.",
          },
          quiz("Quick check", [
            {
              q: "Workplace networking is mainly about:",
              options: [
                "Collecting as many phone numbers as possible",
                "Building respectful relationships that support work goals",
                "Avoiding supervisors",
              ],
              answer: 1,
            },
          ]),
        ],
      },
    ],
  },
  {
    slug: "independent-living",
    title: "Independent Living",
    description:
      "Skills that support showing up ready to work: time, presentation, transportation, health routines, and problem-solving (GVRA §6000).",
    citations: "GVRA §6000; NTACT:C independent living skills; JAN (askjan.org).",
    lessons: [
      {
        slug: "time-management-punctuality",
        title: "Time Management and Punctuality",
        objectives: "Build a realistic morning-to-work plan; identify buffers for transit delays.",
        desired_outcomes: "Participant writes a personal arrival plan with a buffer.",
        facilitator_notes: "Use the participant’s real schedule (transit, childcare, medication) when possible.",
        citations: "Joshua Tree original; ODEP professionalism themes.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Employers expect reliable arrival. Plan backward from start time, add a buffer, and know who to contact if you will be late.",
          },
          {
            block_type: "activity",
            title: "Backward schedule",
            body: "From shift start time, list wake, leave home, transit, and arrival buffer. Identify one risk and a backup plan.",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Professionalism activities (PDF)",
            url: ODEP_PROFESSIONALISM_PDF,
          },
          quiz("Quick check", [
            {
              q: "If you may be late to work, you should:",
              options: [
                "Say nothing and hope no one notices",
                "Contact your supervisor as soon as you know",
                "Make up a story later",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "presentation-hygiene",
        title: "Personal Presentation and Hygiene for Work",
        objectives: "Connect grooming and dress to employer expectations for the participant’s target job types.",
        desired_outcomes: "Participant lists a personal work-ready checklist.",
        facilitator_notes: "Be respectful and concrete. Match dress to actual local job types (retail, warehouse, office, food service).",
        citations: "GVRA §6000 grooming/hygiene; Joshua Tree original.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Presentation signals readiness. Clean clothes appropriate to the job, basic hygiene, and following any uniform or safety gear rules.",
          },
          {
            block_type: "activity",
            title: "Work-ready checklist",
            body: "Create a nightly and morning checklist (clothes, hygiene, ID/badge, lunch, transit card/keys).",
          },
          quiz("Quick check", [
            {
              q: "Work presentation should be based on:",
              options: [
                "Whatever is most comfortable only",
                "Employer and job-site expectations",
                "Ignoring dress codes",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "transportation-to-work",
        title: "Transportation and Getting to Work",
        objectives: "Identify reliable ways to get to work and backup options.",
        desired_outcomes: "Participant documents primary and backup transportation.",
        facilitator_notes: "Include paratransit, family, rideshare budget limits, walking, bike—whatever is realistic locally.",
        citations: "GVRA §6000 travel training; Joshua Tree original.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Getting to work reliably is part of employability. Know your primary route, timing, cost, and what you will do if that option fails.",
          },
          {
            block_type: "activity",
            title: "Route card",
            body: "Fill in: primary mode, leave-by time, travel time, cost, backup mode, who to call if stuck.",
          },
          quiz("Quick check", [
            {
              q: "A strong transportation plan includes:",
              options: [
                "Only one option with no backup",
                "A primary plan and at least one backup",
                "Relying on coworkers every day",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "health-routines-work",
        title: "Health and Routines That Support Employment",
        objectives: "Link sleep, medication routines, and breaks to reliable work performance.",
        desired_outcomes: "Participant names one health routine that supports showing up ready.",
        facilitator_notes: "Do not provide medical advice. Encourage coordination with treating providers and VR counselor as needed.",
        citations: "GVRA §6000 health/medicine management (awareness); Joshua Tree original.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Sleep, medication timing (as prescribed), meals, and planned breaks help you stay focused and reliable. This is planning—not medical advice.",
          },
          {
            block_type: "activity",
            title: "Work-support routine",
            body: "List evening and morning habits that help the next workday. Note any accommodation conversation to have with a counselor or employer later.",
          },
          quiz("Quick check", [
            {
              q: "If medication timing affects your workday, you should:",
              options: [
                "Change doses without asking anyone",
                "Coordinate with your provider and discuss workplace needs with your counselor as appropriate",
                "Skip doses on workdays",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "problem-solving-help",
        title: "Problem-Solving and Asking for Help",
        objectives: "Practice naming a barrier, trying a step, and knowing when to ask for help or accommodations.",
        desired_outcomes: "Participant can describe one workplace problem and who they would ask for help.",
        facilitator_notes: "Introduce JAN as a free public resource for accommodation ideas—not a substitute for employer interactive process.",
        citations: "ODEP Problem Solving PDF; Job Accommodation Network (askjan.org).",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "At work, try a reasonable step, then ask early—supervisor, coworker, or counselor—before a small issue becomes a crisis.",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Problem Solving activities (PDF)",
            url: ODEP_PROBLEM_PDF,
          },
          {
            block_type: "external_link",
            title: "Job Accommodation Network (JAN)",
            url: JAN_HOME,
            body: "Free public guidance on workplace accommodations.",
          },
          {
            block_type: "activity",
            title: "Barrier → step → ask",
            body: "Pick a real or sample barrier. Write: (1) the problem, (2) one step you can try, (3) who you ask if stuck.",
          },
          quiz("Quick check", [
            {
              q: "Asking for help at work is:",
              options: [
                "Always a sign of failure",
                "A professional skill when used appropriately",
                "Only allowed after you are fired",
              ],
              answer: 1,
            },
          ]),
        ],
      },
    ],
  },
  {
    slug: "financial-literacy",
    title: "Financial Literacy",
    description:
      "Foundational money skills for working adults: earning, budgeting, banking, credit awareness, and benefits overview (NTACT:C / GVRA financial literacy).",
    citations: "CFPB free consumer materials; SSA Red Book (public); Joshua Tree original facilitator plans.",
    lessons: [
      {
        slug: "earning-pay",
        title: "Earning and Understanding Pay",
        objectives: "Identify gross vs net pay and common paycheck deductions at a high level.",
        desired_outcomes: "Participant can explain the difference between gross and take-home pay.",
        facilitator_notes: "Use a sample stub (no real SSNs). Keep tax detail high-level.",
        citations: "Joshua Tree original; CFPB consumer education.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Gross pay is before deductions. Net (take-home) is what you receive after taxes and other withholdings. Knowing the difference helps you budget.",
          },
          {
            block_type: "activity",
            title: "Sample stub review",
            body: "Review a fictional paycheck. Circle gross, net, and one deduction. Discuss why net is lower.",
          },
          quiz("Quick check", [
            {
              q: "Take-home (net) pay is usually:",
              options: [
                "Higher than gross pay",
                "Lower than gross pay after deductions",
                "The same as gross pay",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "budgeting-basics",
        title: "Budgeting Basics",
        objectives: "Build a simple monthly budget with needs, wants, and savings.",
        desired_outcomes: "Participant drafts a one-month needs/wants/savings sketch.",
        facilitator_notes: "Use CFPB free budgeting PDF activities as optional handouts.",
        citations: "CFPB Building Block budgeting PDF (free).",
        default_duration_minutes: 45,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "A budget matches income to expenses. Start with needs (housing, food, transport), then wants, then a small savings or buffer if possible.",
          },
          {
            block_type: "pdf_link",
            title: "CFPB budgeting activities (PDF)",
            url: CFPB_BUDGET,
          },
          {
            block_type: "activity",
            title: "Needs / wants / buffer",
            body: "List monthly income estimate, three needs, two wants, and one buffer goal (even a small amount).",
          },
          quiz("Quick check", [
            {
              q: "In a basic budget, you should usually plan:",
              options: [
                "Wants before needs",
                "Needs first, then wants and a buffer if possible",
                "Only entertainment",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "banking-accounts",
        title: "Banking and Accounts",
        objectives: "Compare checking vs savings at a basic level; list safe banking habits.",
        desired_outcomes: "Participant names one safe habit for debit/ATM use.",
        facilitator_notes: "Do not recommend specific banks. Discuss fees and overdrafts generally.",
        citations: "Joshua Tree original; CFPB consumer banking education (public).",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Checking is for everyday spending. Savings is for goals and emergencies. Protect PINs, review statements, and watch for fees.",
          },
          {
            block_type: "activity",
            title: "Account match",
            body: "Sort sample transactions into checking vs savings use cases. Discuss one fee to avoid.",
          },
          quiz("Quick check", [
            {
              q: "A PIN should be:",
              options: [
                "Shared with coworkers",
                "Kept private",
                "Written on your debit card",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "credit-debt-awareness",
        title: "Credit and Debt Awareness",
        objectives: "Explain what credit is and why high-interest debt can grow quickly.",
        desired_outcomes: "Participant can name one risk of unpaid high-interest debt.",
        facilitator_notes: "Awareness only—not credit counseling. Refer complex situations to appropriate counselors.",
        citations: "Joshua Tree original; CFPB public consumer credit education.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Credit lets you borrow and repay. Interest is the cost of borrowing. Missing payments can damage credit and increase what you owe.",
          },
          {
            block_type: "activity",
            title: "Interest illustration",
            body: "Using a simple example ($100 at a high APR unpaid), discuss how balances can grow. Emphasize paying on time when you use credit.",
          },
          quiz("Quick check", [
            {
              q: "Paying credit bills on time generally:",
              options: [
                "Harms your credit",
                "Helps your credit history",
                "Has no effect",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "benefits-work-overview",
        title: "Benefits and Work — Overview",
        objectives: "Know that working can affect benefits and that personalized advice requires a qualified counselor.",
        desired_outcomes: "Participant knows to ask a benefits counselor / VR counselor before major work changes.",
        facilitator_notes:
          "Do not give individualized benefits advice. Point to SSA Red Book as public reference and refer to Benefits Counseling as appropriate.",
        citations: "SSA Red Book (public); Joshua Tree original facilitator script.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Work income can interact with disability benefits. Rules are individual. Use public references for awareness and talk with a qualified counselor before decisions.",
          },
          {
            block_type: "external_link",
            title: "SSA Red Book (public)",
            url: SSA_WORK,
            body: "Social Security’s public guide to work incentives.",
          },
          {
            block_type: "activity",
            title: "Questions list",
            body: "Write three questions to ask a VR or benefits counselor about working while receiving benefits.",
          },
          quiz("Quick check", [
            {
              q: "Before making big work decisions that may affect benefits, you should:",
              options: [
                "Guess based on a friend’s experience",
                "Ask a qualified counselor and use trusted public resources",
                "Stop benefits yourself without guidance",
              ],
              answer: 1,
            },
          ]),
        ],
      },
    ],
  },
  {
    slug: "job-readiness",
    title: "Job Readiness",
    description:
      "Employer expectations, applications, interviews, rights/responsibilities, and a personal job-search plan (NTACT:C job-seeking / GVRA §6000).",
    citations: "NTACT:C Workplace Readiness; ODEP Soft Skills; JAN; Joshua Tree original.",
    lessons: [
      {
        slug: "employer-expectations",
        title: "Employer Expectations and Work Culture",
        objectives: "List common employer expectations (attendance, quality, teamwork, safety).",
        desired_outcomes: "Participant ranks which expectations they need most practice on.",
        facilitator_notes: "Connect back to Social Skills module as needed.",
        citations: "ODEP Soft Skills curriculum (free PDF).",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Employers look for reliability, quality work, following safety rules, and getting along with others—across almost every job.",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Soft Skills curriculum (PDF)",
            url: ODEP_SOFT_SKILLS_PDF,
          },
          {
            block_type: "activity",
            title: "Expectation ranking",
            body: "Rank attendance, quality, teamwork, safety, and communication from strongest to needs practice. Pick one practice goal.",
          },
          quiz("Quick check", [
            {
              q: "Showing up on time is:",
              options: [
                "Optional if you work hard later",
                "A core employer expectation",
                "Only important in office jobs",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "applications-resumes",
        title: "Applications and Resumes Intro",
        objectives: "Gather key application facts and draft a simple resume outline.",
        desired_outcomes: "Participant completes a fact sheet (contacts, work/volunteer history, skills).",
        facilitator_notes: "Keep literacy supports ready. Focus on honesty and completeness.",
        citations: "Joshua Tree original facilitator plan.",
        default_duration_minutes: 45,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Applications and resumes tell your story: contact info, experience, skills, and availability. Accuracy matters.",
          },
          {
            block_type: "activity",
            title: "Fact sheet",
            body: "Fill: phone/email, work or volunteer history, three skills, availability, references plan.",
          },
          quiz("Quick check", [
            {
              q: "On applications you should:",
              options: [
                "Invent experience to look better",
                "Provide accurate information",
                "Leave contact info blank",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "interview-skills",
        title: "Interview Skills",
        objectives: "Practice a professional introduction and common interview questions.",
        desired_outcomes: "Participant completes a mock interview with feedback.",
        facilitator_notes: "Reuse ODEP enthusiasm video themes (arrive on time, positive tone).",
        citations: "ODEP Soft Skills — Enthusiasm & Attitude video.",
        default_duration_minutes: 45,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Interviews show preparation, attitude, and fit. Arrive early, dress for the job, and practice short clear answers.",
          },
          {
            block_type: "youtube",
            title: "ODEP Soft Skills — Enthusiasm and Attitude",
            url: "https://www.youtube.com/watch?v=-vk-99seC_I",
          },
          {
            block_type: "activity",
            title: "Mock interview",
            body: "Three questions: Tell me about yourself; What is a strength?; When could you start? Give brief feedback.",
          },
          quiz("Quick check", [
            {
              q: "For interviews, it helps to:",
              options: [
                "Arrive late so you seem busy",
                "Arrive on time and prepare short answers",
                "Avoid eye contact always",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "rights-responsibilities",
        title: "Workplace Rights, Responsibilities, and Disclosure Basics",
        objectives: "Distinguish employee responsibilities from basic rights; introduce disclosure as a personal decision.",
        desired_outcomes: "Participant can state one responsibility and one right, and when they might talk with a counselor about disclosure.",
        facilitator_notes:
          "Do not pressure disclosure. Use JAN as a free public accommodations resource. Refer legal questions to appropriate professionals.",
        citations: "JAN (askjan.org); Joshua Tree original.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Workers have responsibilities (safety, honesty, following policies) and rights (fair treatment, requesting accommodations through proper channels). Disability disclosure is personal—discuss with your counselor.",
          },
          {
            block_type: "external_link",
            title: "Job Accommodation Network",
            url: JAN_HOME,
          },
          {
            block_type: "activity",
            title: "Rights vs responsibilities sort",
            body: "Sort sample statements into rights, responsibilities, or ask-a-counselor.",
          },
          quiz("Quick check", [
            {
              q: "Disability disclosure at work is:",
              options: [
                "Always required on day one for every job",
                "A personal decision to discuss with trusted counselors as needed",
                "Never allowed",
              ],
              answer: 1,
            },
          ]),
        ],
      },
      {
        slug: "job-search-plan",
        title: "Job Search Plan and Next Steps",
        objectives: "Build a simple weekly job-search plan with measurable steps.",
        desired_outcomes: "Participant leaves with a one-week action plan.",
        facilitator_notes: "Align steps with VR counselor goals when applicable. This module is readiness—not a hire guarantee.",
        citations: "Joshua Tree original facilitator plan.",
        default_duration_minutes: 30,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "A job search plan turns goals into weekly actions: applications, follow-ups, skill practice, and meetings with your specialist or counselor.",
          },
          {
            block_type: "activity",
            title: "One-week plan",
            body: "Write 3–5 concrete steps for the next week (who, what, when). Include one follow-up.",
          },
          quiz("Quick check", [
            {
              q: "A useful job-search plan includes:",
              options: [
                "Vague hopes only",
                "Specific weekly actions and follow-ups",
                "Waiting without applying",
              ],
              answer: 1,
            },
          ]),
        ],
      },
    ],
  },
  {
    slug: "optional-workplace-appropriateness",
    title: "Workplace Appropriateness (Optional)",
    description:
      "Optional module: careful discussion of professional boundaries and workplace-appropriate behavior (GVRA §6000 sexual awareness/appropriateness). Assign only when clinically and culturally appropriate.",
    citations: "GVRA §6000; Joshua Tree original facilitator guidance.",
    is_optional: true,
    lessons: [
      {
        slug: "workplace-boundaries",
        title: "Professional Boundaries and Workplace Appropriateness",
        objectives:
          "Identify professional vs personal topics at work; practice respectful boundaries; know when to seek support.",
        desired_outcomes:
          "Participant can name examples of workplace-appropriate vs inappropriate comments/behavior and who to tell if uncomfortable.",
        facilitator_notes:
          "OPTIONAL. Use a calm, respectful tone. No graphic content. Focus on consent for touch, jokes, dating coworkers, and reporting harassment. Stop if the participant is distressed; involve supervisor/clinical supports as needed. Do not mix with group unless all attendees are appropriate for the topic.",
        citations: "GVRA §6000; Joshua Tree original.",
        default_duration_minutes: 30,
        is_optional: true,
        blocks: [
          {
            block_type: "rich_text",
            title: "Session focus",
            body: "Workplaces expect respectful boundaries: appropriate language, no unwanted comments about bodies or dating, and consent for any physical contact. If someone makes you uncomfortable, tell a supervisor, HR, or your specialist.",
          },
          {
            block_type: "activity",
            title: "Appropriate / not appropriate",
            body: "Sort sample situations (handshake vs hug without asking; work compliment vs personal comment; asking a coworker out after they said no). Discuss safer choices.",
          },
          quiz("Quick check", [
            {
              q: "If a coworker’s comments make you uncomfortable, you should:",
              options: [
                "Ignore serious discomfort forever",
                "Tell a supervisor, HR, or trusted specialist",
                "Respond with similar comments",
              ],
              answer: 1,
            },
          ]),
        ],
      },
    ],
  },
];
