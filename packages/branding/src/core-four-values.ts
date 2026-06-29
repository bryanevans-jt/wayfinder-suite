export type CoreFourValue = {
  id: string;
  title: string;
  scriptures: string;
  summary: string;
  iconPath: string;
};

export const CORE_FOUR_VALUES: CoreFourValue[] = [
  {
    id: "strive-for-excellence",
    title: "Strive for Excellence",
    scriptures: "Colossians 3:23, Phil 4:8, Titus 2:7, Proverbs 22:29",
    summary:
      "We hold ourselves to the highest standards of quality and integrity in everything we do. For every team member, striving for excellence means bringing your best effort to work each day, maintaining meticulous attention to detail, and continuously seeking ways to elevate the level of care and service we deliver to our clients, partners, and communities.",
    iconPath: "/core-four/strive-for-excellence.png",
  },
  {
    id: "work-with-confidence",
    title: "Work with Confidence",
    scriptures: "Joshua 1:8-9, Ephesians 6:7-8, Phil 4:13, 2 Timothy 1:7",
    summary:
      "We approach our daily responsibilities with a strong sense of purpose, professionalism, and resilience. Working with confidence means taking full ownership of your assigned territory or role, trusting your training, making sound operational decisions, and remaining solution-oriented when navigating unexpected workplace challenges.",
    iconPath: "/core-four/work-with-confidence.png",
  },
  {
    id: "practice-discipline",
    title: "Practice Discipline",
    scriptures: "Hebrews 12:11, 1 Cor 9:24-27, Proverbs 12:1, 15:32, 25:28",
    summary:
      "Consistent, reliable execution is the foundation of our organizational impact. Practicing discipline company-wide means managing your schedule effectively, holding yourself personally accountable to your performance metrics, and strictly adhering to operational guidelines—including the prompt, accurate completion of all required documentation, tracking, and regulatory compliance timelines.",
    iconPath: "/core-four/practice-discipline.png",
  },
  {
    id: "lead-with-love",
    title: "Lead with Love",
    scriptures: "John 13:35, 1 Cor 13, 1 Peter 4:8",
    summary:
      "Leadership is an action, not a job title; every team member is expected to lead by example through a servant-hearted approach. Leading with love means treating colleagues, clients, and community partners with deep empathy and respect, resolving internal conflicts through direct and constructive communication, and actively protecting a positive, gossip-free work environment.",
    iconPath: "/core-four/lead-with-love.png",
  },
];
