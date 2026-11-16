import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  calculatePasswordStrength,
  checkPasswordRequirements,
  generateStrongPassword,
} from '../utils/passwordPolicy';

/**
 * Reusable Password Input with Live Strength Indicator, Live Requirements Checklist,
 * and Cryptographically Secure Password Suggestion generator.
 */
const PasswordInputWithStrength = ({
  value = '',
  onChange,
  userContext = {},
  label = 'Password',
  required = true,
  placeholder = 'Enter strong password (min. 12 chars)',
  id = 'password',
  name = 'password',
  disabled = false,
  showRequirements = true,
  autoFocus = false,
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const strength = calculatePasswordStrength(value, userContext);
  const requirements = checkPasswordRequirements(value, userContext);

  const handleSuggest = () => {
    const suggested = generateStrongPassword(16);
    if (onChange) {
      onChange(suggested);
    }
    setShowPassword(true);
    toast.success('Strong password generated! You can edit or copy it.', {
      icon: '🔐',
    });
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Password copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy password.');
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label Header with Action Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 focus:outline-hidden focus:underline transition cursor-pointer disabled:opacity-50"
          title="Generate a cryptographically secure 16-character password"
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-500" />
          <span>Suggest strong password</span>
        </button>
      </div>

      {/* Input Field with Action Toggles */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Lock className="h-4 w-4" />
        </div>
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white pl-9 pr-20 text-base md:text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition font-mono tracking-wide"
        />

        {/* View/Hide & Copy Actions */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-0.5">
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center min-w-[36px] min-h-[36px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Copy password to clipboard"
              aria-label="Copy password"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center justify-center min-w-[36px] min-h-[36px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Live Strength Meter (Shown as soon as user starts typing) */}
      {value && strength && (
        <div className="pt-1 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Password strength:</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${strength.badgeBg}`}
            >
              {strength.level}
            </span>
          </div>

          {/* 4 Segmented Progress Bars */}
          <div className="grid grid-cols-4 gap-1.5 h-1.5">
            {[1, 2, 3, 4].map((step) => {
              const active = strength.score >= step;
              return (
                <div
                  key={step}
                  className={`h-full rounded-full transition-all duration-300 ${
                    active ? strength.color : 'bg-slate-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Live Requirements Checklist (Shown when typing or if showRequirements is true) */}
      {showRequirements && value && (
        <div className="rounded-lg bg-slate-50/80 border border-slate-200/80 p-3 space-y-1.5 text-xs animate-in fade-in duration-200">
          <p className="text-[11px] font-semibold text-slate-600 mb-1">
            Password requirements:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {requirements.map((req) => (
              <div
                key={req.id}
                className={`flex items-center gap-1.5 transition-colors ${
                  req.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
                }`}
              >
                {req.met ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                )}
                <span className="text-[11px] leading-tight">{req.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordInputWithStrength;
