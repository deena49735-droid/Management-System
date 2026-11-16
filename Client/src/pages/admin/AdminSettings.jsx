import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { User, Lock, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Badge from '../../components/Badge';
import Avatar from '../../components/Avatar';

const AdminSettings = () => {
  const { user, refreshUser } = useAuth();

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    phone: user?.phone || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Keep profileForm in sync with auth user
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        username: user.username || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');

    const cleanName = profileForm.name.trim();
    const cleanUsername = profileForm.username.trim().toLowerCase();
    const cleanPhone = profileForm.phone.trim();

    if (!cleanName || !cleanUsername || !cleanPhone) {
      setProfileError('Please fill in all profile fields.');
      return;
    }

    if (!/^[a-z0-9._]{3,30}$/.test(cleanUsername)) {
      setProfileError('Username must be 3-30 characters with lowercase letters, numbers, dot, or underscore.');
      return;
    }

    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      setProfileError('Phone number must be a valid 10-digit number.');
      return;
    }

    try {
      setProfileLoading(true);
      await api.put(`/users/${user._id}`, {
        name: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        role: 'admin', // Kept strictly as admin
      });

      toast.success('Profile updated successfully!');
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!passwordForm.newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match. Please verify your entries.');
      return;
    }

    try {
      setPasswordLoading(true);
      await api.patch(`/users/${user._id}/reset-password`, {
        password: passwordForm.newPassword,
      });

      toast.success('Password updated successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Admin settings"
        subtitle="Manage your personal profile details and security credentials."
      />

      {/* Profile Overview Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name} role="admin" size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{user?.name}</h2>
              <Badge role="admin" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              @{user?.username} • {user?.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto bg-slate-50 rounded-xl p-2.5 sm:px-3 sm:py-2 border border-slate-100 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>System Administrator Account</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Profile Information Card */}
        <Card>
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Profile information</h3>
              <p className="text-xs text-slate-500">Edit your administrator name and contact details</p>
            </div>
          </div>

          {profileError && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <Input
              label="Full name"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              placeholder="Administrator Name"
            />

            <div>
              <Input
                label="Username"
                required
                value={profileForm.username}
                onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                placeholder="admin"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Lowercase letters, numbers, dot, and underscore (3-30 chars).
              </p>
            </div>

            <Input
              label="Phone number (10 digits)"
              required
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="9876543210"
              maxLength={10}
            />

            {/* Read-Only Account Permissions Box */}
            <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Role:</span>
                <span className="font-semibold text-slate-800">Administrator (Locked)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Account Status:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 leading-relaxed">
                Admin roles cannot be changed and administrator accounts cannot be deactivated.
              </p>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={profileLoading} className="w-full">
                {profileLoading ? 'Saving...' : 'Save profile changes'}
              </Button>
            </div>
          </form>
        </Card>

        {/* 2. Password & Security Card */}
        <Card>
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Security & Password</h3>
              <p className="text-xs text-slate-500">Update your account login password</p>
            </div>
          </div>

          {passwordError && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                New password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password (min. 6 chars)"
                  className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 pr-10 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Must be at least 6 characters long.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirm new password <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
              />
            </div>

            <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-3 text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold block mb-0.5">Password recommendation:</span>
              Use a strong password that is not shared with any other accounts.
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={passwordLoading} className="w-full">
                {passwordLoading ? 'Updating password...' : 'Update password'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;

