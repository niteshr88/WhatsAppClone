import { FormEvent, useMemo, useState, useTransition } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login, resetPassword } from "../api";
import type { Session } from "../types";
import { mapSignupError, type AuthFieldErrors } from "../utils/authErrors";

type ResetPasswordViewProps = {
  onSessionChange: (session: Session) => void;
};

function ResetPasswordView({ onSessionChange }: ResetPasswordViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isLinkValid = useMemo(() => Boolean(email && token), [email, token]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});

    if (!isLinkValid) {
      setError("This password reset link is invalid or incomplete.");
      return;
    }

    if (password !== confirmPassword) {
      const mismatch = "Password and confirm password do not match.";
      setFieldErrors({ confirmPassword: mismatch });
      setError(mismatch);
      return;
    }

    startTransition(async () => {
      try {
        await resetPassword({
          email,
          token,
          newPassword: password
        });

        setSuccess("Password reset successful. Signing you in...");
        onSessionChange(
          await login({
            email,
            password
          })
        );
        navigate("/chat", { replace: true });
      } catch (caughtError) {
        const nextError = caughtError instanceof Error ? caughtError.message : "Unable to reset password.";
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
        <h1>Reset password</h1>
        <p className="auth-copy">Choose a new password for {email || "your account"}.</p>

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
          {success ? (
            <p aria-live="polite" className="status-banner auth-error-banner">
              {success}
            </p>
          ) : null}
          <label>
            <span>New password</span>
            <div className="password-field">
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                aria-invalid={fieldErrors.password ? "true" : "false"}
                className={fieldErrors.password ? "input-error" : ""}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your new password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                onClick={() => setIsPasswordVisible((current) => !current)}
              >
                {isPasswordVisible ? (
                  <svg aria-hidden="true" className="password-toggle-icon" viewBox="0 0 24 24">
                    <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.4 0 9.4 4.5 10 5.3a.9.9 0 0 1 0 1.4 17.2 17.2 0 0 1-4.1 3.8M6.5 6.5A17 17 0 0 0 2 10.3a.9.9 0 0 0 0 1.4C2.7 12.6 6.6 17 12 17c1 0 1.9-.1 2.8-.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="password-toggle-icon" viewBox="0 0 24 24">
                    <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password ? <small className="field-error">{fieldErrors.password}</small> : null}
          </label>
          <label>
            <span>Confirm new password</span>
            <div className="password-field">
              <input
                type={isConfirmPasswordVisible ? "text" : "password"}
                value={confirmPassword}
                aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
                className={fieldErrors.confirmPassword ? "input-error" : ""}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your new password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={isConfirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                onClick={() => setIsConfirmPasswordVisible((current) => !current)}
              >
                {isConfirmPasswordVisible ? (
                  <svg aria-hidden="true" className="password-toggle-icon" viewBox="0 0 24 24">
                    <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.4 0 9.4 4.5 10 5.3a.9.9 0 0 1 0 1.4 17.2 17.2 0 0 1-4.1 3.8M6.5 6.5A17 17 0 0 0 2 10.3a.9.9 0 0 0 0 1.4C2.7 12.6 6.6 17 12 17c1 0 1.9-.1 2.8-.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="password-toggle-icon" viewBox="0 0 24 24">
                    <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword ? <small className="field-error">{fieldErrors.confirmPassword}</small> : null}
          </label>
          <button className="primary-button" disabled={isPending} type="submit">
            {isPending ? "Updating..." : "Reset password"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ResetPasswordView;
