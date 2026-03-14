import { FormEvent, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { login, register } from "../api";
import type { RegisterRequest, Session } from "../types";
import { mapSignupError, type AuthFieldErrors } from "../utils/authErrors";

type SignupViewProps = {
  onSessionChange: (session: Session) => void;
};

function SignupView({ onSessionChange }: SignupViewProps) {
  const [form, setForm] = useState<RegisterRequest>({
    displayName: "",
    email: "",
    password: ""
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    if (form.password !== confirmPassword) {
      setFieldErrors({
        confirmPassword: "Password and confirm password do not match."
      });
      setError("Password and confirm password do not match.");
      return;
    }

    startTransition(async () => {
      try {
        await register(form);
        onSessionChange(
          await login({
            email: form.email,
            password: form.password
          })
        );
      } catch (caughtError) {
        const nextError = caughtError instanceof Error ? caughtError.message : "Unable to register.";
        const nextFieldErrors = mapSignupError(nextError);
        setFieldErrors(nextFieldErrors);
        setError(nextFieldErrors.form ?? nextError);
      }
    });
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <h1>Sandesaa</h1>
        <p className="auth-copy">
          Create an account, then move straight into chat.
        </p>

        <div className="auth-switch">
          <Link className="auth-link" to="/login">
            Log in
          </Link>
          <Link className="active auth-link" to="/signup">
            Register
          </Link>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? (
            <p aria-live="polite" className="status-banner error auth-error-banner">
              {error}
            </p>
          ) : null}
          <label>
            <span>Display name</span>
            <input
              value={form.displayName}
              aria-invalid={fieldErrors.displayName ? "true" : "false"}
              className={fieldErrors.displayName ? "input-error" : ""}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Your name"
              required
            />
            {fieldErrors.displayName ? <small className="field-error">{fieldErrors.displayName}</small> : null}
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              aria-invalid={fieldErrors.email ? "true" : "false"}
              className={fieldErrors.email ? "input-error" : ""}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="you@example.com"
              required
            />
            {fieldErrors.email ? <small className="field-error">{fieldErrors.email}</small> : null}
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={form.password}
                aria-invalid={fieldErrors.password ? "true" : "false"}
                className={fieldErrors.password ? "input-error" : ""}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Create a password"
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
                    <path
                      d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.4 0 9.4 4.5 10 5.3a.9.9 0 0 1 0 1.4 17.2 17.2 0 0 1-4.1 3.8M6.5 6.5A17 17 0 0 0 2 10.3a.9.9 0 0 0 0 1.4C2.7 12.6 6.6 17 12 17c1 0 1.9-.1 2.8-.4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="password-toggle-icon" viewBox="0 0 24 24">
                    <path
                      d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password ? <small className="field-error">{fieldErrors.password}</small> : null}
          </label>
          <label>
            <span>Confirm password</span>
            <div className="password-field">
              <input
                type={isConfirmPasswordVisible ? "text" : "password"}
                value={confirmPassword}
                aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
                className={fieldErrors.confirmPassword ? "input-error" : ""}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
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
                    <path
                      d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.9 10.9 0 0 1 12 5c5.4 0 9.4 4.5 10 5.3a.9.9 0 0 1 0 1.4 17.2 17.2 0 0 1-4.1 3.8M6.5 6.5A17 17 0 0 0 2 10.3a.9.9 0 0 0 0 1.4C2.7 12.6 6.6 17 12 17c1 0 1.9-.1 2.8-.4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="password-toggle-icon" viewBox="0 0 24 24">
                    <path
                      d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword ? <small className="field-error">{fieldErrors.confirmPassword}</small> : null}
          </label>
          <button className="primary-button" disabled={isPending} type="submit">
            {isPending ? "Creating..." : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default SignupView;
