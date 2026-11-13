import React from 'react';
import { Outlet } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';

const AssistantLayout = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default AssistantLayout;
