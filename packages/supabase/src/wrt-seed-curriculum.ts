/**
 * Georgia statewide WRT curriculum seed (10 units × 3 lessons).
 * GVRA Policy §§6000.00–6000.02; plain language; rural + urban examples within lessons.
 * Admins can edit modules, lessons, and blocks after seed (including swapping video URLs).
 *
 * Legacy NTACT/ODEP starter lives in `wrt-seed-curriculum-legacy-ntact.ts` (not auto-loaded).
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
const ODEP_PROFESSIONALISM_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/professionalism.pdf";
const ODEP_NETWORKING_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/networking.pdf";
const ODEP_PROBLEM_PDF =
  "https://www.dol.gov/sites/dolgov/files/odep/topics/youth/softskills/problem.pdf";
const CFPB_BUDGET = "https://files.consumerfinance.gov/f/documents/cfpb_building_block_activities_budgeting.pdf";
const CDC_HANDWASHING = "https://www.cdc.gov/handwashing/pdf/handwashing-poster.pdf";
const JAN_HOME = "https://askjan.org/";
const EEOC_HARASSMENT = "https://www.eeoc.gov/youth/harassment";

/** ODEP “Skills to Pay the Bills” — public workforce readiness series (swap anytime in admin). */
const V_ODEP_COMM = "https://www.youtube.com/watch?v=X0voPlW2pSs";
const V_ODEP_TEAM = "https://www.youtube.com/watch?v=sMFh9QYFh2I";
const V_ODEP_ENTHUSIASM = "https://www.youtube.com/watch?v=-vk-99seC_I";
const V_ODEP_PROF = "https://www.youtube.com/watch?v=7dPWVjQSad4";

function quiz(
  title: string,
  questions: { q: string; options: string[]; answer: number }[]
): SeedBlock {
  return { block_type: "quiz", title, meta: { questions } };
}

const RURAL_URBAN_LINE =
  "Where examples differ (MARTA vs. county dial-a-ride, busy retail vs. small employer), discuss both so clients recognize urban and rural settings.";

function lessonPhases(opts: {
  warmBody: string;
  coreBody: string;
  video?: { title: string; url: string };
  appliedBody: string;
  wrapBody: string;
  printable?: { title: string; url: string };
  extraBlocks?: SeedBlock[];
}): SeedBlock[] {
  const blocks: SeedBlock[] = [
    {
      block_type: "rich_text",
      title: "Warm-Up / Anchor (~10 minutes)",
      body: opts.warmBody,
    },
    {
      block_type: "rich_text",
      title: "Core Instruction (~15 minutes)",
      body: opts.coreBody,
    },
  ];
  if (opts.video) {
    blocks.push({
      block_type: "youtube",
      title: opts.video.title,
      url: opts.video.url,
    });
  }
  blocks.push(
    {
      block_type: "rich_text",
      title: "Applied Activity (~20 minutes)",
      body: opts.appliedBody,
    },
    {
      block_type: "activity",
      title: "Facilitation notes for ES/TS",
      body:
        "Printable handouts below are optional — clients may write on paper while you advance slides on TV/tablet. For 1:1, you may type short notes into contact logs after the session.",
    },
    {
      block_type: "rich_text",
      title: "Wrap-Up / Formative check (~15 minutes)",
      body: opts.wrapBody,
    }
  );
  if (opts.printable) {
    blocks.push({
      block_type: "pdf_link",
      title: opts.printable.title,
      url: opts.printable.url,
    });
  }
  if (opts.extraBlocks?.length) {
    blocks.push(...opts.extraBlocks);
  }
  return blocks;
}

