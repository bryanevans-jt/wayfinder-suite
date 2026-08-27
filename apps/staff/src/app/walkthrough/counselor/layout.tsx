import { CounselorWalkthroughChrome } from "./counselor-walkthrough-chrome";

export default function CounselorWalkthroughLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CounselorWalkthroughChrome>{children}</CounselorWalkthroughChrome>;
}
