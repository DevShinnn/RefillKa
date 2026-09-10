export function PageLoading({ label }: { label: string }) {
  return (
    <section className="login">
      <div className="loginbox">
        <p className="sub">{label}</p>
      </div>
    </section>
  );
}
