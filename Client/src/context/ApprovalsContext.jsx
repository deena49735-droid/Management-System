import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const ApprovalsContext = createContext({
  pendingCount: 0,
  refreshPendingCount: async () => {},
  decrementPendingCount: () => {},
  setPendingCount: () => {},
});

export const ApprovalsProvider = ({ children }) => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const isFetchingRef = useRef(false);

  const currentRole = user?.role;

  const refreshPendingCount = useCallback(async () => {
    if (!currentRole || (currentRole !== 'teamHead' && currentRole !== 'teamAssistant')) {
      setPendingCount(0);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (currentRole === 'teamHead') {
        const [memberRes, teamRes] = await Promise.all([
          api.get('/entries', { params: { status: 'pending', _t: Date.now() } }),
          api.get('/team-entries', { params: { status: 'pending', _t: Date.now() } }),
        ]);
        const membersList = memberRes.data?.data || [];
        const teamList = teamRes.data?.data || [];
        const total = membersList.length + teamList.length;
        setPendingCount(total);
      } else if (currentRole === 'teamAssistant') {
        const memberRes = await api.get('/entries', {
          params: { status: 'pending', _t: Date.now() },
        });
        const entries = memberRes.data?.data || [];
        const actionable = entries.filter((e) => e.canActOnMine !== false);
        setPendingCount(actionable.length);
      }
    } catch {
      // Ignore background sync errors
    } finally {
      isFetchingRef.current = false;
    }
  }, [currentRole]);

  const decrementPendingCount = useCallback((amount = 1) => {
    setPendingCount((prev) => Math.max(0, prev - amount));
  }, []);

  // Sync on mount or when user role changes
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Listen for cross-component approval update events
  useEffect(() => {
    const handleApprovalChanged = () => {
      refreshPendingCount();
    };

    window.addEventListener('kadambas:approvals-changed', handleApprovalChanged);
    return () => {
      window.removeEventListener('kadambas:approvals-changed', handleApprovalChanged);
    };
  }, [refreshPendingCount]);

  const value = {
    pendingCount,
    setPendingCount,
    decrementPendingCount,
    refreshPendingCount,
  };

  return <ApprovalsContext.Provider value={value}>{children}</ApprovalsContext.Provider>;
};

export const useApprovals = () => useContext(ApprovalsContext);
