'use client';

import { useActionState } from 'react';
import { signIn, type LoginState } from './actions';
import { RefillMark, Wordmark } from '@/components/Brand';

const initial: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <section className="login">
      <div className="login__brand">
        <div className="brandhead">
          <RefillMark size={38} />
          <div>
            <div style={{ fontSize: '1.7rem' }}>
              <Wordmark />
            </div>
            <div className="by">by ReCirca × Taguig</div>
          </div>
        </div>

        <div>
          <div className="hero-tag">Monitored Field Study · Pre-Pilot</div>
          <h1 className="hero-h">Collection Logging System</h1>
          <p className="hero-p">
            A live, shared record of every refill and diversion logged across the Taguig
            field study — from the field officer to the Mayor&apos;s office, in real time.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="n">163M</div>
              <div className="l">sachets / day, PH</div>
            </div>
            <div className="hero-stat">
              <div className="n">1B</div>
              <div className="l">challenge by 2030</div>
            </div>
            <div className="hero-stat">
              <div className="n">Taguig</div>
              <div className="l">city-led study</div>
            </div>
          </div>
        </div>

        <p className="hero-foot">
          RefillKa replaces single-use sachets with branded, bulk refilling embedded in the
          community. This is a pre-pilot test environment — sign in with a study account to
          begin logging or reviewing collections.
        </p>
      </div>

      <div className="login__panel">
        <div className="loginbox">
          <h2 className="serif">Sign in</h2>
          <p className="sub">Use the account assigned for your role in the field study.</p>

          <form action={formAction}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@refillka.test"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            {state.error && <div className="err">{state.error}</div>}
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? 'Signing in…' : 'Enter the study →'}
            </button>
          </form>

          <details className="demoaccts">
            <summary>Pre-pilot test accounts</summary>
            <table>
              <tbody>
                <tr><td>CENRO</td><td><code>cenro.santos@refillka.test</code></td></tr>
                <tr><td>LGU Admin</td><td><code>taguig.admin@refillka.test</code></td></tr>
                <tr><td>Mayor (LGU)</td><td><code>mayor.taguig@refillka.test</code></td></tr>
                <tr><td>Regional</td><td><code>ncr.director@refillka.test</code></td></tr>
                <tr><td>National Admin</td><td><code>admin@refillka.test</code></td></tr>
                <tr><td>National Exec</td><td><code>ceo@refillka.test</code></td></tr>
                <tr><td>Developer</td><td><code>dev@refillka.test</code></td></tr>
              </tbody>
            </table>
            <p className="hint" style={{ marginTop: 10 }}>
              Shared test password: <code>RefillKa2030!</code> · created by{' '}
              <code>npm run seed:users</code>. Change before any real pilot.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
