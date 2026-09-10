'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { loginToEmail } from '@/lib/loginId';
import { DEMO_FIELD, DEMO_OPS, DEMO_PIN } from '@/lib/demo';
import { homeForRole, isFieldRole, isOpsRole, roleFromAuthUser, type Role } from '@/lib/roles';
import { RefillMark, Wordmark } from '@/components/Brand';

export function LoginBox({ portal }: { portal: 'field' | 'ops' }) {
  const ops = portal === 'ops';
  const router = useRouter();
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

    let role = roleFromAuthUser(data.user);
    if (!role) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      role = (profile?.role ?? null) as Role | null;
    }

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

    const dest = homeForRole(role);
    if (window.location.pathname === dest) {
      router.refresh();
      return;
    }
    window.location.replace(dest);
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

        <details className="demoaccts">
          <summary>Demo account · sandbox only</summary>
          <p className="sub">Uses fake Demo sandbox stores. It cannot see or change Taguig data.</p>
          <div className="demoaccts__cred">
            <span>{ops ? 'Admin' : 'Field'}</span>
            <code>{ops ? DEMO_OPS.officerId : DEMO_FIELD.officerId}</code>
            <span>PIN {DEMO_PIN}</span>
          </div>
          <button
            className="btn login__demo"
            type="button"
            onClick={() => {
              const id = document.getElementById('login_id');
              const pin = document.getElementById('password');
              if (id instanceof HTMLInputElement) id.value = ops ? DEMO_OPS.officerId : DEMO_FIELD.officerId;
              if (pin instanceof HTMLInputElement) pin.value = DEMO_PIN;
            }}
          >
            Fill demo login
          </button>
        </details>
      </div>
    </section>
  );
}
