import React from 'react';
import { Outlet } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';

const AdminLayout = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default AdminLayout;
