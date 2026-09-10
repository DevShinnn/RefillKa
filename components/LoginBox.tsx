'use client';

import { useActionState } from 'react';
import { signIn, type LoginState } from '@/app/login/actions';
import { RefillMark, Wordmark } from '@/components/Brand';

const initial: LoginState = { error: null };

export function LoginBox({ portal }: { portal: 'field' | 'ops' }) {
  const [state, formAction, pending] = useActionState(signIn, initial);
  const ops = portal === 'ops';

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

        <form action={formAction}>
          <input type="hidden" name="portal" value={portal} />
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
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="6-digit PIN"
              required
            />
          </div>
          {state.error && <div className="err">{state.error}</div>}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}
