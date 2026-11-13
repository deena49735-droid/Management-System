import React from 'react';
import { Outlet } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';

const HeadLayout = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default HeadLayout;
