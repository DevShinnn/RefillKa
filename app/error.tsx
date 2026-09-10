'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="login">
      <div className="loginbox">
        <h2>Could not load this page</h2>
        <p className="sub">Refresh or try again. Your data was not deleted.</p>
        <button className="btn btn-primary" type="button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </section>
  );
}
