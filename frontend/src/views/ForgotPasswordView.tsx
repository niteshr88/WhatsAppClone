import { FormEvent, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../api";
import { mapSignupError, type AuthFieldErrors } from "../utils/authErrors";

function ForgotPasswordView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    startTransition(async () => {
      try {
        const response = await forgotPassword({ email });
        const searchParams = new URLSearchParams({
          email: response.email,
          token: response.resetToken
        });
        navigate(`/reset-password?${searchParams.toString()}`, { replace: true });
      } catch (caughtError) {
        const nextError = caughtError instanceof Error ? caughtError.message : "Unable to start password reset.";
        const nextFieldErrors = mapSignupError(nextError);
        setFieldErrors(nextFieldErrors);
        setError(nextFieldErrors.form ?? nextError);
      }
    });
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Forgot password</h1>
        <p className="auth-copy">Enter your email and we’ll move you into a secure password reset step.</p>

        <div className="auth-switch">
          <Link className="auth-link" to="/login">
            Back to login
          </Link>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? (
            <p aria-live="polite" className="status-banner error auth-error-banner">
              {error}
            </p>
          ) : null}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              aria-invalid={fieldErrors.email ? "true" : "false"}
              className={fieldErrors.email ? "input-error" : ""}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
            {fieldErrors.email ? <small className="field-error">{fieldErrors.email}</small> : null}
          </label>
          <button className="primary-button" disabled={isPending} type="submit">
            {isPending ? "Preparing..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ForgotPasswordView;
