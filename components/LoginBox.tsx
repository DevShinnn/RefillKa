'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loginToEmail } from '@/lib/loginId';
import { homeForRole, isFieldRole, isOpsRole, type Role } from '@/lib/roles';
import { RefillMark, Wordmark } from '@/components/Brand';

export function LoginBox({ portal }: { portal: 'field' | 'ops' }) {
  const ops = portal === 'ops';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const loginId = String(form.get('login_id') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!loginId || !password) {
      setError('Enter your ID and PIN.');
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginToEmail(loginId),
      password,
    });
    if (authError || !data.user) {
      setPending(false);
      setError('Sign-in failed — check your ID and PIN.');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    const role = (profile?.role ?? null) as Role | null;

    if (portal === 'field' && !isFieldRole(role)) {
      await supabase.auth.signOut();
      setPending(false);
      setError('This page is for CENRO. Use /ops for operations.');
      return;
    }
    if (portal === 'ops' && !isOpsRole(role)) {
      await supabase.auth.signOut();
      setPending(false);
      setError('This page is for operations. Use /login for CENRO.');
      return;
    }

    window.location.assign(homeForRole(role));
  };

  return (
    <section className="login">
      <div className="loginbox">
        <div className="login__brandhead">
          <RefillMark size={36} />
          <div>
            <Wordmark />
            <span className="by">{ops ? 'Operations' : 'Taguig field study'}</span>
          </div>
        </div>

        <h2>{ops ? 'Ops sign in' : 'Sign in'}</h2>
        <p className="sub">
          {ops
            ? 'Developer and admin access. CENRO officers use the field sign-in.'
            : 'Enter the officer ID and PIN assigned to you.'}
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="login_id">ID</label>
            <input
              className="input"
              id="login_id"
              name="login_id"
              type="text"
              autoComplete="username"
              autoCapitalize="characters"
              placeholder={ops ? 'DEV01' : 'CENRO01'}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">PIN</label>
            <div className="login__pin">
              <input
                className="input"
                id="password"
                name="password"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="6-digit PIN"
                required
              />
              <button
                className="login__show"
                type="button"
                onClick={() => setShowPin((open) => !open)}
                aria-pressed={showPin}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error ? <div className="err">{error}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}