export const WRT_SEED_CURRICULUM: SeedModule[] = [
  {
    slug: "gvra-u1-understanding-self",
    title: "Unit 1 — Understanding Self, Strengths & Vocational Identity",
    description:
      "Personal strengths, navigating limitations with dignity, and informed choice for Georgia pathways (GVRA §6000.02: self-understanding, work attitudes, informed choice).",
    citations: "GVRA Policy 6000.02 — Understanding of self & abilities; Work attitudes; Informed choice.",
    lessons: [
      {
        slug: "u1-l1-discovering-strengths",
        title: "Lesson 1.1 — Discovering My Personal Strengths and Talents",
        objectives:
          "Identify at least three personal strengths and two practical talents; connect one talent to a work task.",
        desired_outcomes:
          "Participant completes a strengths sort (paper or discussion) and states one strength linked to a job task.",
        facilitator_notes: `60-minute flow. ${RURAL_URBAN_LINE} Group size up to 10 per GVRA 6000.01.`,
        citations: "GVRA §6000.02 — Self-understanding & self-worth.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Strengths Spotlight: show a relatable worker (stock clerk, warehouse associate, or front-desk role). Ask: What does this person do well? Say clearly: everyone has natural strengths even when school or past jobs were hard.",
          coreBody:
            "Teach **hard skills** (learned tasks like scanning, typing, using tools) vs **character strengths** (honest, patient, organized). Use plain language and examples from retail, food service, logistics, and small-town employers.",
          video: { title: "Workplace communication & attitude (video model)", url: V_ODEP_COMM },
          appliedBody:
            "My Top 3 Strengths: use trait cards or a written list of ~20 workplace traits. Each participant picks three “power strengths” and pairs each with a concrete task (example: Detail-oriented → checking dates on stock).",
          wrapBody:
            "Exit ticket (write, dictate, or ES records): “One strength I bring to a Georgia employer is ___, which helps when doing ___.”",
          printable: { title: "ODEP Soft Skills workbook (PDF, optional print)", url: ODEP_SOFT_SKILLS_PDF },
          extraBlocks: [
            quiz("Quick check", [
              {
                q: "A character strength is:",
                options: [
                  "Only a certificate from training",
                  "A trait like honesty or patience that shows how you work with others",
                  "The same as a hard skill",
                ],
                answer: 1,
              },
            ]),
          ],
        }),
      },
      {
        slug: "u1-l2-functional-limitations",
        title: "Lesson 1.2 — Navigating Functional Limitations with Pride",
        objectives:
          "Tell the difference between a limitation and personal failure; name two adaptive strategies for a real barrier.",
        desired_outcomes:
          "Participant names one barrier and one “bridge” (tool, request, or routine) they will use at work.",
        facilitator_notes:
          "Use “glasses for blurry vision” analogy — accommodations are normal. Avoid medical diagnosis talk unless the client brings it up.",
        citations: "GVRA §6000.02 — Life patterns; healthy self-worth; coping with stereotypes.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Ask: When vision is blurry, are glasses “cheating”? Connect: many workers use tools and supports — that is expected.",
          coreBody:
            "Explain **functional limitation** in plain words (energy, memory, sensory load, mobility) vs blaming the person. Reframe “I can’t” → “I do best when I have ___.”",
          video: { title: "Professional attitude & resilience (video model)", url: V_ODEP_ENTHUSIASM },
          appliedBody:
            "Building the Bridge: match examples — memory fatigue → checklist; loud floor → quiet zone or approved ear protection per employer; mobility fatigue → pacing or rest breaks. Include rural jobs (longer walks on site, fewer transit options).",
          wrapBody:
            "Each participant identifies one limitation and writes or states their chosen bridge strategy.",
          printable: { title: "ODEP Problem solving activities (PDF)", url: ODEP_PROBLEM_PDF },
          extraBlocks: [
            quiz("Quick check", [
              {
                q: "An accommodation at work is:",
                options: [
                  "A way to avoid work",
                  "A tool or change that helps you meet job expectations",
                  "Only for school, not jobs",
                ],
                answer: 1,
              },
            ]),
          ],
        }),
      },
      {
        slug: "u1-l3-informed-choice-goals",
        title: "Lesson 1.3 — Informed Choice and Setting Realistic Vocational Goals",
        objectives:
          "Compare two Georgia career pathways using tasks, setting, and schedule; rank interest using a simple scale.",
        desired_outcomes:
          "Participant picks one pathway and gives two reasons tied to their goals (not just pay).",
        facilitator_notes:
          "Use Would You Rather warm-up (indoor/outdoor, quiet/busy, talk vs. solo). Mention high-demand sectors in GA without promising placement.",
        citations: "GVRA §6000.02 — Informed choice; work exploration.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Would You Rather (workplace): sun vs. air conditioning; customers all day vs. sorting in back; fixed schedule vs. rotating shifts.",
          coreBody:
            "Informed choice = knowing tasks, demands on body and senses, typical schedule, and growth paths — then deciding what fits now.",
          video: { title: "Teamwork & cooperation at work (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Career Match-Up: compare two fields (e.g., distribution/warehouse vs. hospitality housekeeping vs. local retail). Rate physical demands, social contact, schedule, personal interest (1–5 stars). Discuss rural commute vs. urban transit in the same lesson.",
          wrapBody:
            "Participant selects the better fit of the two and records two reasons (text or ES-entered note).",
          printable: { title: "ODEP Networking & workplace relationships (PDF)", url: ODEP_NETWORKING_PDF },
        }),
      },
    ],
  },
  {
    slug: "gvra-u2-interpersonal-communication",
    title: "Unit 2 — Interpersonal Skills & Professional Communication",
    description:
      "Verbal and non-verbal communication, listening for multi-step tasks, and tone by audience (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Interpersonal skills; Appropriate communication methods.",
    lessons: [
      {
        slug: "u2-l1-verbal-nonverbal",
        title: "Lesson 2.1 — Verbal vs. Non-Verbal Workplace Communication",
        objectives:
          "Name four non-verbal cues; demonstrate a four-step professional greeting.",
        desired_outcomes:
          "Participant performs or records a short greeting with appropriate posture and volume.",
        facilitator_notes:
          "Demonstrate two entrances (closed vs. open body). Respect cultural differences around eye contact — offer “bridge of nose” alternative.",
        citations: "GVRA §6000.02 — Communication methods; interpersonal skills.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Contrast two entrances: slouch/mumble vs. upright/clear greeting. Which person would you want on the floor with customers?",
          coreBody:
            "Cover personal space (~arm’s length), facial expression, posture, and voice levels (whisper → floor voice → meeting voice).",
          video: { title: "Communication basics (video model)", url: V_ODEP_COMM },
          appliedBody:
            "Professional Hello role-play: upright posture, comfortable eye contact or bridge-of-nose, neutral/warm face, script: “Good morning, [Name], how are you today?” Pairs or facilitator-led.",
          wrapBody:
            "Peer check or 10-second practice recording; simple rubric: posture, space, volume, face/eyes.",
          printable: { title: "ODEP Communication activities (PDF)", url: ODEP_COMMUNICATION_PDF },
        }),
      },
      {
        slug: "u2-l2-active-listening",
        title: "Lesson 2.2 — Active Listening and Following Multi-Step Instructions",
        objectives:
          "Use listen → write/picture → confirm to carry out a three-step work instruction.",
        desired_outcomes:
          "Participant repeats back three steps before starting, then completes the task.",
        facilitator_notes:
          "Workplace Telephone demo: one whisper chain to show message decay. Keep materials simple (folders, envelopes, bins).",
        citations: "GVRA §6000.02 — Adaptive training; interpersonal skills.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Short game: pass a verbal message around the group — show how it changes without write-backs.",
          coreBody:
            "Three-step listening: listen; jot a keyword or picture the steps; confirm — “Just to make sure: First ___, then ___, finally ___.”",
          video: { title: "Teamwork & clear handoffs (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Multi-Step Challenge: Level 1 — two blue folders, stamp, side table. Level 2 — sort by date, staple corner, green bin. Client repeats steps before touching materials.",
          wrapBody:
            "Cold call: new three-step command. Track Mastered (3/3) vs. Needs reteaching.",
          printable: { title: "ODEP Teamwork activities (PDF)", url: ODEP_TEAMWORK_PDF },
          extraBlocks: [
            quiz("Quick check", [
              {
                q: "Before you start a multi-step task, you should:",
                options: [
                  "Start quickly to look busy",
                  "Repeat the steps in your own words to confirm",
                  "Ignore details you did not hear",
                ],
                answer: 1,
              },
            ]),
          ],
        }),
      },
      {
        slug: "u2-l3-audience-supervisor-peer-customer",
        title: "Lesson 2.3 — Supervisors, Co-Workers, and Customers",
        objectives:
          "Choose appropriate tone and content for supervisor, peer, and customer situations.",
        desired_outcomes:
          "Participant sorts phrases into three audience buckets with 100% accuracy on supervisor items.",
        facilitator_notes:
          "Three Communication Zones — supervisor (concise, respectful), peer (friendly, work-focused), customer (patient, redirect when needed).",
        citations: "GVRA §6000.02 — Communication; workplace behavior.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Would you use the same tone with your best friend and with a manager giving a safety reminder?",
          coreBody:
            "Teach boundaries: supervisors need status updates; peers avoid private drama on the clock; customers need polite, on-task help.",
          video: { title: "Professionalism on the job (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Message Makeover: rewrite blunt lines into professional language for each audience (provide 4–6 examples).",
          wrapBody:
            "Sort six short phrases into Supervisor / Peer / Customer; require perfect supervisor bucket before ending.",
          printable: { title: "ODEP Professionalism activities (PDF)", url: ODEP_PROFESSIONALISM_PDF },
        }),
      },
    ],
  },
  {
    slug: "gvra-u3-boundaries-professionalism",
    title: "Unit 3 — Boundaries, Professionalism & Sexual Appropriateness",
    description:
      "Physical boundaries, safe topics, and harassment awareness with plain-language reporting (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Sexual awareness & appropriateness; Interpersonal skills.",
    lessons: [
      {
        slug: "u3-l1-personal-space",
        title: "Lesson 3.1 — Personal Space and Physical Boundaries at Work",
        objectives:
          "State the handshake rule; identify impermissible workplace touch with 100% accuracy on scenarios.",
        desired_outcomes:
          "Participant places coworkers in the “work-appropriate” boundary and practices a respectful phrase if space feels too close.",
        facilitator_notes:
          "Use hula-hoop or arm’s-length demo. Be explicit about workplace rules without shaming.",
        citations: "GVRA §6000.02 — Personal & social behaviors.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody: "Hula-hoop or rope circle: who should step inside at work, and when?",
          coreBody:
            "Appropriate: handshake, fist bump if employer allows, wave. Not appropriate: hugs, hair touch, blocking paths, standing inside personal bubble without reason.",
          video: { title: "Professional boundaries & respect (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Relationship circles: map self, family, friends, coworkers, public — stress coworkers are not the same as close friends. Script: “Please step back — I like a little space.”",
          wrapBody:
            "Five-question scenario check — all correct before pass; offer retake with support.",
          printable: { title: "ODEP Soft Skills workbook (PDF)", url: ODEP_SOFT_SKILLS_PDF },
        }),
      },
      {
        slug: "u3-l2-safe-topics",
        title: "Lesson 3.2 — Workplace-Appropriate Conversation Topics",
        objectives:
          "Classify examples into green-light (work-safe) vs red-light (private/off-limits) topics.",
        desired_outcomes:
          "Participant sorts 6–10 cards with rationale (weather vs. medical details, etc.).",
        facilitator_notes:
          "Water cooler examples: movies vs. dating life. Stay neutral — goal is comfort and safety for everyone.",
        citations: "GVRA §6000.02 — Social appropriateness.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Two snippets: favorite movie vs. probing personal relationship questions — which belongs at work?",
          coreBody:
            "Red-light examples: romantic/sexual content, graphic health, religion/politics debates, bank balances, gossip that tears people down. Green-light: weather, hobbies, sports, pets, work tasks.",
          video: { title: "Communication & respect (video model)", url: V_ODEP_COMM },
          appliedBody:
            "Traffic-light sort: read prompts; clients hold green/red or call out — explain briefly.",
          wrapBody:
            "Independent sort of six written topics into Talk at work / Keep for home.",
          printable: { title: "ODEP Communication activities (PDF)", url: ODEP_COMMUNICATION_PDF },
          extraBlocks: [
            quiz("Quick check", [
              {
                q: "Which is usually a work-safe small-talk topic?",
                options: ["A coworker’s dating life", "Weekend plans in general", "Someone’s medical diagnosis"],
                answer: 1,
              },
            ]),
          ],
        }),
      },
      {
        slug: "u3-l3-harassment-stop-report",
        title: "Lesson 3.3 — Recognizing and Responding to Sexual Harassment",
        objectives:
          "Name two examples of harassment; state Stop — Report — Tell a trusted adult/work leader; know who to tell.",
        desired_outcomes:
          "Participant completes a simple safety plan with supervisor/HR/coach contacts.",
        facilitator_notes:
          "Trauma-informed pace; allow breaks. Link to EEOC youth resource for definitions.",
        citations: "GVRA §6000.02 — Rights & responsibilities; workplace safety.",
        default_duration_minutes: 60,
        blocks: [
          {
            block_type: "rich_text",
            title: "Warm-Up / Anchor (~10 minutes)",
            body:
              "Comfortable vs. uncomfortable: body clues (knot in stomach, wanting to leave). Normalize seeking help.",
          },
          {
            block_type: "rich_text",
            title: "Core Instruction (~15 minutes)",
            body:
              "Plain definition: unwelcome words, touches, or images of a sexual nature that make work feel unsafe. Examples: comments about body, repeated asks after “no,” sharing inappropriate photos. Protocol: clearly say stop if you can; move to a safe place; tell supervisor, HR, or GVRA/job coach. Link below is optional reading for facilitators/clients.",
          },
          {
            block_type: "external_link",
            title: "EEOC — Harassment basics (reference)",
            url: EEOC_HARASSMENT,
          },
          {
            block_type: "rich_text",
            title: "Applied Activity (~20 minutes)",
            body:
              "Complete “My Safety Plan” lines: trusted person at work, GVRA contact, words to say if uncomfortable. No requirement to disclose private details aloud.",
          },
          {
            block_type: "rich_text",
            title: "Wrap-Up / Formative check (~15 minutes)",
            body:
              "Exit: “If someone crossed a line, what are two steps you take?” Accept written, verbal, or ES-recorded answers.",
          },
          {
            block_type: "pdf_link",
            title: "ODEP Professionalism & workplace relationships (PDF)",
            url: ODEP_PROFESSIONALISM_PDF,
          },
          quiz("Quick check", [
            {
              q: "If harassment happens at work, you should:",
              options: [
                "Stay silent so you do not make waves",
                "Tell a trusted supervisor, HR, or your job coach",
                "Only tell friends on social media",
              ],
              answer: 1,
            },
          ]),
        ],
      },
    ],
  },
  {
    slug: "gvra-u4-grooming-hygiene",
    title: "Unit 4 — Grooming, Hygiene & Workplace Presentation",
    description:
      "Daily hygiene, dress codes by sector, and on-the-clock routines (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Grooming & hygiene; Workplace habits.",
    lessons: [
      {
        slug: "u4-l1-daily-hygiene",
        title: "Lesson 4.1 — Daily Personal Hygiene Routines for Work",
        objectives:
          "Build a six-step morning hygiene sequence appropriate to sensory needs and job type.",
        desired_outcomes:
          "Participant orders steps correctly and completes a one-day self-check.",
        facilitator_notes:
          "Discuss scent sensitivity — unscented products. Avoid shaming; focus on job expectations.",
        citations: "GVRA §6000.02 — Grooming & hygiene.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Sensory impact in tight spaces — kitchens, small offices, shared vehicles to work.",
          coreBody:
            "Daily bathing, deodorant, oral care, clean clothes, hair care; perfume/cologne do not replace hygiene and may trigger allergies.",
          video: { title: "Professionalism & attitude (video model)", url: V_ODEP_ENTHUSIASM },
          appliedBody:
            "Sequence strips: shower, deodorant, teeth, clean clothes, hair comb, hand wash — personalize morning vs. night shower.",
          wrapBody:
            "Self-audit checklist for tomorrow’s shift (yes/no prompts).",
          printable: { title: "CDC handwashing poster (PDF)", url: CDC_HANDWASHING },
        }),
      },
      {
        slug: "u4-l2-dress-codes-ppe",
        title: "Lesson 4.2 — Dress Codes, Uniforms & Safety Gear",
        objectives:
          "Match attire and PPE to food service, warehouse/trade, and office/customer settings.",
        desired_outcomes:
          "Participant completes a matching worksheet for six roles.",
        facilitator_notes:
          "Bring or show photos of clean vs. stained clothes; closed-toe shoes; hair restraints.",
        citations: "GVRA §6000.02 — Presentation; safety.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Compare photos: flip-flops and graphics vs. closed-toe shoes and neat polo — who is ready for warehouse or kitchen?",
          coreBody:
            "Three common codes: safety-first (boots, hi-vis), hospitality/retail uniform, business casual. Garments must be clean, fit, and job-appropriate.",
          video: { title: "Professionalism on the job (video model)", url: V_ODEP_PROF },
          appliedBody:
            "PPE touch table if available: safety glasses, hairnet, non-slip shoe talk-through.",
          wrapBody:
            "Match six roles to required clothing/PPE.",
          printable: { title: "ODEP Professionalism (PDF)", url: ODEP_PROFESSIONALISM_PDF },
        }),
      },
      {
        slug: "u4-l3-hygiene-on-the-clock",
        title: "Lesson 4.3 — Hygiene Maintenance During the Shift",
        objectives:
          "List handwashing moments; pack a small ‘fresh kit’ for long shifts.",
        desired_outcomes:
          "Participant lists three wash moments and two items for a personal kit.",
        facilitator_notes:
          "Include rural/long-shift reality — fewer stores nearby, plan ahead.",
        citations: "GVRA §6000.02 — Personal & social skills.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Glitter/germ analogy: hands transfer to food, screens, customers.",
          coreBody:
            "Wash after restroom, breaks/eating, before tasks touching food or shared tools. Brief mirror check before floor return.",
          video: { title: "Teamwork & customer-facing roles (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Build a Fresh Kit: travel toothbrush, floss picks, wipes, comb, mints (policy on gum per employer). Practice 20-second wash timing.",
          wrapBody:
            "Exit: name three handwash moments on shift.",
          printable: { title: "CDC handwashing poster (PDF)", url: CDC_HANDWASHING },
        }),
      },
    ],
  },
  {
    slug: "gvra-u5-mobility-travel",
    title: "Unit 5 — Community Mobility & Travel Training",
    description:
      "Reading schedules, safe pedestrian habits, delay protocols — Metro Atlanta and rural Georgia (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Travel training; Ambulation & environment.",
    lessons: [
      {
        slug: "u5-l1-transit-basics",
        title: "Lesson 5.1 — Transit Basics in Georgia (Urban & Rural)",
        objectives:
          "Find route numbers, direction of travel, and transfer points on a simple map or timetable.",
        desired_outcomes:
          "Participant traces A→B with one transfer on a sample map (MARTA and/or county rural flex).",
        facilitator_notes:
          "If local maps are available, substitute. Discuss Breeze card vs. cash; paratransit booking windows in rural areas.",
        citations: "GVRA §6000.02 — Travel training.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Brainstorm ways workers arrive without driving: bus, rail, vanpool, coworker ride, bike/walk.",
          coreBody:
            "Read route number, direction, major stops, Sunday schedules vs. weekday. Urban: rail + bus transfers. Rural: dial-a-ride, deviated fixed-route, fewer runs — plan buffer time.",
          video: { title: "Clear communication in fast environments (video model)", url: V_ODEP_COMM },
          appliedBody:
            "Map exercise: label boarding stop, transfer, arrival; compare travel time urban vs. rural trip example in lesson notes.",
          wrapBody:
            "Exit: write route number and target arrival time for a sample schedule question.",
          printable: { title: "ODEP Problem solving (PDF) — backup planning", url: ODEP_PROBLEM_PDF },
        }),
      },
      {
        slug: "u5-l2-pedestrian-safety",
        title: "Lesson 5.2 — Safe Walking, Signals, and Awareness",
        objectives:
          "Name five pedestrian rules; spot hazards in a described street scene.",
        desired_outcomes:
          "Participant scores 4/4 on a short signal quiz.",
        facilitator_notes:
          "Discuss headphones volume, crosswalk countdown, stranger-distance on transit platforms.",
        citations: "GVRA §6000.02 — Ambulation & safety.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "What can go wrong walking while distracted?",
          coreBody:
            "Left-right-left, use crosswalks, wait for walk signal, stand behind platform line, keep belongings secure.",
          video: { title: "Professional habits & attentiveness (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Hazard hunt on a printed or described transit plaza — circle unsafe behaviors.",
          wrapBody:
            "Four-question picture/text quiz on signals.",
          printable: { title: "ODEP Soft Skills workbook (PDF)", url: ODEP_SOFT_SKILLS_PDF },
        }),
      },
      {
        slug: "u5-l3-delays-emergencies",
        title: "Lesson 5.3 — Delays, Missed Stops & Emergencies",
        objectives:
          "Follow Calm Commuter steps for late arrival; know who to call when lost.",
        desired_outcomes:
          "Participant delivers a late-arrival script with reason and ETA.",
        facilitator_notes:
          "Stress calling supervisor as soon as you know — many GA jobs require 15+ minutes notice when possible.",
        citations: "GVRA §6000.02 — Problem solving; routine changes.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Bus late 20 minutes; shift in 10 — panic or plan?",
          coreBody:
            "Four steps: breathe/assess → check app or ask driver → call supervisor with ETA → stay visible/safe; add job coach/GVRA if truly lost.",
          video: { title: "Teamwork under pressure (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Role-play late-arrival call to supervisor using a script card.",
          wrapBody:
            "Repeat script including apology and ETA.",
          printable: { title: "ODEP Problem solving (PDF)", url: ODEP_PROBLEM_PDF },
        }),
      },
    ],
  },
  {
    slug: "gvra-u6-problem-solving",
    title: "Unit 6 — Workplace Problem Solving, Decisions & Coping",
    description:
      "S.T.O.P. framework, receiving feedback, and de-escalation for schedule changes (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Decision making; Coping & supervision.",
    lessons: [
      {
        slug: "u6-l1-stop-model",
        title: "Lesson 6.1 — The S.T.O.P. Workplace Problem-Solving Model",
        objectives:
          "Apply Stop → Think → Options → Proceed to three common workplace snags.",
        desired_outcomes:
          "Participant writes options + chosen proceed for one scenario card.",
        facilitator_notes:
          "Use low-stakes props (pens on floor) for the warm-up spill story.",
        citations: "GVRA §6000.02 — Problem solving.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Pens scatter before a customer — freeze vs. grab broom/ask teammate.",
          coreBody:
            "S.T.O.P.: pause, name problem, list two realistic options, pick the professional one.",
          video: { title: "Problem solving habits (video context)", url: V_ODEP_TEAM },
          appliedBody:
            "Scenario lab: receipt paper empty; lunch mix-up; spill on paperwork — small groups fill S.T.O.P. grid.",
          wrapBody:
            "Individual pick: one card, write Option + Proceed.",
          printable: { title: "ODEP Problem solving (PDF)", url: ODEP_PROBLEM_PDF },
        }),
      },
      {
        slug: "u6-l2-constructive-feedback",
        title: "Lesson 6.2 — Handling Constructive Feedback and Supervision",
        objectives:
          "Tell feedback apart from insults; use Listen → Acknowledge → Adjust.",
        desired_outcomes:
          "Participant practices three-step response to mild correction.",
        facilitator_notes:
          "Coach analogy — supervisor wants quality, not personal attack.",
        citations: "GVRA §6000.02 — Receptivity to supervision.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Sports coach adjusts grip — is that insult or help?",
          coreBody:
            "Why feedback exists. Three steps: listen without interrupting; thank or acknowledge; ask clarification and adjust.",
          video: { title: "Professionalism & feedback (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Fold drill: facilitator gives neutral corrections (fold shirts tag-down). Client responds with the three-step script.",
          wrapBody:
            "Self-rate difficulty receiving feedback 1–5; name one calming tool.",
          printable: { title: "ODEP Professionalism (PDF)", url: ODEP_PROFESSIONALISM_PDF },
        }),
      },
      {
        slug: "u6-l3-flexibility-frustration",
        title: "Lesson 6.3 — Schedule Changes, Redirections & Frustration",
        objectives:
          "Recognize early body signs of frustration; pick two on-the-job calming strategies.",
        desired_outcomes:
          "Participant completes a Calm at Work card and demonstrates one breathing technique.",
        facilitator_notes:
          "Offer break-card language aligned with employer policy.",
        citations: "GVRA §6000.02 — Rigidity; coping strategies.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Body clues before anger — jaw, fists, heat in face.",
          coreBody:
            "Box breathing; short water walk if allowed; self-talk: ‘Change in plans — I can do the next step.’",
          video: { title: "Enthusiasm & attitude under stress (video model)", url: V_ODEP_ENTHUSIASM },
          appliedBody:
            "Personal Coping Plan card: warning sign, two-minute tool, how to ask supervisor for brief pause.",
          wrapBody:
            "Demonstrate one breath pattern aloud with group.",
          printable: { title: "ODEP Problem solving (PDF)", url: ODEP_PROBLEM_PDF },
        }),
      },
    ],
  },
  {
    slug: "gvra-u7-financial-literacy",
    title: "Unit 7 — Workplace Financial Literacy & Money Management",
    description:
      "Pay stubs, banking basics, and simple budgeting (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Money management; Daily life decisions.",
    lessons: [
      {
        slug: "u7-l1-pay-stub-basics",
        title: "Lesson 7.1 — Gross vs. Net Pay, Taxes & Deductions",
        objectives:
          "Locate gross, net, and common deductions on a sample Georgia pay stub.",
        desired_outcomes:
          "Participant answers which amount deposits to the bank and why net is smaller.",
        facilitator_notes:
          "Use rounded fake numbers; not tax advice.",
        citations: "GVRA §6000.02 — Money management.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "10 hours × $10 = $100 — will the check equal $100? Why not?",
          coreBody:
            "Gross = before deductions; deductions include federal, Georgia state, FICA; net = take-home.",
          video: { title: "Professionalism & responsibility (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Highlight scavenger hunt on sample stub: gross (yellow), taxes (red box concept), net (green).",
          wrapBody:
            "Three questions: bank gets gross or net? Where is net? One reason net is smaller.",
          printable: { title: "CFPB budgeting activity (PDF)", url: CFPB_BUDGET },
        }),
      },
      {
        slug: "u7-l2-banking-debit",
        title: "Lesson 7.2 — Direct Deposit, Checking & Debit Safety",
        objectives:
          "Contrast checking vs. savings; explain PIN protection and direct deposit.",
        desired_outcomes:
          "Participant spots safe vs. unsafe card/PIN behaviors.",
        facilitator_notes:
          "No real account numbers in class; use blanks.",
        citations: "GVRA §6000.02 — Independent living; money safety.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Safest place for paycheck — cash in pocket vs. insured account.",
          coreBody:
            "Direct deposit flow; checking for spending; savings for goals/emergencies; shield PIN; never share PIN with coworkers.",
          video: { title: "Teamwork & trust (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Role-play ATM keypad shield; mark sample form fields for routing/account.",
          wrapBody:
            "Quiz: safe vs. unsafe behaviors (PIN on card, balance check on official app, etc.).",
          printable: { title: "CFPB budgeting activity (PDF)", url: CFPB_BUDGET },
        }),
      },
      {
        slug: "u7-l3-needs-wants-budget",
        title: "Lesson 7.3 — Needs vs. Wants & Simple Budget",
        objectives:
          "Sort expenses; split a sample paycheck across needs, savings, and wants.",
        desired_outcomes:
          "Participant funds all needs without negative balance on paper exercise.",
        facilitator_notes:
          "Use $300 sample; include rural gas/longer commute line item in discussion.",
        citations: "GVRA §6000.02 — Money management.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Apple vs. candy bar — need vs. want framing.",
          coreBody:
            "Needs: housing, utilities, food, transit, phone for work, medicine. Wants: extras. Three jars method: needs / savings / fun.",
          video: { title: "Communication about money choices (video model)", url: V_ODEP_COMM },
          appliedBody:
            "Envelope or table budget with play dollars — pay needs first, then allocate savings and wants.",
          wrapBody:
            "Submit plan photo or ES tally — needs must balance.",
          printable: { title: "CFPB budgeting activity (PDF)", url: CFPB_BUDGET },
        }),
      },
    ],
  },
  {
    slug: "gvra-u8-health-wellness",
    title: "Unit 8 — Health, Energy & Medication Management on the Job",
    description:
      "Med timing around shifts, fueling the body, safe lifting (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Health & medicine; Workplace stamina.",
    lessons: [
      {
        slug: "u8-l1-med-scheduling",
        title: "Lesson 8.1 — Prescriptions, Labels & Shift Alignment",
        objectives:
          "Read warning labels; plan reminders that respect shift tasks.",
        desired_outcomes:
          "Participant states one reminder method and one privacy boundary with coworkers.",
        facilitator_notes:
          "No med names required aloud; focus on schedule patterns.",
        citations: "GVRA §6000.02 — Health management.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Drowsy medication before equipment — why timing matters.",
          coreBody:
            "Label basics: with food, morning/night, drowsy warnings; alarms, pillbox, coach check-in; privacy — coworkers do not need diagnosis details.",
          video: { title: "Professional responsibility (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Sketch 24-hour timeline: sleep, shift, meals, med slots (generic).",
          wrapBody:
            "State reminder plan in one sentence.",
          printable: { title: "ODEP Problem solving (PDF)", url: ODEP_PROBLEM_PDF },
        }),
      },
      {
        slug: "u8-l2-nutrition-hydration",
        title: "Lesson 8.2 — Stamina, Nutrition & Hydration",
        objectives:
          "Pick balanced shift meals/snacks; set a simple water goal.",
        desired_outcomes:
          "Participant builds one lunch + two snacks that avoid sugar crash.",
        facilitator_notes:
          "Acknowledge food access differences urban vs. rural convenience stores.",
        citations: "GVRA §6000.02 — Health & stamina.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Donut + energy drink vs. sandwich + fruit + water — how you feel hour 4.",
          coreBody:
            "Steady fuel, hydration, breaks where offered; pack insulated lunch for long rural commutes.",
          video: { title: "Energy & attitude (video model)", url: V_ODEP_ENTHUSIASM },
          appliedBody:
            "Pantry pick: build a meal + two snacks from printed options.",
          wrapBody:
            "Exit: two snacks that hold energy without heavy sugar.",
          printable: { title: "CFPB budgeting (food & meal planning tie-in)", url: CFPB_BUDGET },
        }),
      },
      {
        slug: "u8-l3-safe-lifting-ergonomics",
        title: "Lesson 8.3 — Safe Lifting, Posture & Asking for Help",
        objectives:
          "Demonstrate five-step safe lift; request team lift using a script.",
        desired_outcomes:
          "Participant performs lift steps with a light prop and says the team-lift ask.",
        facilitator_notes:
          "Supervised practice only; empty/light boxes.",
        citations: "GVRA §6000.02 — Safety & self-advocacy.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Locked knees and twisted back vs. knees bent, load close.",
          coreBody:
            "Check weight, feet shoulder width, bend knees, neutral spine, turn feet not waist; ask: “This is heavy — can we team lift?”",
          video: { title: "Teamwork on physical tasks (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Practice with light props; ergonomic tweaks for chair/desk mock.",
          wrapBody:
            "Rubric: five steps + team-lift phrase.",
          printable: { title: "ODEP Problem solving (PDF)", url: ODEP_PROBLEM_PDF },
        }),
      },
    ],
  },
  {
    slug: "gvra-u9-independent-living-resources",
    title: "Unit 9 — Independent Living, Community Resources & Routines",
    description:
      "24-hour scheduling, assistive tech and Georgia resources, emergency cards (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Community living; Resource utilization.",
    lessons: [
      {
        slug: "u9-l1-daily-schedule",
        title: "Lesson 9.1 — Daily Routines & Reverse Planning",
        objectives:
          "Build a weekday schedule with commute buffer and sleep window.",
        desired_outcomes:
          "Participant states bedtime and wake time for a sample shift with 8 hours sleep target.",
        facilitator_notes:
          "Math forward from shift start; add rural drive time generously.",
        citations: "GVRA §6000.02 — Routines & time management.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Shift at 8:00, 45-minute ride, wake 7:30 — will it work?",
          coreBody:
            "Reverse plan: buffer, commute, breakfast/hygiene, alarm; prep night before (clothes, lunch, fare).",
          video: { title: "Professionalism & reliability (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Color-wheel or timeline worksheet for one realistic shift.",
          wrapBody:
            "Target bedtime/wake for sample 9 a.m. shift.",
          printable: { title: "ODEP Professionalism (PDF)", url: ODEP_PROFESSIONALISM_PDF },
        }),
      },
      {
        slug: "u9-l2-assistive-tech-resources",
        title: "Lesson 9.2 — Assistive Technology & Georgia Supports",
        objectives:
          "Name two AT tools and two Georgia-facing resources that help independence or work.",
        desired_outcomes:
          "Participant picks two tools/resources tied to personal goals.",
        facilitator_notes:
          "Mention GVRA, CILs, Tools for Life at high level — details in external link.",
        citations: "GVRA §6000.02 — Adaptive equipment; resource use.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Show speech-to-text or large text on phone — tools many workers use.",
          coreBody:
            "AT defined broadly: apps, grips, visual timers, hearing aids integration. Community orgs help test equipment.",
          video: { title: "Communication supports at work (video model)", url: V_ODEP_COMM },
          appliedBody:
            "Pick two items from categories: communication, sensory, mobility, memory.",
          wrapBody:
            "Exit slip: one org and one tool to explore.",
          printable: { title: "JAN — job accommodation ideas (web, print-friendly)", url: JAN_HOME },
        }),
      },
      {
        slug: "u9-l3-emergency-plans",
        title: "Lesson 9.3 — Emergency Planning & Community Resources",
        objectives:
          "Differentiate 911 vs. 988 vs. supervisor help; build a wallet card outline.",
        desired_outcomes:
          "Participant lists two emergencies vs. two non-emergencies correctly.",
        facilitator_notes:
          "Keep medical info optional on cards.",
        citations: "GVRA §6000.02 — Safety & resource navigation.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Fire vs. late bus — different responses.",
          coreBody:
            "911 for imminent danger; 988 mental health crisis; supervisor for worksite injury process; coach for logistics.",
          video: { title: "Team support & asking for help (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Fill emergency card: contacts, allergies optional, transit police when relevant.",
          wrapBody:
            "Explain when card is shown — consent and privacy.",
          printable: { title: "ODEP Problem solving (PDF)", url: ODEP_PROBLEM_PDF },
        }),
      },
    ],
  },
  {
    slug: "gvra-u10-rights-accommodations",
    title: "Unit 10 — Disability Rights, Accommodations & Career Supports",
    description:
      "ADA basics at work, accommodation scripts, GVRA team roles (GVRA §6000.02).",
    citations: "GVRA Policy 6000.02 — Rights & responsibilities; Supports planning.",
    lessons: [
      {
        slug: "u10-l1-ada-basics",
        title: "Lesson 10.1 — Rights and Responsibilities (ADA Intro)",
        objectives:
          "State one right and one responsibility on the job; define ADA in plain words.",
        desired_outcomes:
          "Participant sorts scenario cards into rights vs. responsibilities.",
        facilitator_notes:
          "Not legal advice; encourage questions to GVRA counselor.",
        citations: "GVRA §6000.02 — Knowledge of rights.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Short anchor: civil rights law helps qualified workers access jobs and reasonable accommodations.",
          coreBody:
            "Rights: apply/hire free from discrimination; reasonable accommodation; freedom from harassment. Responsibilities: essential job functions, safety rules, punctuality.",
          video: { title: "Professionalism & workplace expectations (video model)", url: V_ODEP_PROF },
          appliedBody:
            "Card sort: on time (responsibility); ask for stool for standing limit (right); follow PPE (responsibility).",
          wrapBody:
            "Exit: ADA stands for ___; name one protection.",
          printable: { title: "JAN — accommodation ideas", url: JAN_HOME },
        }),
      },
      {
        slug: "u10-l2-accommodation-request",
        title: "Lesson 10.2 — Requesting Reasonable Accommodations",
        objectives:
          "Draft a three-part script: strength — barrier — proposed support without oversharing diagnoses.",
        desired_outcomes:
          "Participant produces a short written or dictated request.",
        facilitator_notes:
          "Use functional language only.",
        citations: "GVRA §6000.02 — Supports planning; informed choice.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "You do not owe your whole medical file to get a tool that helps you work.",
          coreBody:
            "When to disclose: need for accommodation or safety. Formula: eager to do well → functional barrier → proposed tool/change.",
          video: { title: "Clear, respectful communication (video model)", url: V_ODEP_COMM },
          appliedBody:
            "Write/dictate one accommodation email outline with facilitator coaching.",
          wrapBody:
            "Read-back of three-part script.",
          printable: { title: "JAN — sample accommodation language (resource)", url: JAN_HOME },
        }),
      },
      {
        slug: "u10-l3-gvra-team",
        title: "Lesson 10.3 — Your GVRA Team & Natural Supports",
        objectives:
          "Name roles: VRC, job coach/ES, supervisor, natural supports; plan check-in habits.",
        desired_outcomes:
          "Participant lists who helps with which problem and one coaching reach-out line.",
        facilitator_notes:
          "Align with Joshua Tree roles actually on the case.",
        citations: "GVRA §6000.02 — Support planning.",
        default_duration_minutes: 60,
        blocks: lessonPhases({
          warmBody:
            "Even elite athletes use coaches — who is on your work team?",
          coreBody:
            "VRC authorizations; ES/TS training supports; supervisor sets tasks; natural supports are trusted friends/family for morale or rides — not HR replacements.",
          video: { title: "Teamwork & asking for help (video model)", url: V_ODEP_TEAM },
          appliedBody:
            "Map names (when known) next to roles; script reaching out before quitting a shift.",
          wrapBody:
            "Career Launch checkpoint: strengths card, transit/delay plan, emergency card, support contacts (integrate prior outputs if collected).",
          printable: { title: "ODEP Networking (PDF)", url: ODEP_NETWORKING_PDF },
        }),
      },
    ],
  },
];
