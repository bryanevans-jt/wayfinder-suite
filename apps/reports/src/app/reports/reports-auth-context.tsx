'use client';

import { createContext, useContext } from 'react';

export type ReportsUser = {
  email: string;
  displayName: string;
};

const ReportsAuthContext = createContext<ReportsUser | null>(null);

export function ReportsAuthProvider({
  user,
  children,
}: {
  user: ReportsUser;
  children: React.ReactNode;
}) {
  return (
    <ReportsAuthContext.Provider value={user}>
      {children}
    </ReportsAuthContext.Provider>
  );
}

export function useReportsAuth(): ReportsUser {
  const user = useContext(ReportsAuthContext);
  if (!user) {
    throw new Error('ReportsAuthProvider is required');
  }
  return user;
}
